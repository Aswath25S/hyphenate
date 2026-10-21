/**
 * Claude client: tool-use structured output, cached by a hash of the full
 * input, validated with zod, retried once, usage logged per stage.
 */
import Anthropic from '@anthropic-ai/sdk';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { LLM } from '../../config/scoring';
import { appendLine, ensureDir, sha256 } from './io';
import { P } from './paths';

export const MODEL = () => process.env.ANTHROPIC_MODEL || LLM.defaultModel;

/** Bump to invalidate every cached response (e.g. after a breaking prompt change). */
const CACHE_VERSION = 'v1';

const UNSUPPORTED_KEYS = new Set([
  '$schema', 'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'minLength', 'maxLength',
  'minItems', 'maxItems', 'pattern', 'format', 'multipleOf', 'default',
]);

/** zod → JSON schema suitable for a strict tool (bounds are checked by zod instead). */
export function toToolSchema(schema: z.ZodType): Record<string, unknown> {
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

export type ToolCallRequest<T> = {
  stage: string;
  system: string;
  user: string;
  toolName: string;
  toolDescription: string;
  schema: z.ZodType<T>;
  /** Extra semantic checks after zod; return an error string to trigger a retry. */
  check?: (out: T) => string | null;
  maxTokens?: number;
  /** Live demo: no cache, no content in logs. */
  ephemeral?: boolean;
  effort?: 'low' | 'medium' | 'high';
};

export type ToolCallResult<T> =
  | { ok: true; data: T; cached: boolean; usage: Usage }
  | { ok: false; error: string; usage: Usage };

export type Usage = { input_tokens: number; output_tokens: number; cost_usd: number; calls: number };

/** Transport is swappable so tests can run without the network. */
export type Transport = (params: {
  model: string;
  system: string;
  user: string;
  tool: { name: string; description: string; input_schema: Record<string, unknown> };
  maxTokens: number;
  effort: 'low' | 'medium' | 'high';
}) => Promise<{ toolInput: unknown | null; text: string; stopReason: string | null; input_tokens: number; output_tokens: number }>;

let client: Anthropic | null = null;

export function hasCredentials(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

const anthropicTransport: Transport = async ({ model, system, user, tool, maxTokens, effort }) => {
  client ??= new Anthropic();
  const useFallbacks = (process.env.ANTHROPIC_FALLBACKS ?? 'default') !== 'off';
  const res = await client.beta.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    // Forced tool_choice is rejected on current models: use auto + strict + an explicit instruction.
    tools: [{ ...tool, strict: true } as Anthropic.Beta.BetaTool],
    tool_choice: { type: 'auto', disable_parallel_tool_use: true },
    output_config: { effort },
    messages: [{ role: 'user', content: user }],
    ...(useFallbacks ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
  });
  const toolBlock = res.content.find((b) => b.type === 'tool_use' && b.name === tool.name);
  const text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  return {
    toolInput: toolBlock && toolBlock.type === 'tool_use' ? toolBlock.input : null,
    text,
    stopReason: res.stop_reason,
    input_tokens: res.usage.input_tokens + (res.usage.cache_read_input_tokens ?? 0) + (res.usage.cache_creation_input_tokens ?? 0),
    output_tokens: res.usage.output_tokens,
  };
};

let transport: Transport = anthropicTransport;
export function setTransport(t: Transport | null) {
  transport = t ?? anthropicTransport;
}

function cost(model: string, inTok: number, outTok: number): number {
  const p = LLM.pricePerMTok[model] ?? LLM.pricePerMTok[LLM.defaultModel];
  return (inTok * p.input + outTok * p.output) / 1e6;
}

function cachePath(stage: string, key: string) {
  return path.join(P.cache, stage, `${key}.json`);
}

export async function callTool<T>(req: ToolCallRequest<T>): Promise<ToolCallResult<T>> {
  const model = MODEL();
  const input_schema = toToolSchema(req.schema);
  const tool = { name: req.toolName, description: req.toolDescription, input_schema };
  const effort = req.effort ?? 'medium';
  const maxTokens = req.maxTokens ?? LLM.maxTokens;
  const key = sha256(JSON.stringify([CACHE_VERSION, model, effort, req.system, req.user, tool]));
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
        : `${req.user}\n\n<previous_attempt_error>\nYour previous ${req.toolName} call was rejected: ${lastError.slice(0, 1500)}\nCall ${req.toolName} again with corrected input.\n</previous_attempt_error>`;
    let r;
    try {
      r = await transport({ model, system: req.system, user, tool, maxTokens, effort });
    } catch (e) {
      lastError = e instanceof Anthropic.APIError ? `API ${e.status}: ${e.message}` : String((e as Error).message ?? e);
      // Non-retryable client errors (bad request, auth) fail straight away.
      if (e instanceof Anthropic.APIError && e.status && e.status < 500 && e.status !== 429) break;
      continue;
    }
    usage.calls++;
    usage.input_tokens += r.input_tokens;
    usage.output_tokens += r.output_tokens;
    usage.cost_usd += cost(model, r.input_tokens, r.output_tokens);
    logUsage(req.stage, model, r.input_tokens, r.output_tokens, false);

    if (r.stopReason === 'refusal') { lastError = 'model declined (refusal)'; continue; }
    if (r.stopReason === 'max_tokens') { lastError = 'output hit max_tokens; be more concise'; continue; }
    if (r.toolInput === null) { lastError = `no ${req.toolName} tool call in the response`; continue; }
    const parsed = req.schema.safeParse(r.toolInput);
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
    appendLine(path.join(P.logs, 'usage.jsonl'), {
    at: new Date().toISOString(), stage, model, cached, input_tokens, output_tokens,
      cost_usd: Number(cost(model, input_tokens, output_tokens).toFixed(6)),
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
