import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { P } from '../pipeline/lib/paths';
import { setTransport } from '../pipeline/lib/claude';
import { resetLimits } from '../lib/ratelimit';
import { POST } from '../app/api/analyze/route';
import { loadFixtures } from '../pipeline/lib/fixtures';
import { fake } from './helpers/fakeClaude';

const original = { ...P };
let tmp: string;
const sample = loadFixtures().find((f) => f.fixture_id === 'liquid-death-accounting-clerk')!.input.text;
const SECRET = 'ZEBRA-SECRET-MARKER-91';

function req(body: unknown, ip = '1.2.3.4') {
  return new Request('http://localhost/api/analyze', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify(body) });
}
async function events(res: Response) {
  return (await res.text()).trim().split('\n').map((l) => JSON.parse(l));
}

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'btnh-live-'));
  (P as Record<string, string>).cache = path.join(tmp, 'cache');
  (P as Record<string, string>).logs = path.join(tmp, 'logs');
  process.env.ANTHROPIC_API_KEY = 'test-key';
  setTransport(fake);
});
afterAll(() => {
  setTransport(null);
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.LIVE_DEMO_DAILY_LIMIT;
  Object.assign(P, original);
  fs.rmSync(tmp, { recursive: true, force: true });
});
beforeEach(() => resetLimits());

describe('/api/analyze', () => {
  it('streams the four steps then a scored result', async () => {
    const res = await POST(req({ text: `${sample}\n${SECRET}`, company: 'Acme', title: 'AP Clerk' }));
    expect(res.status).toBe(200);
    const ev = await events(res);
    expect(ev.filter((e) => e.step).map((e) => e.step)).toEqual(['reading', 'splitting', 'matching', 'pricing']);
    const { result } = ev.find((e) => e.result);
    expect(result.n).toBeGreaterThan(0);
    expect(result.duties.every((d: { span: unknown; scored: boolean }) => !d.scored || d.span)).toBe(true);
    expect(result.salary_min).toBe(62400); // $30/hr × 2,080
  });

  it('never stores or logs the pasted text', () => {
    expect(fs.existsSync(P.cache)).toBe(false);
    const log = fs.readFileSync(path.join(P.logs, 'usage.jsonl'), 'utf8');
    expect(log).toContain('"stage":"live"');
    expect(log).not.toContain(SECRET);
  });

  it('validates input length', async () => {
    expect((await POST(req({ text: 'too short' }))).status).toBe(400);
    expect((await POST(req({ text: 'x'.repeat(20001) }))).status).toBe(400);
  });

  it('enforces 10 requests per IP per hour', async () => {
    for (let i = 0; i < 10; i++) expect((await POST(req({ text: sample }, '9.9.9.9'))).status).toBe(200);
    const blocked = await POST(req({ text: sample }, '9.9.9.9'));
    expect(blocked.status).toBe(429);
    expect((await POST(req({ text: sample }, '8.8.8.8'))).status).toBe(200);
  });

  it('enforces the daily limit', async () => {
    process.env.LIVE_DEMO_DAILY_LIMIT = '2';
    expect((await POST(req({ text: sample }, 'a'))).status).toBe(200);
    expect((await POST(req({ text: sample }, 'b'))).status).toBe(200);
    expect((await POST(req({ text: sample }, 'c'))).status).toBe(429);
    delete process.env.LIVE_DEMO_DAILY_LIMIT;
  });

  it('can be switched off', async () => {
    process.env.LIVE_DEMO_ENABLED = 'false';
    expect((await POST(req({ text: sample }))).status).toBe(503);
    delete process.env.LIVE_DEMO_ENABLED;
  });
});
