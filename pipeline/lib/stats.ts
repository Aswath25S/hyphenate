import path from 'node:path';
import { readJson, writeJson } from './io';
import { P } from './paths';

export type StageStat = { stage: string; at: string; in: number; out: number; failed?: number; notes?: string[] };

/** Stage snapshots: record counts in and out so silent drops are caught. */
export function recordStage(s: Omit<StageStat, 'at'>) {
  const file = path.join(P.processed, 'stage_stats.json');
  const all = readJson<Record<string, StageStat>>(file, {});
  all[s.stage] = { ...s, at: new Date().toISOString() };
  writeJson(file, all);
  const extra = s.failed ? `, ${s.failed} failed` : '';
  console.log(`[${s.stage}] in ${s.in} → out ${s.out}${extra}`);
  for (const n of s.notes ?? []) console.log(`  · ${n}`);
}
