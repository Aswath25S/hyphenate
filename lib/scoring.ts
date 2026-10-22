/**
 * Pure scoring code shared by the pipeline (score stage) and
 * the UI's client-side recompute. No I/O, no LLM. Same inputs, same numbers.
 */
import {
  COMPLEXITY_SCORES, ENTERPRISE_ERPS, ERP_SCORES, FIT_WEIGHTS, LEAD_WEIGHTS, OVERLAP, PAIN,
  SALARY, SAVINGS_DEFAULTS, SIZE_BRACKETS, SIZE_UNKNOWN_SCORE, SMB_ERPS,
} from '../config/scoring';
import type { Label, Salary } from './schemas';

/* ---------------- Salary ---------------- */

export type NormalisedSalary = {
  min: number | null; // yearly USD
  max: number | null; // yearly USD
  period_in: 'year' | 'hour' | null;
  varies_by_location: boolean;
  raw_text: string | null;
};

const RANGE_RE = /\$\s?\d[\d,]*(?:\.\d+)?\s?[kK]?\s*(?:-|–|—|to)\s*\$?\s?\d[\d,]*(?:\.\d+)?\s?[kK]?/g;

/** Count distinct $ ranges in a salary sentence (used to flag location variance). */
export function countSalaryRanges(raw: string | null | undefined): number {
  if (!raw) return 0;
  const m = raw.match(RANGE_RE);
  return m ? new Set(m.map((s) => s.replace(/\s/g, ''))).size : 0;
}

/**
 * Hourly × 2,080 = yearly. A single figure counts as min. Non-USD returns
 * nulls (the filter drops those postings). Several location ranges: the
 * extractor reports the lowest min; we flag that it varies by location.
 */
export function normaliseSalary(s: Salary | null | undefined, extraRanges = 0): NormalisedSalary {
  const empty: NormalisedSalary = { min: null, max: null, period_in: null, varies_by_location: false, raw_text: s?.raw_text ?? null };
  if (!s) return empty;
  if (s.currency !== null && s.currency !== 'USD') return empty;
  let min = s.min;
  let max = s.max;
  if (min === null && max !== null) {
    min = max; // a single figure counts as min
    max = null;
  }
  if (min === null) return empty;
  let period = s.period;
  // Heuristic guard: a figure under 500 without a stated period is hourly.
  if (period === null) period = min < 500 ? 'hour' : 'year';
  const mult = period === 'hour' ? SALARY.hoursPerYear : 1;
  const yMin = Math.round(min * mult);
  const yMax = max !== null ? Math.round(max * mult) : null;
  return {
    min: yMin,
    max: yMax !== null && yMax >= yMin ? yMax : null,
    period_in: period,
    varies_by_location: countSalaryRanges(s.raw_text) + extraRanges > 1,
    raw_text: s.raw_text,
  };
}

/* ---------------- Overlap ---------------- */

export type LabelledDuty = { duty_id: string; label: Label; capability_id: string | null; product?: string | null };

export type OverlapResult = {
  n: number;
  C: number;
  A: number;
  covered_share: number;
  overlap: number;
  weighted_overlap: number;
  thin: boolean;
  covered_ids: string[];
  assisted_ids: string[];
};

export function computeOverlap(labels: LabelledDuty[]): OverlapResult {
  const n = labels.length;
  const covered = labels.filter((l) => l.label === 'covered');
  const assisted = labels.filter((l) => l.label === 'assisted');
  const C = covered.length;
  const A = assisted.length;
  return {
    n, C, A,
    covered_share: n ? C / n : 0,
    overlap: n ? (C + A) / n : 0,
    weighted_overlap: n ? (C + OVERLAP.assistedWeight * A) / n : 0,
    thin: n < OVERLAP.thinPostingMinDuties,
    covered_ids: covered.map((l) => l.duty_id),
    assisted_ids: assisted.map((l) => l.duty_id),
  };
}

export type ProductSplit = Record<string, { covered: number; assisted: number; weighted: number }>;

export function productSplit(labels: LabelledDuty[], capabilityProduct: Record<string, string>): ProductSplit {
  const out: ProductSplit = {};
  for (const l of labels) {
    if (l.label !== 'covered' && l.label !== 'assisted') continue;
    const product = l.capability_id ? capabilityProduct[l.capability_id] : undefined;
    if (!product) continue;
    out[product] ??= { covered: 0, assisted: 0, weighted: 0 };
    if (l.label === 'covered') out[product].covered += 1;
    else out[product].assisted += 1;
    out[product].weighted = out[product].covered + OVERLAP.assistedWeight * out[product].assisted;
  }
  return out;
}

export function mergeSplits(splits: ProductSplit[]): ProductSplit {
  const out: ProductSplit = {};
  for (const s of splits)
    for (const [p, v] of Object.entries(s)) {
      out[p] ??= { covered: 0, assisted: 0, weighted: 0 };
      out[p].covered += v.covered;
      out[p].assisted += v.assisted;
      out[p].weighted = out[p].covered + OVERLAP.assistedWeight * out[p].assisted;
    }
  return out;
}

/** Most weighted duties wins; ties go to more covered duties, then name for stability. */
export function leadProduct(split: ProductSplit): string | null {
  const entries = Object.entries(split);
  if (!entries.length) return null;
  entries.sort((a, b) => b[1].weighted - a[1].weighted || b[1].covered - a[1].covered || a[0].localeCompare(b[0]));
  return entries[0][0];
}

/* ---------------- Pain / Fit ---------------- */

export function painScore(weightedOverlaps: number[]): { pain: number; avg_weighted_overlap: number; open_roles: number } {
  const open_roles = weightedOverlaps.length;
  const avg = open_roles ? weightedOverlaps.reduce((a, b) => a + b, 0) / open_roles : 0;
  const pain = PAIN.overlapWeight * avg + PAIN.rolesWeight * (Math.min(open_roles, PAIN.rolesCap) / PAIN.rolesCap);
  return { pain, avg_weighted_overlap: avg, open_roles };
}

export type ErpClass = 'enterprise' | 'smb_only' | 'not_stated' | 'other';

export function classifyErp(erps: string[]): ErpClass {
  const names = erps.map((e) => e.toLowerCase().trim()).filter(Boolean);
  if (!names.length) return 'not_stated';
  if (names.some((n) => ENTERPRISE_ERPS.some((e) => n.includes(e)))) return 'enterprise';
  if (names.every((n) => SMB_ERPS.some((e) => n.includes(e)))) return 'smb_only';
  return 'other';
}

export function erpScore(c: ErpClass): number {
  return c === 'enterprise' ? ERP_SCORES.enterprise : c === 'smb_only' ? ERP_SCORES.smbOnly : c === 'not_stated' ? ERP_SCORES.notStated : ERP_SCORES.other;
}

/** Parse an employee band like "201-500", "1001-5000", "5000+" into a [min,max]. */
export function parseBand(band: string | null | undefined): [number, number] | null {
  if (!band) return null;
  const b = band.replace(/,/g, '');
  const range = b.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (range) return [Number(range[1]), Number(range[2])];
  const plus = b.match(/(\d+)\s*\+/);
  if (plus) return [Number(plus[1]), Infinity];
  const single = b.match(/^\s*(\d+)\s*$/);
  if (single) return [Number(single[1]), Number(single[1])];
  return null;
}

/** Bracket label from config, or 'unknown'. */
export type SizeClass = string;

export function classifySize(band: string | null | undefined): SizeClass {
  const r = parseBand(band);
  if (!r) return 'unknown';
  const lo = r[0];
  return (SIZE_BRACKETS.find((b) => lo <= b.max) ?? SIZE_BRACKETS[SIZE_BRACKETS.length - 1]).label;
}

export function sizeScore(c: SizeClass): number {
  return SIZE_BRACKETS.find((b) => b.label === c)?.score ?? SIZE_UNKNOWN_SCORE;
}

export type ComplexityFlags = { multi_entity: boolean; multi_currency: boolean; usage_based_billing: boolean; high_volume: boolean };

export function complexityScore(f: ComplexityFlags): { score: number; count: number } {
  const count = [f.multi_entity, f.multi_currency, f.usage_based_billing, f.high_volume].filter(Boolean).length;
  const score = count >= 2 ? COMPLEXITY_SCORES.twoOrMore : count === 1 ? COMPLEXITY_SCORES.one : COMPLEXITY_SCORES.none;
  return { score, count };
}

export function fitScore(erp: number, size: number, complexity: number): number {
  return FIT_WEIGHTS.erp * erp + FIT_WEIGHTS.size * size + FIT_WEIGHTS.complexity * complexity;
}

export type LeadWeights = typeof LEAD_WEIGHTS;

export function leadScore(pain: number, fit: number, w: LeadWeights = LEAD_WEIGHTS) {
  const parts = { pain: 100 * w.pain * pain, fit: 100 * w.fit * fit };
  return { score: parts.pain + parts.fit, parts };
}

/* ---------------- Savings ---------------- */

export type SavingsSettings = typeof SAVINGS_DEFAULTS;

export type SavingsInput = { salary_min: number | null; salary_max: number | null; n: number; C: number; A: number };

export type SavingsResult =
  | { eligible: true; value: number; salary_used: number; share: number }
  | { eligible: false; reason: 'no_salary' | 'thin_posting' | 'zero_duties'; value: null };

/** salary_min × C/n × d (defaults). Options widen it only when the user chooses. */
export function minimumSavings(i: SavingsInput, s: SavingsSettings = SAVINGS_DEFAULTS): SavingsResult {
  if (i.n === 0) return { eligible: false, reason: 'zero_duties', value: null };
  if (i.salary_min === null) return { eligible: false, reason: 'no_salary', value: null };
  if (i.n < OVERLAP.thinPostingMinDuties) return { eligible: false, reason: 'thin_posting', value: null };
  const salary = s.salaryBasis === 'midpoint' && i.salary_max !== null ? (i.salary_min + i.salary_max) / 2 : i.salary_min;
  const share = (i.C + (s.countAssisted ? s.assistedWeight * i.A : 0)) / i.n;
  return { eligible: true, value: salary * share * s.discount, salary_used: salary, share };
}

/** Middle of a posted range, or the single figure when there is no maximum. */
export function salaryMid(min: number, max: number | null): number {
  return max !== null && max >= min ? (min + max) / 2 : min;
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
