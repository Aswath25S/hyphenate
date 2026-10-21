/** Stage 9: write the final data/app/*.json files the UI reads. */
import path from 'node:path';
import fs from 'node:fs';
import * as CONFIG from '../../config/scoring';
import { ensureDir, listJson, readJson, writeJson } from '../lib/io';
import { P } from '../lib/paths';
import { loadCoverage } from '../lib/coverage';
import { computeLeads } from '../lib/leads';
import { locateSpan } from '../lib/text';
import { recordStage, type StageStat } from '../lib/stats';
import { median } from '../../lib/scoring';
import { MODEL } from '../lib/claude';
import type { ExtractedPosting, MatchedPosting } from '../lib/types';
import type { CompanyBase, PostingScore } from './score';
import type { GapTheme } from './gaps';
import type { StoredTrigger } from './news';
import type { BriefOutput } from '../../lib/schemas';

export function costReport(): Record<string, { calls: number; cached: number; input_tokens: number; output_tokens: number; cost_usd: number }> {
  const file = path.join(P.logs, 'usage.jsonl');
  const out: Record<string, { calls: number; cached: number; input_tokens: number; output_tokens: number; cost_usd: number }> = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const u = JSON.parse(line);
    if (u.stage === 'live') continue;
    const s = (out[u.stage] ??= { calls: 0, cached: 0, input_tokens: 0, output_tokens: 0, cost_usd: 0 });
    if (u.cached) s.cached++;
    else { s.calls++; s.input_tokens += u.input_tokens; s.output_tokens += u.output_tokens; s.cost_usd += u.cost_usd; }
  }
  return out;
}

export async function publish(opts: { asOf?: Date; mode?: 'pipeline' | 'fixture_preview' } = {}) {
  const asOf = (opts.asOf ?? new Date()).toISOString().slice(0, 10);
  const coverage = loadCoverage();
  const capById = new Map(coverage.capabilities.map((c) => [c.id, c]));
  const scored = readJson<PostingScore[]>(path.join(P.processed, 'scored_postings.json'));
  const companiesBase = readJson<CompanyBase[]>(path.join(P.processed, 'scored_companies.json'));
  const newsFile = path.join(P.processed, 'news.json');
  const news = fs.existsSync(newsFile) ? readJson<{ as_of: string; companies: string[]; triggers: Record<string, StoredTrigger[]> }>(newsFile) : null;
  const gapsFile = path.join(P.processed, 'gaps.json');
  const gapData = fs.existsSync(gapsFile) ? readJson<{ themes: GapTheme[] }>(gapsFile) : { themes: [] };
  const briefFile = path.join(P.processed, 'briefs.json');
  const briefs = fs.existsSync(briefFile) ? readJson<{ briefs: Record<string, { brief: BriefOutput; data: unknown }>; dropped: unknown[] }>(briefFile) : { briefs: {}, dropped: [] };

  const leads = computeLeads(companiesBase, news, asOf);
  const companyByDomain = new Map(leads.map((c) => [c.domain, c]));
  const themeByDuty = new Map<string, { theme_id: string; name: string; bucket: string }>();
  for (const t of gapData.themes) for (const d of t.duty_ids) themeByDuty.set(d, { theme_id: t.theme_id, name: t.name, bucket: t.bucket });

  // Posting detail files (evidence view).
  fs.rmSync(P.appPostings, { recursive: true, force: true });
  ensureDir(P.appPostings);
  const extracted = new Map(listJson(P.extracted).map((f) => readJson<ExtractedPosting>(f)).map((p) => [p.posting_id, p]));
  const matched = new Map(listJson(P.matched).map((f) => readJson<MatchedPosting>(f)).map((m) => [m.posting_id, m]));
  let spansFound = 0;
  let spansTotal = 0;
  const postingRows = scored.map((s) => {
    const c = companyByDomain.get(s.domain);
    return {
      posting_id: s.posting_id, company: s.company, slug: c?.slug ?? s.slug, domain: s.domain, title: s.title, role_family: s.role_family,
      seniority: s.seniority, n: s.n, C: s.C, A: s.A, covered_share: s.covered_share, overlap: s.overlap, weighted_overlap: s.weighted_overlap,
      thin: s.thin, salary_min: s.salary.min, salary_max: s.salary.max, salary_varies: s.salary.varies_by_location, salary_source: s.salary_source,
      savings: s.savings.value, savings_reason: s.savings.reason, lead_product: s.lead_product, product_split: s.product_split,
      erp: s.erp, tools: s.tools, posted_at: s.posted_at, source_url: s.source_url, locations: s.locations, remote: s.remote,
      excluded: c?.excluded ?? null,
    };
  });
  for (const row of postingRows) {
    const p = extracted.get(row.posting_id)!;
    const m = matched.get(row.posting_id);
    const labelById = new Map((m?.labels ?? []).map((l) => [l.duty_id, l]));
    const duties = p.duties.map((d) => {
      const l = labelById.get(d.duty_id);
      const span = locateSpan(p.text, d.source_span);
      spansTotal++;
      if (span) spansFound++;
      const cap = l?.capability_id ? capById.get(l.capability_id) : undefined;
      return {
        ...d, scored: !d.is_boilerplate && !d.is_requirement, span,
        label: l?.label ?? null, model_label: l?.model_label ?? null, adjusted: l?.adjusted ?? null,
        capability_id: l?.capability_id ?? null, capability: cap?.capability ?? null, product: cap?.product ?? null,
        confidence: l?.confidence ?? null, rationale: l?.rationale ?? null, gap_theme: themeByDuty.get(d.duty_id) ?? null,
      };
    });
    writeJson(path.join(P.appPostings, `${row.posting_id}.json`), {
      ...row, text: p.text, extra_salary_lines: p.extra_salary_lines, salary_raw: p.salary, complexity: p.complexity,
      pain_phrases: p.pain_phrases, fetched_at: p.fetched_at, ats: p.ats, duties,
    });
  }

  const companies = leads.map((c) => ({
    ...c,
    brief: briefs.briefs[c.domain]?.brief ?? null,
    gap_themes: gapData.themes
      .filter((t) => t.company_domains.includes(c.domain))
      .map((t) => ({ theme_id: t.theme_id, name: t.name, bucket: t.bucket, duties: t.duty_ids.filter((d) => c.posting_ids.some((pid) => d.startsWith(pid))).length })),
  }));

  // Headline numbers, computed once so every page quotes the same figures.
  const withSalary = postingRows.filter((p) => p.salary_min !== null);
  const eligible = postingRows.filter((p) => p.savings !== null);
  const leadRows = companies.filter((c) => c.rank !== null);
  const headlines = {
    postings: postingRows.length,
    companies: companies.length,
    lead_companies: leadRows.length,
    median_overlap: median(postingRows.filter((p) => p.n > 0).map((p) => p.overlap)),
    companies_with_covered_work: leadRows.filter((c) => c.posting_ids.some((id) => (postingRows.find((p) => p.posting_id === id)?.C ?? 0) > 0)).length,
    savings_total: eligible.reduce((a, p) => a + (p.savings ?? 0), 0),
    savings_postings: eligible.length,
    salary_postings: withSalary.length,
    thin_postings: postingRows.filter((p) => p.thin).length,
    strong_postings: postingRows.filter((p) => p.overlap >= CONFIG.OVERLAP.strongLeadOverlap).length,
  };

  const stageStats = readJson<Record<string, StageStat>>(path.join(P.processed, 'stage_stats.json'), {});
  const collection = readJson<Record<string, unknown>>(path.join(P.processed, 'collection_report.json'), {});
  writeJson(path.join(P.app, 'postings.json'), postingRows);
  writeJson(path.join(P.app, 'companies.json'), companies);
  writeJson(path.join(P.app, 'gaps.json'), { themes: gapData.themes, strong_overlap: CONFIG.OVERLAP.strongLeadOverlap });
  writeJson(path.join(P.app, 'meta.json'), {
    as_of: asOf, generated_at: new Date().toISOString(), mode: opts.mode ?? 'pipeline', model: MODEL(),
    headlines, stage_stats: stageStats, cost_report: costReport(), spans: { found: spansFound, total: spansTotal },
    news: { as_of: news?.as_of ?? null, companies_searched: news?.companies.length ?? 0 },
    briefs: { count: Object.keys(briefs.briefs).length, dropped: briefs.dropped.length },
    coverage, config: {
      LEAD_WEIGHTS: CONFIG.LEAD_WEIGHTS, PAIN: CONFIG.PAIN, FIT_WEIGHTS: CONFIG.FIT_WEIGHTS, ERP_SCORES: CONFIG.ERP_SCORES,
      SIZE_SCORES: CONFIG.SIZE_SCORES, SIZE_BAND: CONFIG.SIZE_BAND, COMPLEXITY_SCORES: CONFIG.COMPLEXITY_SCORES,
      TRIGGER_WEIGHTS: CONFIG.TRIGGER_WEIGHTS, TRIGGER_AGE: CONFIG.TRIGGER_AGE, NEWS: CONFIG.NEWS, OVERLAP: CONFIG.OVERLAP,
      SAVINGS_DEFAULTS: CONFIG.SAVINGS_DEFAULTS, FILTER: CONFIG.FILTER,
    },
    collection: { seeds: collection.seeds ?? null, total_jobs: collection.total_jobs ?? null, at: collection.at ?? null },
  });
  recordStage({ stage: 'publish', in: scored.length, out: postingRows.length, notes: [`${companies.length} companies`, `${spansFound}/${spansTotal} duty spans located in posting text`] });
}
