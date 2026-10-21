/** Stage 5: overlap, product split, pain, fit and minimum savings. Pure code, no LLM. */
import path from 'node:path';
import fs from 'node:fs';
import { listJson, readJson, writeJson } from '../lib/io';
import { P } from '../lib/paths';
import { loadCoverage, coverageIndex } from '../lib/coverage';
import { exclusionReason, loadExclusions, loadSeeds, type Seed } from '../lib/seeds';
import { recordStage } from '../lib/stats';
import { slugify } from '../lib/text';
import {
  classifyErp, classifySize, complexityScore, computeOverlap, erpScore, fitScore, leadProduct, mergeSplits,
  minimumSavings, normaliseSalary, painScore, productSplit, sizeScore, type NormalisedSalary, type ProductSplit,
} from '../../lib/scoring';
import type { ExtractedPosting, MatchedPosting } from '../lib/types';
import type { FinalLabel } from '../prompts/match';

export type PostingScore = {
  posting_id: string; company: string; domain: string; slug: string; title: string; role_family: string; seniority: string;
  n: number; C: number; A: number; covered_share: number; overlap: number; weighted_overlap: number; thin: boolean;
  covered_ids: string[]; assisted_ids: string[];
  product_split: ProductSplit; lead_product: string | null;
  salary: NormalisedSalary; salary_source: string | null;
  savings: { value: number | null; reason: string | null; salary_used: number | null; share: number | null };
  erp: string[]; tools: string[]; complexity: ExtractedPosting['complexity'];
  posted_at: string | null; source_url: string; locations: string[]; remote: string; matched: boolean;
};

export type CompanyBase = {
  slug: string; company: string; domain: string; ats: string; employee_band: string | null; size_source_url: string | null;
  size_note: string | null; hq_state: string | null; excluded: 'existing_customer' | 'finance_software_vendor' | null;
  posting_ids: string[]; open_roles: number; avg_weighted_overlap: number; avg_overlap: number; pain: number;
  erp: string[]; erp_class: string; erp_score: number; size_class: string; size_score: number;
  complexity_flags: { multi_entity: boolean; multi_currency: boolean; usage_based_billing: boolean; high_volume: boolean };
  complexity_count: number; complexity_score: number; fit: number;
  product_split: ProductSplit; lead_product: string | null; tools: string[];
  savings_total: number; savings_roles: number; salary_roles: number; newsroom_rss: string | null;
};

export function scorePosting(p: ExtractedPosting, m: MatchedPosting | null, capProduct: Record<string, string>): PostingScore {
  const labels: FinalLabel[] = m?.labels ?? [];
  const ov = computeOverlap(labels);
  const split = productSplit(labels, capProduct);
  const salary = normaliseSalary(p.salary, p.extra_salary_lines.length);
  const sav = minimumSavings({ salary_min: salary.min, salary_max: salary.max, n: ov.n, C: ov.C, A: ov.A });
  return {
    posting_id: p.posting_id, company: p.company, domain: p.domain, slug: slugify(p.company), title: p.title,
    role_family: p.role_family, seniority: p.seniority,
    n: ov.n, C: ov.C, A: ov.A, covered_share: ov.covered_share, overlap: ov.overlap, weighted_overlap: ov.weighted_overlap, thin: ov.thin,
    covered_ids: ov.covered_ids, assisted_ids: ov.assisted_ids,
    product_split: split, lead_product: leadProduct(split),
    salary, salary_source: p.salary_source,
    savings: sav.eligible ? { value: sav.value, reason: null, salary_used: sav.salary_used, share: sav.share } : { value: null, reason: sav.reason, salary_used: null, share: null },
    erp: p.erp, tools: p.tools, complexity: p.complexity,
    posted_at: p.posted_at, source_url: p.source_url, locations: p.locations, remote: p.remote, matched: Boolean(m),
  };
}

export function scoreCompanies(postings: PostingScore[], seeds: Seed[]): CompanyBase[] {
  const ex = loadExclusions();
  const byDomain = new Map<string, PostingScore[]>();
  for (const p of postings) {
    const key = p.domain || p.slug;
    byDomain.set(key, [...(byDomain.get(key) ?? []), p]);
  }
  const out: CompanyBase[] = [];
  for (const [domain, ps] of byDomain) {
    const seed = seeds.find((s) => s.domain === domain) ?? null;
    const company = seed?.company ?? ps[0].company;
    const pain = painScore(ps.map((p) => p.weighted_overlap));
    const erp = [...new Set(ps.flatMap((p) => p.erp))];
    const erpClass = classifyErp(erp);
    const sizeClass = classifySize(seed?.employee_band);
    const flags = {
      multi_entity: ps.some((p) => p.complexity.multi_entity),
      multi_currency: ps.some((p) => p.complexity.multi_currency),
      usage_based_billing: ps.some((p) => p.complexity.usage_based_billing),
      high_volume: ps.some((p) => p.complexity.high_volume),
    };
    const cx = complexityScore(flags);
    const es = erpScore(erpClass);
    const ss = sizeScore(sizeClass);
    const split = mergeSplits(ps.map((p) => p.product_split));
    const eligible = ps.filter((p) => p.savings.value !== null);
    out.push({
      slug: slugify(company), company, domain, ats: seed?.ats ?? 'manual',
      employee_band: seed?.employee_band || null, size_source_url: seed?.size_source_url || null, size_note: seed?.size_note || null,
      hq_state: seed?.hq_state || null, excluded: exclusionReason(company, domain, ex),
      posting_ids: ps.map((p) => p.posting_id), open_roles: pain.open_roles,
      avg_weighted_overlap: pain.avg_weighted_overlap, avg_overlap: ps.reduce((a, p) => a + p.overlap, 0) / ps.length, pain: pain.pain,
      erp, erp_class: erpClass, erp_score: es, size_class: sizeClass, size_score: ss,
      complexity_flags: flags, complexity_count: cx.count, complexity_score: cx.score, fit: fitScore(es, ss, cx.score),
      product_split: split, lead_product: leadProduct(split), tools: [...new Set(ps.flatMap((p) => p.tools))].sort(),
      savings_total: eligible.reduce((a, p) => a + (p.savings.value ?? 0), 0), savings_roles: eligible.length,
      salary_roles: ps.filter((p) => p.salary.min !== null).length, newsroom_rss: seed?.newsroom_rss || null,
    });
  }
  return out.sort((a, b) => b.pain + b.fit - (a.pain + a.fit));
}

export async function score() {
  const coverage = loadCoverage();
  const { product } = coverageIndex(coverage);
  const seeds = fs.existsSync(path.join(P.config, 'sources.csv')) ? loadSeeds() : [];
  const files = listJson(P.extracted);
  const notes: string[] = [];
  const postings: PostingScore[] = [];
  for (const f of files) {
    const p = readJson<ExtractedPosting>(f);
    const mf = path.join(P.matched, `${p.posting_id}.json`);
    const m = fs.existsSync(mf) ? readJson<MatchedPosting>(mf) : null;
    if (!m) { notes.push(`no match labels for ${p.posting_id}; skipped`); continue; }
    postings.push(scorePosting(p, m, product));
  }
  const companies = scoreCompanies(postings, seeds);
  writeJson(path.join(P.processed, 'scored_postings.json'), postings);
  writeJson(path.join(P.processed, 'scored_companies.json'), companies);
  recordStage({
    stage: 'score', in: files.length, out: postings.length,
    notes: [`${companies.length} companies`, `${postings.filter((p) => p.thin).length} thin postings`, `${postings.filter((p) => p.salary.min !== null).length} with salary`, ...notes.slice(0, 10)],
  });
}
