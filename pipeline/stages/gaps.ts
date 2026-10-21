/** Stage 7: normalise and cluster uncovered duties into gap themes. */
import path from 'node:path';
import { GAPS, OVERLAP } from '../../config/scoring';
import { listJson, readJson, writeJson } from '../lib/io';
import { P } from '../lib/paths';
import { callTool, hasCredentials } from '../lib/claude';
import { loadCoverage } from '../lib/coverage';
import { CLUSTER_TOOL, NORMALISE_SYSTEM, NORMALISE_TOOL, checkClusters, clusterSchema, clusterSystem, clusterUser, normaliseSchema, normaliseUser } from '../prompts/gaps';
import { recordStage } from '../lib/stats';
import type { ExtractedPosting, MatchedPosting } from '../lib/types';
import type { PostingScore } from './score';
import type { GapBucket, Label } from '../../lib/schemas';

export type GapDuty = { duty_id: string; posting_id: string; domain: string; company: string; role_family: string; label: Label; text: string; source_span: string; canonical?: string };

export type GapTheme = {
  theme_id: string; name: string; description: string; bucket: GapBucket;
  duty_ids: string[]; canonical_tasks: string[];
  metrics: {
    postings: number; companies: number; share_strong_leads: number; strong_postings_with_theme: number; strong_postings_total: number;
    salary_attached: number; salary_postings: number; roles: string[];
  };
  posting_ids: string[]; company_domains: string[];
  examples: { duty_id: string; posting_id: string; company: string; source_span: string }[];
};

const UNCOVERED: Label[] = ['gap_candidate', 'human', 'unclear'];

export function collectGapDuties(postings: ExtractedPosting[], matched: Map<string, MatchedPosting>): GapDuty[] {
  const out: GapDuty[] = [];
  for (const p of postings) {
    const m = matched.get(p.posting_id);
    if (!m) continue;
    const dutyById = new Map(p.duties.map((d) => [d.duty_id, d]));
    for (const l of m.labels) {
      if (!UNCOVERED.includes(l.label)) continue;
      const d = dutyById.get(l.duty_id);
      if (!d) continue;
      out.push({ duty_id: d.duty_id, posting_id: p.posting_id, domain: p.domain, company: p.company, role_family: p.role_family, label: l.label, text: d.text, source_span: d.source_span });
    }
  }
  return out;
}

/** Deterministic metrics for a set of member duties. */
export function themeMetrics(dutyIds: string[], duties: Map<string, GapDuty>, scored: Map<string, PostingScore>) {
  const members = dutyIds.map((id) => duties.get(id)!).filter(Boolean);
  const postingIds = [...new Set(members.map((d) => d.posting_id))];
  const domains = [...new Set(members.map((d) => d.domain))];
  const strongTotal = [...scored.values()].filter((p) => p.overlap >= OVERLAP.strongLeadOverlap);
  const strongWith = postingIds.filter((id) => (scored.get(id)?.overlap ?? 0) >= OVERLAP.strongLeadOverlap);
  let salary = 0;
  let salaryPostings = 0;
  for (const id of postingIds) {
    const p = scored.get(id);
    if (!p || p.salary.min === null || p.thin || p.n === 0) continue;
    const k = members.filter((d) => d.posting_id === id).length;
    salary += (p.salary.min * k) / p.n;
    salaryPostings++;
  }
  // Examples: one per company first, up to the cap.
  const examples: GapTheme['examples'] = [];
  const usedCompanies = new Set<string>();
  for (const pass of [0, 1])
    for (const d of members) {
      if (examples.length >= GAPS.maxExamplePhrases) break;
      if (examples.some((e) => e.duty_id === d.duty_id)) continue;
      if (pass === 0 && usedCompanies.has(d.domain)) continue;
      usedCompanies.add(d.domain);
      examples.push({ duty_id: d.duty_id, posting_id: d.posting_id, company: d.company, source_span: d.source_span });
    }
  return {
    metrics: {
      postings: postingIds.length, companies: domains.length,
      share_strong_leads: strongTotal.length ? strongWith.length / strongTotal.length : 0,
      strong_postings_with_theme: strongWith.length, strong_postings_total: strongTotal.length,
      salary_attached: salary, salary_postings: salaryPostings,
      roles: [...new Set(members.map((d) => d.role_family))].sort(),
    },
    posting_ids: postingIds, company_domains: domains, examples,
  };
}

export async function gaps() {
  if (!hasCredentials()) throw new Error('gaps needs ANTHROPIC_API_KEY.');
  const coverage = loadCoverage();
  const postings = listJson(P.extracted).map((f) => readJson<ExtractedPosting>(f));
  const matched = new Map(listJson(P.matched).map((f) => readJson<MatchedPosting>(f)).map((m) => [m.posting_id, m]));
  const scored = new Map(readJson<PostingScore[]>(path.join(P.processed, 'scored_postings.json')).map((p) => [p.posting_id, p]));
  const duties = collectGapDuties(postings, matched);
  const byId = new Map(duties.map((d) => [d.duty_id, d]));
  const notes: string[] = [];

  // 1. Normalise, 100 per call.
  for (let i = 0; i < duties.length; i += GAPS.normaliseBatchSize) {
    const batch = duties.slice(i, i + GAPS.normaliseBatchSize);
    const ids = batch.map((b) => b.duty_id);
    const res = await callTool({
      stage: 'gaps-normalise', system: NORMALISE_SYSTEM, user: normaliseUser(batch.map((b) => ({ duty_id: b.duty_id, text: b.text }))),
      toolName: NORMALISE_TOOL.name, toolDescription: NORMALISE_TOOL.description, schema: normaliseSchema, effort: 'low', maxTokens: 8000,
      check: (o) => {
        const got = new Set(o.items.map((x) => x.duty_id));
        const missing = ids.filter((id) => !got.has(id));
        return missing.length ? `missing duty_ids: ${missing.join(', ')}` : null;
      },
    });
    if (!res.ok) { notes.push(`normalise batch ${i / GAPS.normaliseBatchSize + 1} failed: ${res.error}`); continue; }
    for (const it of res.data.items) { const d = byId.get(it.duty_id); if (d) d.canonical = it.canonical.toLowerCase().trim(); }
  }
  // Fallback for any duty a failed batch left without a canonical task.
  for (const d of duties) d.canonical ??= d.text.toLowerCase().replace(/[.]+$/, '').trim();

  // 2. Cluster all canonical tasks in one call.
  const counts = new Map<string, number>();
  for (const d of duties) counts.set(d.canonical!, (counts.get(d.canonical!) ?? 0) + 1);
  const tasks = [...counts.entries()].map(([canonical, count]) => ({ canonical, count })).sort((a, b) => b.count - a.count || a.canonical.localeCompare(b.canonical));
  const res = await callTool({
    stage: 'gaps-cluster', system: clusterSystem(coverage.known_not_advertised), user: clusterUser(tasks),
    toolName: CLUSTER_TOOL.name, toolDescription: CLUSTER_TOOL.description, schema: clusterSchema, maxTokens: 16000,
    check: (o) => {
      if (o.themes.length < GAPS.minThemes || o.themes.length > GAPS.maxThemes) return `need ${GAPS.minThemes}-${GAPS.maxThemes} themes, got ${o.themes.length}`;
      return checkClusters(o.themes, tasks.length);
    },
  });
  if (!res.ok) throw new Error(`gap clustering failed: ${res.error}`);

  // 3. Assign every duty to exactly one theme.
  const taskTheme = new Map<number, string>();
  for (const t of res.data.themes) for (const id of t.task_ids) if (!taskTheme.has(id)) taskTheme.set(id, t.theme_id);
  const canonicalTheme = new Map(tasks.map((t, i) => [t.canonical, taskTheme.get(i) ?? 'other']));
  const members = new Map<string, string[]>();
  for (const d of duties) {
    const th = canonicalTheme.get(d.canonical!) ?? 'other';
    members.set(th, [...(members.get(th) ?? []), d.duty_id]);
  }
  // 4. Themes with fewer than 3 duties merge into "Other".
  const meta = new Map(res.data.themes.map((t) => [t.theme_id, t]));
  const otherIds: string[] = [...(members.get('other') ?? [])];
  const finalThemes: GapTheme[] = [];
  for (const [id, dutyIds] of members) {
    if (id === 'other') continue;
    if (dutyIds.length < GAPS.minThemeSize || !meta.get(id)) { otherIds.push(...dutyIds); continue; }
    const t = meta.get(id)!;
    finalThemes.push({
      theme_id: id, name: t.name, description: t.description, bucket: t.bucket, duty_ids: dutyIds,
      canonical_tasks: [...new Set(dutyIds.map((d) => byId.get(d)!.canonical!))],
      ...themeMetrics(dutyIds, byId, scored),
    });
  }
  if (otherIds.length)
    finalThemes.push({
      theme_id: 'other', name: 'Other', description: 'Small themes (fewer than 3 duties) and unassigned tasks.', bucket: 'unclear',
      duty_ids: otherIds, canonical_tasks: [...new Set(otherIds.map((d) => byId.get(d)!.canonical!))], ...themeMetrics(otherIds, byId, scored),
    });
  finalThemes.sort((a, b) => b.metrics.share_strong_leads - a.metrics.share_strong_leads || b.metrics.postings - a.metrics.postings);

  // Check: every uncovered duty sits in exactly one theme.
  const assigned = finalThemes.flatMap((t) => t.duty_ids);
  const dupes = assigned.length - new Set(assigned).size;
  if (assigned.length !== duties.length || dupes) throw new Error(`gap assignment check failed: ${assigned.length} assigned, ${duties.length} duties, ${dupes} duplicates`);

  writeJson(path.join(P.processed, 'gaps.json'), { themes: finalThemes, duties: duties.map(({ duty_id, canonical, label }) => ({ duty_id, canonical, label })) });
  recordStage({ stage: 'gaps', in: duties.length, out: finalThemes.length, notes: [`${tasks.length} canonical tasks`, 'every uncovered duty sits in exactly one theme', ...notes] });
}
