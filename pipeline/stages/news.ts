/** Stage 6: fetch and classify trigger events for the top companies by pain + fit. */
import path from 'node:path';
import { NEWS } from '../../config/scoring';
import { readJson, shortHash, writeJson } from '../lib/io';
import { P } from '../lib/paths';
import { getXml } from '../lib/fetch';
import { parseFeed, type FeedItem } from '../lib/rss';
import { callTool, hasCredentials } from '../lib/claude';
import { NEWS_SYSTEM, NEWS_TOOL, newsSchema, newsUser } from '../prompts/news';
import { recordStage } from '../lib/stats';
import { daysBetween } from '../../lib/scoring';
import type { CompanyBase } from './score';

export type StoredTrigger = {
  trigger_type: string; event_date: string | null; summary: string; confidence: number;
  headline: string; url: string; source: string; published: string | null; fetched_at: string;
};

export function googleNewsUrl(company: string): string {
  const q = `"${company}" (acquires OR acquisition OR raises OR funding OR CFO OR "chief financial officer" OR controller OR expansion OR IPO OR layoffs OR ERP)`;
  return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
}

export function headlineNamesCompany(headline: string, company: string): boolean {
  const esc = company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^A-Za-z0-9])${esc}([^A-Za-z0-9]|$)`, 'i').test(headline);
}

export async function news(asOf = new Date()) {
  const companies = readJson<CompanyBase[]>(path.join(P.processed, 'scored_companies.json'));
  const targets = companies.filter((c) => !c.excluded).sort((a, b) => b.pain + b.fit - (a.pain + a.fit)).slice(0, NEWS.topCompanies);
  const asOfStr = asOf.toISOString().slice(0, 10);
  const out: Record<string, StoredTrigger[]> = {};
  const raw: Record<string, (FeedItem & { url: string })[]> = {};
  const notes: string[] = [];
  let kept = 0;
  let seen = 0;
  for (const c of targets) {
    const fetched_at = new Date().toISOString();
    let items: FeedItem[] = [];
    for (const url of [googleNewsUrl(c.company), c.newsroom_rss].filter(Boolean) as string[]) {
      try { items.push(...parseFeed(await getXml(url))); }
      catch (e) { notes.push(`${c.company}: ${(e as Error).message}`); }
    }
    // Keep recent items only (older than 180 days score zero anyway).
    items = items.filter((i) => i.title && i.link && (!i.published || daysBetween(i.published, asOfStr) <= 180));
    const uniq = [...new Map(items.map((i) => [i.title.toLowerCase(), i])).values()].slice(0, NEWS.maxItemsPerCompany);
    raw[c.domain] = uniq.map((i) => ({ ...i, url: i.link }));
    seen += uniq.length;
    out[c.domain] = [];
    if (!uniq.length) continue;
    if (!hasCredentials()) { notes.push('no ANTHROPIC_API_KEY: news fetched but not classified'); continue; }
    const withIds = uniq.map((i) => ({ item_id: shortHash(i.link, 8), title: i.title, source: i.source, published: i.published ?? 'unknown', snippet: i.snippet }));
    const res = await callTool({
      stage: 'news', system: NEWS_SYSTEM, user: newsUser(c.company, c.domain, withIds),
      toolName: NEWS_TOOL.name, toolDescription: NEWS_TOOL.description, schema: newsSchema, effort: 'low', maxTokens: 6000,
    });
    if (!res.ok) { notes.push(`${c.company}: classification failed: ${res.error}`); continue; }
    for (const cls of res.data.items) {
      const item = uniq[withIds.findIndex((w) => w.item_id === cls.item_id)];
      if (!item) continue;
      if (cls.trigger_type === 'none' || cls.confidence < NEWS.minConfidence) continue;
      // Code double-checks the model's "named in headline" claim.
      if (!cls.company_named_in_headline || !headlineNamesCompany(item.title, c.company)) continue;
      out[c.domain].push({
        trigger_type: cls.trigger_type, event_date: cls.event_date ?? item.published, summary: cls.summary, confidence: cls.confidence,
        headline: item.title, url: item.link, source: item.source, published: item.published, fetched_at,
      });
      kept++;
    }
  }
  writeJson(path.join(P.rawNews, 'items.json'), raw);
  writeJson(path.join(P.processed, 'news.json'), { as_of: asOfStr, companies: targets.map((t) => t.domain), triggers: out });
  recordStage({ stage: 'news', in: seen, out: kept, notes: [`${targets.length} companies searched`, ...[...new Set(notes)].slice(0, 10)] });
}
