import { describe, expect, it } from 'vitest';
import { checkMatch, finaliseLabels } from '../pipeline/prompts/match';
import { factCheckBrief } from '../pipeline/prompts/brief';
import { checkClusters } from '../pipeline/prompts/gaps';
import { checkExtraction } from '../pipeline/prompts/extract';
import { dedupe, postingId } from '../pipeline/stages/filter';
import { boardSalary, buildPosting } from '../pipeline/stages/extract';
import { headlineNamesCompany } from '../pipeline/stages/news';
import { htmlToText, locateSpan, normaliseTitle, textSimilarity } from '../pipeline/lib/text';
import { parseRobots, assertAllowedHost } from '../pipeline/lib/fetch';
import { classifyTitle } from '../pipeline/lib/roles';
import { isUsLocation } from '../pipeline/lib/geo';
import { parseFeed } from '../pipeline/lib/rss';
import type { FilteredPosting } from '../pipeline/lib/types';

const caps = new Set(['tre.bank_rec', 'gl.journal_entries']);

describe('match checks and post-rules', () => {
  const ok = { duty_id: 'd1', label: 'covered' as const, capability_id: 'tre.bank_rec', confidence: 0.9, rationale: 'r' };
  it('requires one label per duty and valid capability ids', () => {
    expect(checkMatch({ labels: [ok] }, ['d1'], caps)).toBeNull();
    expect(checkMatch({ labels: [] }, ['d1'], caps)).toMatch(/missing/);
    expect(checkMatch({ labels: [ok, ok] }, ['d1'], caps)).toMatch(/duplicate/);
    expect(checkMatch({ labels: [{ ...ok, capability_id: null }] }, ['d1'], caps)).toMatch(/capability_id/);
    expect(checkMatch({ labels: [{ ...ok, capability_id: 'made.up' }] }, ['d1'], caps)).toMatch(/capability_id/);
    expect(checkMatch({ labels: [{ ...ok, label: 'human', capability_id: null }] }, ['d1'], caps)).toBeNull();
  });
  it('low confidence becomes unclear; covered on an assisted capability becomes assisted', () => {
    const levels = { 'tre.bank_rec': 'covered' as const, 'gl.journal_entries': 'assisted' as const };
    const [a, b, c] = finaliseLabels([
      { ...ok, confidence: 0.4 },
      { ...ok, duty_id: 'd2', capability_id: 'gl.journal_entries' },
      { ...ok, duty_id: 'd3' },
    ], levels);
    expect(a).toMatchObject({ label: 'unclear', model_label: 'covered' });
    expect(b).toMatchObject({ label: 'assisted', model_label: 'covered' });
    expect(c).toMatchObject({ label: 'covered', adjusted: null });
  });
});

describe('brief fact check', () => {
  const data = { company: 'Acme', roles: [{ title: 'AR Specialist', overlap: '88%' }], erp: ['NetSuite'], minimum_savings: 'at least $20,300 a year across 2 roles', lead_product: 'Order-to-cash' };
  it('passes when every number and name is in the data', () => {
    expect(factCheckBrief({ headline: 'Acme is hiring an AR Specialist with 88% overlap on NetSuite.', s: 'At least $20,300 a year across 2 roles.' }, data, ['Order-to-cash'])).toEqual([]);
  });
  it('flags invented numbers and names', () => {
    const p = factCheckBrief({ headline: 'Acme raised $50M and uses Oracle with 91% overlap.' }, data);
    expect(p).toEqual(expect.arrayContaining(['50', 'Oracle', '91']));
  });
});

describe('gap cluster coverage check', () => {
  it('requires every task id in exactly one theme', () => {
    expect(checkClusters([{ task_ids: [0, 1] }, { task_ids: [2] }], 3)).toBeNull();
    expect(checkClusters([{ task_ids: [0, 1] }, { task_ids: [1, 2] }], 3)).toMatch(/more than one/);
    expect(checkClusters([{ task_ids: [0] }], 300)).toMatch(/not assigned/);
    expect(checkClusters([{ task_ids: [0, 1, 2, 9] }], 3)).toMatch(/unknown/);
  });
});

describe('extraction checks', () => {
  const text = '• Apply customer payments daily\n• Reconcile bank accounts and partner with sales';
  const base = { duties: [{ text: 'a', source_span: 'Apply customer payments daily', is_boilerplate: false, is_requirement: false }] };
  it('accepts verbatim spans and rejects invented ones', () => {
    expect(checkExtraction(base as never, text, locateSpan)).toBeNull();
    expect(checkExtraction({ duties: [] } as never, text, locateSpan)).toMatch(/empty/);
    const bad = { duties: [0, 1, 2].map((i) => ({ text: 'x', source_span: `invented span ${i}`, is_boilerplate: false, is_requirement: false })) };
    expect(checkExtraction(bad as never, text, locateSpan)).toMatch(/not verbatim/);
  });
});

describe('text helpers', () => {
  it('locates spans across whitespace and bullet differences', () => {
    const text = 'Responsibilities\n• Reconcile   bank\naccounts daily\n';
    const s = locateSpan(text, 'Reconcile bank accounts daily')!;
    expect(text.slice(s.start, s.end).replace(/\s+/g, ' ')).toBe('Reconcile bank accounts daily');
    expect(locateSpan(text, 'not here')).toBeNull();
  });
  it('turns HTML lists into one bullet per line', () => {
    expect(htmlToText('&lt;ul&gt;&lt;li&gt;Apply cash&lt;/li&gt;&lt;li&gt;Bank recs &amp;amp; more&lt;/li&gt;&lt;/ul&gt;')).toBe('• Apply cash\n• Bank recs & more');
  });
  it('normalises titles and measures similarity', () => {
    expect(normaliseTitle('Staff Accountant (Remote - US)')).toBe('staff accountant');
    expect(textSimilarity('one two three four five six', 'one two three four five six')).toBe(1);
    expect(textSimilarity('one two three four five six', 'seven eight nine ten eleven twelve')).toBe(0);
  });
});

describe('dedupe', () => {
  const mk = (id: string, loc: string, salary: string): FilteredPosting => ({
    raw_id: id, company: 'Acme', domain: 'acme.com', ats: 'greenhouse', board_token: 'acme', source_job_id: id, title: 'Staff Accountant',
    locations: [loc], text: `${Array.from({ length: 300 }, (_, i) => `word${i}`).join(' ')}\nThe pay range is ${salary}.`,
    structured_salary: null, workplace: null, posted_at: '2026-10-01', updated_at: null, source_url: `https://x/${id}`, api_url: '', fetched_at: '',
    posting_id: postingId('Acme', 'Staff Accountant', `https://x/${id}`), merged_raw_ids: [id], extra_salary_lines: [], date_basis: 'posted_at', title_decision: 'rule',
  });
  it('merges near-identical postings and keeps every location salary line', () => {
    const { kept, merged } = dedupe([mk('1', 'New York, NY', '$90,000 - $110,000'), mk('2', 'Austin, TX', '$80,000 - $100,000')]);
    expect(merged).toBe(1);
    expect(kept).toHaveLength(1);
    expect(kept[0].locations).toEqual(['New York, NY', 'Austin, TX']);
    expect(kept[0].extra_salary_lines[0].line).toContain('$80,000');
  });
});

describe('salary source', () => {
  it('uses job-board pay only when the text has none', () => {
    const p = { structured_salary: { min: 70000, max: 90000, currency: 'USD', period: 'year' as const, summary: '$70K – $90K' } };
    expect(boardSalary(p)?.min).toBe(70000);
    expect(boardSalary({ structured_salary: { ...p.structured_salary, currency: 'CAD' } })).toBeNull();
    const fp = { posting_id: 'p', company: 'A', domain: 'a.com', title: 'T', locations: [], posted_at: null, updated_at: null, source_url: 'u', fetched_at: 'f', text: 't', extra_salary_lines: [], ats: 'ashby', ...p } as unknown as FilteredPosting;
    const out = { title: 'T', role_family: 'GL', seniority: 'mid', locations: [], remote: 'unknown', non_usd_salary: false, erp: [], tools: [], pain_phrases: [], duties: [],
      complexity: { multi_entity: false, multi_currency: false, usage_based_billing: false, high_volume: false, entity_count: null } } as const;
    const none = buildPosting(fp, { ...out, salary: { min: null, max: null, period: null, currency: null, raw_text: null } } as never);
    expect(none).toMatchObject({ salary_source: 'job_board', salary: { min: 70000 } });
    const text = buildPosting(fp, { ...out, salary: { min: 75000, max: null, period: 'year', currency: 'USD', raw_text: '$75,000' } } as never);
    expect(text).toMatchObject({ salary_source: 'posting_text', salary: { min: 75000 } });
  });
});

describe('fetch rules', () => {
  it('parses robots.txt for all agents', () => {
    expect(parseRobots('User-agent: *\nAllow: /\nDisallow: /knowledge-hub\n\nUser-agent: GPTBot\nDisallow: /')).toEqual(['/knowledge-hub']);
  });
  it('refuses LinkedIn, Indeed and Glassdoor', () => {
    expect(() => assertAllowedHost('https://www.linkedin.com/jobs/1')).toThrow();
    expect(() => assertAllowedHost('https://indeed.com/x')).toThrow();
    expect(() => assertAllowedHost('https://www.glassdoor.com/x')).toThrow();
    expect(() => assertAllowedHost('https://boards-api.greenhouse.io/v1/boards/x/jobs')).not.toThrow();
  });
});

describe('role and location rules', () => {
  it('keeps finance roles and drops interns, CFOs and look-alikes', () => {
    expect(classifyTitle('Staff Accountant')).toBe('keep');
    expect(classifyTitle('Accounts Payable Specialist')).toBe('keep');
    expect(classifyTitle('Finance Intern')).toBe('drop');
    expect(classifyTitle('Chief Financial Officer')).toBe('drop');
    expect(classifyTitle('Revenue Operations Manager')).toBe('drop');
    expect(classifyTitle('Medical Billing Specialist')).toBe('drop');
  });
  it('detects US locations', () => {
    expect(isUsLocation(['San Francisco, CA'])).toBe(true);
    expect(isUsLocation(['Remote - US'])).toBe(true);
    expect(isUsLocation(['London, UK'])).toBe(false);
    expect(isUsLocation(['Toronto, ON'])).toBe(false);
  });
  it('checks the company is named in a headline', () => {
    expect(headlineNamesCompany('Acme raises $40M Series C', 'Acme')).toBe(true);
    expect(headlineNamesCompany('Acmeville council meets', 'Acme')).toBe(false);
  });
});

describe('RSS parsing', () => {
  it('reads Google News style items', () => {
    const xml = `<?xml version="1.0"?><rss><channel><item><title>Acme acquires Beta - Reuters</title><link>https://news.example/1</link><pubDate>Tue, 01 Sep 2026 10:00:00 GMT</pubDate><source url="https://reuters.com">Reuters</source><description>&lt;a href="x"&gt;Acme acquires Beta&lt;/a&gt;</description></item></channel></rss>`;
    const [it] = parseFeed(xml);
    expect(it).toMatchObject({ title: 'Acme acquires Beta - Reuters', link: 'https://news.example/1', published: '2026-09-01', source: 'Reuters', snippet: 'Acme acquires Beta' });
  });
});
