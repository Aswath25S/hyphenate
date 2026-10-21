/**
 * End-to-end plumbing test with a fake Claude transport: extract → match →
 * score → gaps → brief → publish on three fixture postings in a temp data dir.
 * Checks the M4 invariants: lead breakdowns add up, every uncovered duty sits in
 * exactly one gap theme, briefs pass the fact check, every number traces to ids.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { P } from '../pipeline/lib/paths';
import { setTransport, type Transport } from '../pipeline/lib/claude';
import { loadFixtures } from '../pipeline/lib/fixtures';
import { extract } from '../pipeline/stages/extract';
import { match } from '../pipeline/stages/match';
import { score } from '../pipeline/stages/score';
import { gaps } from '../pipeline/stages/gaps';
import { brief } from '../pipeline/stages/brief';
import { publish } from '../pipeline/stages/publish';
import { writeJson } from '../pipeline/lib/io';

const original = { ...P };
let tmp: string;

/** Deterministic stand-in for Claude. */
const fake: Transport = async ({ tool, user }) => {
  const usage = { text: '', stopReason: 'tool_use', input_tokens: 1000, output_tokens: 200 };
  if (tool.name === 'record_posting') {
    const text = user.split('<posting>\n')[1].split('\n</posting>')[0];
    const bullets = text.split('\n').filter((l) => /^(•|-)\s+\S/.test(l.trim())).map((l) => l.trim().replace(/^(•|-)\s+/, '')).slice(0, 14);
    const sal = text.match(/\$\s?(\d[\d,]*)(?:\.\d+)?\s*(?:-|–|—|to)\s*\$?\s?(\d[\d,]*)/);
    const toN = (s: string) => Number(s.replace(/,/g, ''));
    return {
      ...usage,
      toolInput: {
        title: 'X', role_family: 'AR', seniority: 'mid', locations: [], remote: 'unknown', non_usd_salary: false,
        salary: sal ? { min: toN(sal[1]), max: toN(sal[2]), period: toN(sal[1]) < 500 ? 'hour' : 'year', currency: 'USD', raw_text: sal[0] } : { min: null, max: null, period: null, currency: null, raw_text: null },
        erp: /netsuite/i.test(text) ? ['NetSuite'] : [], tools: [],
        complexity: { multi_entity: /multi-entity|entities/i.test(text), multi_currency: /currenc/i.test(text), usage_based_billing: false, high_volume: /volume/i.test(text), entity_count: null },
        pain_phrases: [],
        duties: bullets.map((b, i) => ({ text: b.slice(0, 80), source_span: b, is_boilerplate: false, is_requirement: i >= 10 })),
      },
    };
  }
  if (tool.name === 'record_labels') {
    const ids = [...user.matchAll(/^([a-f0-9]{16}-\d{2})\t/gm)].map((m) => m[1]);
    const cycle = [
      ['covered', 'o2c.collections'], ['assisted', 'gl.journal_entries'], ['human', null], ['gap_candidate', null], ['covered', 'tre.bank_rec'], ['unclear', null],
    ] as const;
    return { ...usage, toolInput: { labels: ids.map((id, i) => ({ duty_id: id, label: cycle[i % 6][0], capability_id: cycle[i % 6][1], confidence: 0.9, rationale: 'fake' })) } };
  }
  if (tool.name === 'record_canonical_tasks') {
    const items = [...user.matchAll(/^(\S+)\t(.*)$/gm)].map((m) => ({ duty_id: m[1], canonical: m[2].toLowerCase().split(' ').slice(0, 3).join(' ') }));
    return { ...usage, toolInput: { items } };
  }
  if (tool.name === 'record_themes') {
    const n = Number(user.match(/count="(\d+)"/)![1]);
    const themes = Array.from({ length: 15 }, (_, t) => ({
      theme_id: `t${t}`, name: `Theme ${t}`, description: 'd', bucket: t % 3 === 0 ? 'human_work' : t % 3 === 1 ? 'possible_gap' : 'unclear',
      task_ids: Array.from({ length: n }, (_, i) => i).filter((i) => i % 15 === t),
    }));
    return { ...usage, toolInput: { themes } };
  }
  if (tool.name === 'record_brief') {
    const data = JSON.parse(user.split('<data>\n')[1].split('\n</data>')[0]);
    return {
      ...usage,
      toolInput: {
        headline: `${data.company} is hiring for finance work.`, why_them: `Average overlap is ${data.average_overlap}.`,
        why_now: 'No recent trigger event found.', lead_with: `${data.lead_product}.`,
        minimum_savings: data.minimum_savings ? `It is ${data.minimum_savings}.` : 'No salary posted, so no figure.',
        may_not_cover: 'None found.', angle: 'Hire after the agents take the routine work.',
      },
    };
  }
  return { ...usage, toolInput: null };
};

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'btnh-int-'));
  for (const k of ['processed', 'extracted', 'matched', 'app', 'appPostings', 'cache', 'logs', 'rawNews'] as const) {
    (P as Record<string, string>)[k] = path.join(tmp, k === 'extracted' || k === 'matched' ? `processed/${k}` : k === 'appPostings' ? 'app/postings' : k);
  }
  process.env.ANTHROPIC_API_KEY = 'test-key';
  setTransport(fake);
  const fixtures = loadFixtures().slice(0, 3);
  writeJson(path.join(P.processed, 'filtered.json'), fixtures.map((f) => f.input));
});

afterAll(() => {
  setTransport(null);
  delete process.env.ANTHROPIC_API_KEY;
  Object.assign(P, original);
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('pipeline plumbing with a fake Claude', () => {
  it('runs extract → match → score → gaps → brief → publish', async () => {
    await extract();
    await match();
    await score();
    await gaps();
    await brief(new Date('2026-10-20T12:00:00Z'));
    await publish({ asOf: new Date('2026-10-20T12:00:00Z') });
    for (const f of ['postings.json', 'companies.json', 'gaps.json', 'meta.json']) expect(fs.existsSync(path.join(P.app, f))).toBe(true);
  }, 30000);

  it('lead score breakdowns add up', () => {
    const companies = JSON.parse(fs.readFileSync(path.join(P.app, 'companies.json'), 'utf8'));
    expect(companies.length).toBe(3);
    for (const c of companies) expect(c.lead_parts.pain + c.lead_parts.fit + c.lead_parts.timing).toBeCloseTo(c.lead_score);
  });

  it('every uncovered duty sits in exactly one gap theme', () => {
    const { themes } = JSON.parse(fs.readFileSync(path.join(P.app, 'gaps.json'), 'utf8'));
    const ids = themes.flatMap((t: { duty_ids: string[] }) => t.duty_ids);
    expect(new Set(ids).size).toBe(ids.length);
    const postings = fs.readdirSync(P.appPostings).map((f) => JSON.parse(fs.readFileSync(path.join(P.appPostings, f), 'utf8')));
    const uncovered = postings.flatMap((p) => p.duties.filter((d: { label: string }) => ['human', 'gap_candidate', 'unclear'].includes(d.label)).map((d: { duty_id: string }) => d.duty_id));
    expect(ids.sort()).toEqual(uncovered.sort());
  });

  it('briefs pass the fact check and savings trace to posting ids', () => {
    const companies = JSON.parse(fs.readFileSync(path.join(P.app, 'companies.json'), 'utf8'));
    expect(companies.filter((c: { brief: unknown }) => c.brief).length).toBe(3);
    const postings = JSON.parse(fs.readFileSync(path.join(P.app, 'postings.json'), 'utf8'));
    for (const c of companies) {
      const sum = postings.filter((p: { posting_id: string }) => c.posting_ids.includes(p.posting_id)).reduce((a: number, p: { savings: number | null }) => a + (p.savings ?? 0), 0);
      expect(sum).toBeCloseTo(c.savings_total);
    }
  });

  it('reruns are free: every Claude call is served from cache', async () => {
    let calls = 0;
    setTransport(async (p) => { calls++; return fake(p); });
    await extract();
    await match();
    expect(calls).toBe(0);
    setTransport(fake);
  });

  it('logs token usage per stage', () => {
    const meta = JSON.parse(fs.readFileSync(path.join(P.app, 'meta.json'), 'utf8'));
    expect(meta.cost_report.extract.calls).toBe(3);
    expect(meta.cost_report.extract.cost_usd).toBeGreaterThan(0);
  });
});
