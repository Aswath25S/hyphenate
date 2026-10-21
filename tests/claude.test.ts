import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import { P } from '../pipeline/lib/paths';
import { callTool, setTransport, toToolSchema, type Transport } from '../pipeline/lib/claude';

const schema = z.object({ value: z.number().min(0).max(1), name: z.string().min(1), maybe: z.string().nullable() });
let tmp: string;
const origCache = P.cache;
const origLogs = P.logs;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'btnh-'));
  (P as { cache: string }).cache = path.join(tmp, 'cache');
  (P as { logs: string }).logs = path.join(tmp, 'logs');
});
afterEach(() => {
  setTransport(null);
  (P as { cache: string }).cache = origCache;
  (P as { logs: string }).logs = origLogs;
  fs.rmSync(tmp, { recursive: true, force: true });
});

const req = (user = 'hello') => ({ stage: 'test', system: 'sys', user, toolName: 't', toolDescription: 'd', schema });
const reply = (toolInput: unknown): Awaited<ReturnType<Transport>> => ({ toolInput, text: '', stopReason: 'tool_use', input_tokens: 100, output_tokens: 20 });

describe('toToolSchema', () => {
  it('strips unsupported keywords and requires every property', () => {
    const s = toToolSchema(schema) as { properties: Record<string, Record<string, unknown>>; required: string[]; additionalProperties: boolean; $schema?: string };
    expect(s.$schema).toBeUndefined();
    expect(s.additionalProperties).toBe(false);
    expect(s.required).toEqual(['value', 'name', 'maybe']);
    expect(s.properties.value.minimum).toBeUndefined();
  });
});

describe('callTool', () => {
  it('validates, caches and serves the cache on rerun', async () => {
    let calls = 0;
    setTransport(async () => { calls++; return reply({ value: 0.5, name: 'x', maybe: null }); });
    const a = await callTool(req());
    const b = await callTool(req());
    expect(a.ok && a.cached).toBe(false);
    expect(b.ok && b.cached).toBe(true);
    expect(calls).toBe(1);
  });
  it('retries once on a schema failure, then succeeds', async () => {
    const users: string[] = [];
    setTransport(async ({ user }) => { users.push(user); return users.length === 1 ? reply({ value: 7, name: 'x', maybe: null }) : reply({ value: 0.7, name: 'x', maybe: null }); });
    const r = await callTool(req('again'));
    expect(r.ok).toBe(true);
    expect(users).toHaveLength(2);
    expect(users[1]).toContain('previous_attempt_error');
  });
  it('fails after the one retry and caches nothing', async () => {
    let calls = 0;
    setTransport(async () => { calls++; return reply({ nope: true }); });
    const r = await callTool(req('bad'));
    expect(r.ok).toBe(false);
    expect(calls).toBe(2);
    expect(fs.existsSync(path.join(P.cache, 'test'))).toBe(false);
  });
  it('retries when the semantic check fails', async () => {
    let calls = 0;
    setTransport(async () => { calls++; return reply({ value: 0.1, name: calls === 1 ? 'bad' : 'good', maybe: null }); });
    const r = await callTool({ ...req('check'), check: (o: z.infer<typeof schema>) => (o.name === 'bad' ? 'name is bad' : null) });
    expect(r.ok && r.data.name).toBe('good');
  });
  it('treats a missing tool call as a failure', async () => {
    setTransport(async () => ({ toolInput: null, text: 'prose', stopReason: 'end_turn', input_tokens: 1, output_tokens: 1 }));
    const r = await callTool(req('none'));
    expect(r.ok).toBe(false);
  });
  it('ephemeral calls never write the cache', async () => {
    setTransport(async () => reply({ value: 0.5, name: 'x', maybe: null }));
    await callTool({ ...req('secret posting text'), ephemeral: true });
    expect(fs.existsSync(path.join(P.cache, 'test'))).toBe(false);
    const log = fs.readFileSync(path.join(P.logs, 'usage.jsonl'), 'utf8');
    expect(log).not.toContain('secret posting text');
  });
});
