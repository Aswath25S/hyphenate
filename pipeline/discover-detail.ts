/** Seed-list helper: re-fetch boards that hit in discovery and list surviving US finance titles. */
import path from 'node:path';
import { readJson, writeJson } from './lib/io';
import { P } from './lib/paths';
import { classifyTitle } from './lib/roles';
import { isUsLocation } from './lib/geo';
import { fetchBoard, type Ats } from './lib/sources';
import { pool } from './lib/llm';
import { FILTER } from '../config/scoring';

const disc = readJson<{ slug: string; company: string; domain: string; ats: Ats; finance_us_recent?: number }[]>(path.join(P.processed, 'discovery.json'));
const hits = [...new Map(disc.filter((d) => (d.finance_us_recent ?? 0) > 0).map((d) => [`${d.ats}:${d.slug}`, d])).values()];
const cutoff = Date.now() - FILTER.maxAgeDays * 86_400_000;
const out: Record<string, unknown>[] = [];
await pool(hits, 6, async (h) => {
  try {
    const jobs = await fetchBoard({ company: h.company, domain: h.domain, ats: h.ats, board_token: h.slug });
    const fin = jobs.filter((j) => classifyTitle(j.title) !== 'drop' && isUsLocation(j.locations, j.text) && (!(j.posted_at ?? j.updated_at) || new Date((j.posted_at ?? j.updated_at)!).getTime() >= cutoff));
    out.push({ ...h, total: jobs.length, n: fin.length, salary: fin.filter((j) => j.structured_salary || /\$\s?\d{2}/.test(j.text)).length, titles: fin.map((j) => `${classifyTitle(j.title)[0]} ${j.title}`) });
  } catch (e) { out.push({ ...h, error: String(e) }); }
});
out.sort((a, b) => (b.n as number) - (a.n as number));
writeJson(path.join(P.processed, 'discovery_detail.json'), out);
for (const o of out) if ((o.n as number) > 0) console.log(`${String(o.ats).padEnd(10)} ${String(o.slug).padEnd(18)} n=${o.n} sal=${o.salary} | ${(o.titles as string[]).join(' | ')}`);
