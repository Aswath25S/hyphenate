/**
 * End-to-end plumbing test with a fake LLM transport: extract → match →
 * score → gaps → brief → publish on three fixture postings in a temp data dir.
 * Checks the M4 invariants: lead breakdowns add up, every uncovered duty sits in
 * exactly one gap theme, briefs pass the fact check, every number traces to ids.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { P } from '../pipeline/lib/paths';
import { setTransport, type Transport } from '../pipeline/lib/llm';
import { loadFixtures } from '../pipeline/lib/fixtures';
import { extract } from '../pipeline/stages/extract';
import { match } from '../pipeline/stages/match';
import { score } from '../pipeline/stages/score';
import { gaps } from '../pipeline/stages/gaps';
import { brief } from '../pipeline/stages/brief';
import { publish } from '../pipeline/stages/publish';
import { writeJson } from '../pipeline/lib/io';
import { fake } from './helpers/fakeLlm';

const original = { ...P };
let tmp: string;

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'btnh-int-'));
  for (const k of ['processed', 'extracted', 'matched', 'app', 'appPostings', 'cache', 'logs', 'rawSize'] as const) {
    (P as Record<string, string>)[k] = path.join(tmp, k === 'extracted' || k === 'matched' ? `processed/${k}` : k === 'appPostings' ? 'app/postings' : k);
  }
  process.env.OPENAI_API_KEY = 'test-key';
  setTransport(fake);
  const fixtures = loadFixtures().slice(0, 3);
  writeJson(path.join(P.processed, 'filtered.json'), fixtures.map((f) => f.input));
});

afterAll(() => {
  setTransport(null);
  delete process.env.OPENAI_API_KEY;
  Object.assign(P, original);
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('pipeline plumbing with a fake LLM', () => {
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
    for (const c of companies) expect(c.lead_parts.pain + c.lead_parts.fit).toBeCloseTo(c.lead_score);
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

  it('reruns are free: every LLM call is served from cache', async () => {
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
    expect(meta.cost_report.extract.input_tokens).toBe(3000);
    expect(meta.cost_report.extract.unpriced_calls).toBe(3); // no price configured for the default model
  });
});
