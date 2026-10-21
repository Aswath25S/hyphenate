/** Stage 4: the LLM labels each scored duty against the coverage map. */
import path from 'node:path';
import fs from 'node:fs';
import { ensureDir, listJson, readJson, writeJson } from '../lib/io';
import { P } from '../lib/paths';
import { callLlm, hasCredentials, pool } from '../lib/llm';
import { loadCoverage, coverageIndex, type CoverageMap } from '../lib/coverage';
import { MATCH_PROMPT_VERSION, MATCH_TOOL, checkMatch, finaliseLabels, matchSchema, matchSystem, matchUser, type FinalLabel } from '../prompts/match';
import { recordStage } from '../lib/stats';
import type { Posting } from '../../lib/schemas';
import type { MatchedPosting } from '../lib/types';

export function scoredDuties(p: Pick<Posting, 'duties'>) {
  return p.duties.filter((d) => !d.is_boilerplate && !d.is_requirement);
}

export async function matchOne(p: Pick<Posting, 'duties' | 'title' | 'role_family'>, coverage: CoverageMap, opts: { ephemeral?: boolean; stage?: string; effort?: 'low' | 'medium' | 'high' } = {}) {
  const duties = scoredDuties(p);
  const idx = coverageIndex(coverage);
  if (!duties.length) return { ok: true as const, labels: [] as FinalLabel[], cost: 0 };
  const res = await callLlm({
    stage: opts.stage ?? 'match',
    effort: opts.effort,
    system: matchSystem(coverage.capabilities),
    user: matchUser(duties, { title: p.title, role_family: p.role_family }),
    formatName: MATCH_TOOL.name,
    formatDescription: MATCH_TOOL.description,
    schema: matchSchema,
    check: (out) => checkMatch(out, duties.map((d) => d.duty_id), idx.ids),
    ephemeral: opts.ephemeral,
    maxTokens: 16000,
  });
  if (!res.ok) return { ok: false as const, error: res.error, cost: res.usage.cost_usd };
  const order = new Map(duties.map((d, i) => [d.duty_id, i]));
  const labels = finaliseLabels(res.data.labels, idx.levels).sort((a, b) => (order.get(a.duty_id) ?? 0) - (order.get(b.duty_id) ?? 0));
  return { ok: true as const, labels, cost: res.usage.cost_usd };
}

export async function match() {
  if (!hasCredentials()) throw new Error('match needs OPENAI_API_KEY.');
  const coverage = loadCoverage();
  const files = listJson(P.extracted);
  ensureDir(P.matched);
  const failures: { posting_id: string; error: string }[] = [];
  let ok = 0;
  let cost = 0;
  await pool(files, 4, async (f) => {
    const p = readJson<Posting>(f);
    const res = await matchOne(p, coverage);
    cost += res.cost;
    if (!res.ok) { failures.push({ posting_id: p.posting_id, error: res.error }); console.log(`  ✗ ${p.company} — ${p.title}: ${res.error.slice(0, 120)}`); return; }
    const out: MatchedPosting = { posting_id: p.posting_id, prompt_version: MATCH_PROMPT_VERSION, labels: res.labels };
    writeJson(path.join(P.matched, `${p.posting_id}.json`), out);
    ok++;
  });
  const live = new Set(files.map((f) => path.basename(f)));
  for (const f of fs.readdirSync(P.matched)) if (!live.has(f)) fs.unlinkSync(path.join(P.matched, f));
  writeJson(path.join(P.processed, 'match_failures.json'), failures);
  recordStage({ stage: 'match', in: files.length, out: ok, failed: failures.length, notes: [`new spend $${cost.toFixed(2)}`] });
}
