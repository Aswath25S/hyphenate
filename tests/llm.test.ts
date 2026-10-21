import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import { P } from '../pipeline/lib/paths';
import { callLlm, setTransport, toResponseSchema, type Transport } from '../pipeline/lib/llm';

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

const req = (user = 'hello') => ({ stage: 'test', system: 'sys', user, formatName: 't', formatDescription: 'd', schema });
const reply = (output: unknown): Awaited<ReturnType<Transport>> => ({ output, refusal: null, finishReason: 'stop', input_tokens: 100, output_tokens: 20 });

describe('toResponseSchema', () => {
  it('strips unsupported keywords and requires every property', () => {
    const s = toResponseSchema(schema) as { properties: Record<string, Record<string, unknown>>; required: string[]; additionalProperties: boolean; $schema?: string };
    expect(s.$schema).toBeUndefined();
    expect(s.additionalProperties).toBe(false);
    expect(s.required).toEqual(['value', 'name', 'maybe']);
    expect(s.properties.value.minimum).toBeUndefined();
  });
});

describe('callLlm', () => {
  it('validates, caches and serves the cache on rerun', async () => {
    let calls = 0;
    setTransport(async () => { calls++; return reply({ value: 0.5, name: 'x', maybe: null }); });
    const a = await callLlm(req());
    const b = await callLlm(req());
    expect(a.ok && a.cached).toBe(false);
    expect(b.ok && b.cached).toBe(true);
    expect(calls).toBe(1);
  });
  it('retries once on a schema failure, then succeeds', async () => {
    const users: string[] = [];
    setTransport(async ({ user }) => { users.push(user); return users.length === 1 ? reply({ value: 7, name: 'x', maybe: null }) : reply({ value: 0.7, name: 'x', maybe: null }); });
    const r = await callLlm(req('again'));
    expect(r.ok).toBe(true);
    expect(users).toHaveLength(2);
    expect(users[1]).toContain('previous_attempt_error');
  });
  it('fails after the one retry and caches nothing', async () => {
    let calls = 0;
    setTransport(async () => { calls++; return reply({ nope: true }); });
    const r = await callLlm(req('bad'));
    expect(r.ok).toBe(false);
    expect(calls).toBe(2);
    expect(fs.existsSync(path.join(P.cache, 'test'))).toBe(false);
  });
  it('retries when the semantic check fails', async () => {
    let calls = 0;
    setTransport(async () => { calls++; return reply({ value: 0.1, name: calls === 1 ? 'bad' : 'good', maybe: null }); });
    const r = await callLlm({ ...req('check'), check: (o: z.infer<typeof schema>) => (o.name === 'bad' ? 'name is bad' : null) });
    expect(r.ok && r.data.name).toBe('good');
  });
  it('treats missing or unparseable JSON as a failure', async () => {
    setTransport(async () => ({ output: null, refusal: null, finishReason: 'stop', input_tokens: 1, output_tokens: 1 }));
    const r = await callLlm(req('none'));
    expect(r.ok).toBe(false);
  });
  it('treats a refusal as a failure and retries once', async () => {
    let calls = 0;
    setTransport(async () => { calls++; return { output: null, refusal: 'I cannot help with that.', finishReason: 'stop', input_tokens: 1, output_tokens: 1 }; });
    const r = await callLlm(req('refuse'));
    expect(r.ok).toBe(false);
    expect(calls).toBe(2);
  });
  it('ephemeral calls never write the cache', async () => {
    setTransport(async () => reply({ value: 0.5, name: 'x', maybe: null }));
    await callLlm({ ...req('secret posting text'), ephemeral: true });
    expect(fs.existsSync(path.join(P.cache, 'test'))).toBe(false);
    const log = fs.readFileSync(path.join(P.logs, 'usage.jsonl'), 'utf8');
    expect(log).not.toContain('secret posting text');
  });
});

describe('OpenAI transport (real SDK, stubbed network)', () => {
  it('sends a strict json_schema request and parses the reply', async () => {
    const { default: OpenAI } = await import('openai');
    const { setClient } = await import('../pipeline/lib/llm');
    let sent: Record<string, any> = {};
    let url = '';
    const stubFetch = async (input: any, init?: any) => {
      url = String(input);
      sent = JSON.parse(init.body);
      return new Response(JSON.stringify({
        id: 'chatcmpl-1', object: 'chat.completion', created: 0, model: sent.model,
        choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify({ value: 0.4, name: 'ok', maybe: null }), refusal: null } }],
        usage: { prompt_tokens: 120, completion_tokens: 30, total_tokens: 150 },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    };
    setClient(new OpenAI({ apiKey: 'sk-test', fetch: stubFetch as any, maxRetries: 0 }));
    setTransport(null);
    process.env.OPENAI_MODEL = 'gpt-5.5';
    const r = await callLlm({ ...req('real transport'), effort: 'low', maxTokens: 999 });
    delete process.env.OPENAI_MODEL;
    setClient(null);
    expect(url).toContain('/chat/completions');
    expect(sent.model).toBe('gpt-5.5');
    expect(sent.reasoning_effort).toBe('low');
    expect(sent.max_completion_tokens).toBe(999);
    expect(sent.messages[0]).toEqual({ role: 'developer', content: 'sys' });
    expect(sent.response_format.type).toBe('json_schema');
    expect(sent.response_format.json_schema).toMatchObject({ name: 't', strict: true });
    expect(sent.response_format.json_schema.schema.additionalProperties).toBe(false);
    expect(sent.temperature).toBeUndefined();
    expect(r.ok && r.data).toEqual({ value: 0.4, name: 'ok', maybe: null });
    expect(r.usage.input_tokens).toBe(120);
  });

  it('omits reasoning_effort for non-reasoning models', async () => {
    const { default: OpenAI } = await import('openai');
    const { setClient } = await import('../pipeline/lib/llm');
    let sent: Record<string, any> = {};
    const stubFetch = async (_: any, init?: any) => {
      sent = JSON.parse(init.body);
      return new Response(JSON.stringify({ id: 'x', object: 'chat.completion', created: 0, model: sent.model, choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: '{"value":0.1,"name":"n","maybe":null}', refusal: null } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }), { status: 200, headers: { 'content-type': 'application/json' } });
    };
    setClient(new OpenAI({ apiKey: 'sk-test', fetch: stubFetch as any, maxRetries: 0 }));
    setTransport(null);
    process.env.OPENAI_MODEL = 'gpt-4.1';
    await callLlm(req('non-reasoning'));
    delete process.env.OPENAI_MODEL;
    setClient(null);
    expect(sent.reasoning_effort).toBeUndefined();
  });
});
