import { describe, expect, it } from 'vitest';
import {
  ageMultiplier, classifyErp, classifySize, complexityScore, computeOverlap, countSalaryRanges, erpScore, fitScore,
  leadProduct, leadScore, median, minimumSavings, normaliseSalary, painScore, parseBand, productSplit, sizeScore, timingScore,
  type LabelledDuty,
} from '../lib/scoring';
import { SAVINGS_DEFAULTS } from '../config/scoring';

const L = (label: LabelledDuty['label'], capability_id: string | null = null, i = Math.random()): LabelledDuty => ({ duty_id: `d${i}`, label, capability_id });

describe('salary normalisation', () => {
  it('keeps yearly ranges', () => {
    expect(normaliseSalary({ min: 65000, max: 80000, period: 'year', currency: 'USD', raw_text: '$65,000 - $80,000' })).toMatchObject({ min: 65000, max: 80000 });
  });
  it('converts hourly pay × 2,080', () => {
    expect(normaliseSalary({ min: 30, max: 35, period: 'hour', currency: 'USD', raw_text: '$30-$35/hr' })).toMatchObject({ min: 62400, max: 72800, period_in: 'hour' });
  });
  it('treats a single figure as min', () => {
    expect(normaliseSalary({ min: null, max: 90000, period: 'year', currency: 'USD', raw_text: 'up to $90,000' })).toMatchObject({ min: 90000, max: null });
    expect(normaliseSalary({ min: 90000, max: null, period: 'year', currency: 'USD', raw_text: '$90,000' })).toMatchObject({ min: 90000, max: null });
  });
  it('returns nulls with no salary', () => {
    expect(normaliseSalary({ min: null, max: null, period: null, currency: null, raw_text: null }).min).toBeNull();
    expect(normaliseSalary(null).min).toBeNull();
  });
  it('flags location variance when several ranges appear', () => {
    const raw = 'SF: $95,000 - $115,000. Austin: $85,000 - $105,000.';
    expect(countSalaryRanges(raw)).toBe(2);
    expect(normaliseSalary({ min: 85000, max: 115000, period: 'year', currency: 'USD', raw_text: raw }).varies_by_location).toBe(true);
    expect(normaliseSalary({ min: 85000, max: 105000, period: 'year', currency: 'USD', raw_text: '$85,000 - $105,000' }, 1).varies_by_location).toBe(true);
  });
  it('infers hourly when no period and a small figure', () => {
    expect(normaliseSalary({ min: 28, max: null, period: null, currency: 'USD', raw_text: '$28' }).min).toBe(58240);
  });
});

describe('overlap', () => {
  it('computes covered share, overlap and weighted overlap', () => {
    const labels = [L('covered', 'a', 1), L('covered', 'a', 2), L('assisted', 'b', 3), L('human', null, 4)];
    const o = computeOverlap(labels);
    expect(o).toMatchObject({ n: 4, C: 2, A: 1, covered_share: 0.5, overlap: 0.75, weighted_overlap: 0.625, thin: false });
  });
  it('flags thin postings under 4 scored duties', () => {
    expect(computeOverlap([L('covered', 'a', 1), L('covered', 'a', 2), L('covered', 'a', 3)]).thin).toBe(true);
  });
  it('handles zero duties', () => {
    expect(computeOverlap([])).toMatchObject({ n: 0, overlap: 0, weighted_overlap: 0, thin: true });
  });
});

describe('product split and lead product', () => {
  const cap = { a: 'Treasury', b: 'GL accounting', c: 'Order-to-cash' };
  it('picks the most weighted product', () => {
    const split = productSplit([L('covered', 'a', 1), L('assisted', 'b', 2), L('assisted', 'b', 3), L('assisted', 'b', 4)], cap);
    expect(split['GL accounting'].weighted).toBe(1.5);
    expect(leadProduct(split)).toBe('GL accounting');
  });
  it('breaks ties on covered duties', () => {
    const split = productSplit([L('covered', 'a', 1), L('assisted', 'b', 2), L('assisted', 'b', 3)], cap);
    expect(split.Treasury.weighted).toBe(1);
    expect(split['GL accounting'].weighted).toBe(1);
    expect(leadProduct(split)).toBe('Treasury');
  });
  it('returns null with no matches', () => expect(leadProduct({})).toBeNull());
});

describe('pain, fit, timing, lead score', () => {
  it('pain rewards overlap and open roles, capped at 4', () => {
    expect(painScore([0.5]).pain).toBeCloseTo(0.8 * 0.5 + 0.2 * 0.25);
    expect(painScore([0.5, 0.5, 0.5, 0.5, 0.5, 0.5]).pain).toBeCloseTo(0.8 * 0.5 + 0.2);
    expect(painScore([]).pain).toBe(0);
  });
  it('three open AR roles beat one', () => {
    expect(painScore([0.6, 0.6, 0.6]).pain).toBeGreaterThan(painScore([0.6]).pain);
  });
  it('classifies ERPs', () => {
    expect(classifyErp(['NetSuite'])).toBe('enterprise');
    expect(classifyErp(['QuickBooks Online'])).toBe('smb_only');
    expect(classifyErp(['QuickBooks', 'NetSuite'])).toBe('enterprise');
    expect(classifyErp([])).toBe('not_stated');
    expect(erpScore('smb_only')).toBe(0.2);
    expect(erpScore('not_stated')).toBe(0.5);
  });
  it('classifies size bands', () => {
    expect(parseBand('1,001-5,000')).toEqual([1001, 5000]);
    expect(classifySize('201-500')).toBe('in_band');
    expect(classifySize('5001-10000')).toBe('out_of_band');
    expect(classifySize('51-200')).toBe('out_of_band');
    expect(classifySize('')).toBe('unknown');
    expect(sizeScore('out_of_band')).toBe(0.3);
  });
  it('scores complexity', () => {
    expect(complexityScore({ multi_entity: true, multi_currency: true, usage_based_billing: false, high_volume: false })).toEqual({ score: 1, count: 2 });
    expect(complexityScore({ multi_entity: true, multi_currency: false, usage_based_billing: false, high_volume: false }).score).toBe(0.5);
    expect(complexityScore({ multi_entity: false, multi_currency: false, usage_based_billing: false, high_volume: false }).score).toBe(0.2);
  });
  it('fit = 0.4 ERP + 0.3 size + 0.3 complexity', () => {
    expect(fitScore(1, 1, 1)).toBeCloseTo(1);
    expect(fitScore(0.5, 0.5, 0.2)).toBeCloseTo(0.2 + 0.15 + 0.06);
  });
  it('timing uses the strongest trigger by weight × age', () => {
    const asOf = '2026-10-20';
    const t = timingScore([
      { trigger_type: 'funding', event_date: '2026-09-01', url: 'u1', summary: '' },
      { trigger_type: 'acquisition', event_date: '2026-05-01', url: 'u2', summary: '' },
    ], asOf);
    expect(t.timing).toBeCloseTo(0.8); // funding 0.8 × 1.0 beats acquisition 1.0 × 0.5
    expect(t.top?.url).toBe('u1');
  });
  it('no trigger means timing 0', () => {
    expect(timingScore([], '2026-10-20')).toEqual({ timing: 0, top: null });
  });
  it('age multiplier bands', () => {
    expect(ageMultiplier('2026-08-01', '2026-10-20')).toBe(1);
    expect(ageMultiplier('2026-06-01', '2026-10-20')).toBe(0.5);
    expect(ageMultiplier('2026-01-01', '2026-10-20')).toBe(0);
    expect(ageMultiplier(null, '2026-10-20')).toBe(0);
  });
  it('lead score breakdown adds up', () => {
    const r = leadScore(0.7, 0.6, 0.8);
    expect(r.parts.pain + r.parts.fit + r.parts.timing).toBeCloseTo(r.score);
    expect(r.score).toBeCloseTo(100 * (0.5 * 0.7 + 0.25 * 0.6 + 0.25 * 0.8));
  });
});

describe('minimum savings', () => {
  it('matches the spec worked example', () => {
    const r = minimumSavings({ salary_min: 65000, salary_max: 80000, n: 8, C: 5, A: 0 });
    expect(r.eligible && Math.round(r.value)).toBe(20313);
  });
  it('no salary means no figure', () => {
    expect(minimumSavings({ salary_min: null, salary_max: null, n: 8, C: 5, A: 0 })).toMatchObject({ eligible: false, reason: 'no_salary' });
  });
  it('excludes thin postings', () => {
    expect(minimumSavings({ salary_min: 65000, salary_max: null, n: 3, C: 3, A: 0 })).toMatchObject({ eligible: false, reason: 'thin_posting' });
  });
  it('handles zero duties', () => {
    expect(minimumSavings({ salary_min: 65000, salary_max: null, n: 0, C: 0, A: 0 })).toMatchObject({ eligible: false, reason: 'zero_duties' });
  });
  it('ignores assisted duties by default and counts them at 0.25 when asked', () => {
    const base = { salary_min: 80000, salary_max: 100000, n: 8, C: 4, A: 4 };
    const d = minimumSavings(base);
    const withA = minimumSavings(base, { ...SAVINGS_DEFAULTS, countAssisted: true });
    expect(d.eligible && d.value).toBe(80000 * 0.5 * 0.5);
    expect(withA.eligible && withA.value).toBe(80000 * ((4 + 1) / 8) * 0.5);
  });
  it('midpoint and loaded-cost options', () => {
    const r = minimumSavings({ salary_min: 80000, salary_max: 100000, n: 4, C: 2, A: 0 }, { ...SAVINGS_DEFAULTS, salaryBasis: 'midpoint', loadedCostMultiplier: 1.2, discount: 1 });
    expect(r.eligible && r.value).toBeCloseTo(90000 * 0.5 * 1.2);
  });
  it('midpoint falls back to min when there is no max', () => {
    const r = minimumSavings({ salary_min: 80000, salary_max: null, n: 4, C: 2, A: 0 }, { ...SAVINGS_DEFAULTS, salaryBasis: 'midpoint' });
    expect(r.eligible && r.value).toBe(80000 * 0.5 * 0.5);
  });
});

describe('median', () => {
  it('odd, even, empty', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});
