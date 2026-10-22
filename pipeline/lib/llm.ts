/**
 * LLM client (OpenAI): structured output via a strict JSON schema, cached by a
 * hash of the full input, validated with zod, retried once, usage logged per stage.
 */
import OpenAI from 'openai';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { LLM } from '../../config/scoring';
import { appendLine, ensureDir, sha256 } from './io';
import { P } from './paths';

export const MODEL = () => process.env.OPENAI_MODEL || LLM.defaultModel;

/** Bump to invalidate every cached response (e.g. after a breaking prompt change). */
const CACHE_VERSION = 'v2-openai';

const UNSUPPORTED_KEYS = new Set([
  '$schema', 'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'minLength', 'maxLength',
  'minItems', 'maxItems', 'pattern', 'format', 'multipleOf', 'default',
]);

/** zod → JSON schema for OpenAI strict structured outputs (bounds are checked by zod instead). */
export function toResponseSchema(schema: z.ZodType): Record<string, unknown> {
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node)) if (!UNSUPPORTED_KEYS.has(k)) out[k] = walk(v);
      if (out.type === 'object' && out.properties) {
        out.additionalProperties = false;
        out.required = Object.keys(out.properties as object);
      }
      return out;
    }
    return node;
  };
  return walk(z.toJSONSchema(schema)) as Record<string, unknown>;
}

export type Effort = 'low' | 'medium' | 'high';

export type LlmRequest<T> = {
  stage: string;
  system: string;
  user: string;
  /** Name of the JSON object the model returns (a-z, 0-9, underscores). */
  formatName: string;
  formatDescription: string;
  schema: z.ZodType<T>;
  /** Extra semantic checks after zod; return an error string to trigger a retry. */
  check?: (out: T) => string | null;
  maxTokens?: number;
  /** No cache, no content in logs. */
  ephemeral?: boolean;
  effort?: Effort;
};

export type LlmResult<T> =
  | { ok: true; data: T; cached: boolean; usage: Usage }
  | { ok: false; error: string; usage: Usage };

export type Usage = { input_tokens: number; output_tokens: number; cost_usd: number; calls: number };

/** Transport is swappable so tests can run without the network. */
export type Transport = (params: {
  model: string;
  system: string;
  user: string;
  format: { name: string; description: string; schema: Record<string, unknown> };
  maxTokens: number;
  effort: Effort;
}) => Promise<{ output: unknown | null; refusal: string | null; finishReason: string | null; input_tokens: number; output_tokens: number }>;

let client: OpenAI | null = null;
/** For tests: inject a client (e.g. one with a stub fetch). */
export function setClient(c: OpenAI | null) {
  client = c;
}

export function hasCredentials(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

/** Reasoning models take reasoning_effort; others reject it. */
function isReasoningModel(model: string): boolean {
  return /^(gpt-5|o\d)/.test(model) && !/chat/.test(model);
}

const openaiTransport: Transport = async ({ model, system, user, format, maxTokens, effort }) => {
  client ??= new OpenAI();
  const res = await client.chat.completions.create({
    model,
    max_completion_tokens: maxTokens,
    messages: [
      { role: 'developer', content: system },
      { role: 'user', content: user },
    ],
    response_format: { type: 'json_schema', json_schema: { name: format.name, description: format.description, schema: format.schema, strict: true } },
    ...(isReasoningModel(model) ? { reasoning_effort: effort } : {}),
  });
  const choice = res.choices[0];
  const content = choice?.message?.content ?? null;
  let output: unknown | null = null;
  if (content) {
    try { output = JSON.parse(content); } catch { output = null; }
  }
  return {
    output,
    refusal: choice?.message?.refusal ?? null,
    finishReason: choice?.finish_reason ?? null,
    input_tokens: res.usage?.prompt_tokens ?? 0,
    output_tokens: res.usage?.completion_tokens ?? 0,
  };
};

let transport: Transport = openaiTransport;
export function setTransport(t: Transport | null) {
  transport = t ?? openaiTransport;
}

/** USD for a call, or null when the model has no price in config/scoring.ts. */
function cost(model: string, inTok: number, outTok: number): number | null {
  const p = LLM.pricePerMTok[model];
  return p ? (inTok * p.input + outTok * p.output) / 1e6 : null;
}

function cachePath(stage: string, key: string) {
  return path.join(P.cache, stage, `${key}.json`);
}

export async function callLlm<T>(req: LlmRequest<T>): Promise<LlmResult<T>> {
  const model = MODEL();
  const format = { name: req.formatName, description: req.formatDescription, schema: toResponseSchema(req.schema) };
  const effort = req.effort ?? 'medium';
  const maxTokens = req.maxTokens ?? LLM.maxTokens;
  const key = sha256(JSON.stringify([CACHE_VERSION, model, effort, req.system, req.user, format]));
  const usage: Usage = { input_tokens: 0, output_tokens: 0, cost_usd: 0, calls: 0 };

  if (!req.ephemeral) {
    const file = cachePath(req.stage, key);
    if (fs.existsSync(file)) {
      const hit = JSON.parse(fs.readFileSync(file, 'utf8'));
      const parsed = req.schema.safeParse(hit.output);
      if (parsed.success && !req.check?.(parsed.data)) {
        logUsage(req.stage, model, 0, 0, true);
        return { ok: true, data: parsed.data, cached: true, usage };
      }
    }
  }

  let lastError = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const user =
      attempt === 0
        ? req.user
        : `${req.user}\n\n<previous_attempt_error>\nYour previous ${req.formatName} object was rejected: ${lastError.slice(0, 1500)}\nReturn a corrected ${req.formatName} object.\n</previous_attempt_error>`;
    let r;
    try {
      r = await transport({ model, system: req.system, user, format, maxTokens, effort });
    } catch (e) {
      lastError = e instanceof OpenAI.APIError ? `API ${e.status}: ${e.message}` : String((e as Error).message ?? e);
      // Non-retryable client errors (bad request, auth, unknown model) fail straight away.
      if (e instanceof OpenAI.APIError && e.status && e.status < 500 && e.status !== 429) break;
      continue;
    }
    usage.calls++;
    usage.input_tokens += r.input_tokens;
    usage.output_tokens += r.output_tokens;
    usage.cost_usd += cost(model, r.input_tokens, r.output_tokens) ?? 0;
    logUsage(req.stage, model, r.input_tokens, r.output_tokens, false);

    if (r.refusal) { lastError = `model refused: ${r.refusal.slice(0, 200)}`; continue; }
    if (r.finishReason === 'length') { lastError = 'output hit the token limit; be more concise'; continue; }
    if (r.output === null) { lastError = `no valid ${req.formatName} JSON in the response`; continue; }
    const parsed = req.schema.safeParse(r.output);
    if (!parsed.success) {
      lastError = parsed.error.issues.slice(0, 8).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      continue;
    }
    const semantic = req.check?.(parsed.data) ?? null;
    if (semantic) { lastError = semantic; continue; }
    if (!req.ephemeral) {
      const file = cachePath(req.stage, key);
      ensureDir(path.dirname(file));
      fs.writeFileSync(file, JSON.stringify({ key, model, created_at: new Date().toISOString(), output: parsed.data }, null, 2));
    }
    return { ok: true, data: parsed.data, cached: false, usage };
  }
  return { ok: false, error: lastError || 'unknown error', usage };
}

/** Token and dollar usage per stage. Never includes prompt content. */
function logUsage(stage: string, model: string, input_tokens: number, output_tokens: number, cached: boolean) {
  try {
    const c = cost(model, input_tokens, output_tokens);
    appendLine(path.join(P.logs, 'usage.jsonl'), {
      at: new Date().toISOString(), stage, model, cached, input_tokens, output_tokens,
      cost_usd: c === null ? null : Number(c.toFixed(6)),
    });
  } catch {
    /* read-only filesystem (e.g. serverless): usage logging is best-effort */
  }
}

/** Run async tasks with a concurrency cap. */
export async function pool<I, O>(items: I[], limit: number, fn: (item: I, idx: number) => Promise<O>): Promise<O[]> {
  const out: O[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}
