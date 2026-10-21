/** Stage 2: keep finance and CFO-office roles posted in the last 60 days; dedupe. */
import path from 'node:path';
import { FILTER } from '../../config/scoring';
import { listJson, readJson, shortHash, writeJson } from '../lib/io';
import { P } from '../lib/paths';
import { classifyTitle } from '../lib/roles';
import { isUsLocation } from '../lib/geo';
import { normaliseTitle, textSimilarity } from '../lib/text';
import { callLlm, hasCredentials } from '../lib/llm';
import { TITLE_SYSTEM, TITLE_TOOL, titleCheckSchema, titleUser } from '../prompts/filter';
import { recordStage } from '../lib/stats';
import type { RawPosting } from '../lib/sources';
import type { FilteredPosting } from '../lib/types';

export function postingId(company: string, title: string, sourceUrl: string): string {
  return shortHash(`${company}|${title}|${sourceUrl}`, 16);
}

function salaryLines(text: string): string[] {
  return text.split('\n').filter((l) => /\$\s?\d/.test(l) && /(salary|pay|compensation|range|base|hour|annual|year|\$\s?\d[\d,]*\s*[-–—]|to \$)/i.test(l)).map((l) => l.trim()).slice(0, 6);
}

export function dedupe(postings: FilteredPosting[]): { kept: FilteredPosting[]; merged: number } {
  const kept: FilteredPosting[] = [];
  let merged = 0;
  for (const p of postings) {
    const twin = kept.find((k) => k.domain === p.domain && normaliseTitle(k.title) === normaliseTitle(p.title) && textSimilarity(k.text, p.text) >= FILTER.dedupeSimilarity);
    if (!twin) { kept.push(p); continue; }
    merged++;
    twin.merged_raw_ids.push(p.raw_id);
    twin.locations = [...new Set([...twin.locations, ...p.locations])];
    const known = new Set([...salaryLines(twin.text), ...twin.extra_salary_lines.map((s) => s.line)]);
    for (const line of salaryLines(p.text)) if (!known.has(line)) twin.extra_salary_lines.push({ location: p.locations.join('; '), line });
    if (!twin.structured_salary && p.structured_salary) twin.structured_salary = p.structured_salary;
    else if (twin.structured_salary && p.structured_salary?.min && twin.structured_salary.min && p.structured_salary.min < twin.structured_salary.min) {
      twin.extra_salary_lines.push({ location: p.locations.join('; '), line: `Job board pay data: ${p.structured_salary.min}-${p.structured_salary.max ?? ''} ${p.structured_salary.currency ?? ''} per ${p.structured_salary.period ?? ''}` });
    }
    // Keep the earliest posting date.
    if (p.posted_at && (!twin.posted_at || p.posted_at < twin.posted_at)) twin.posted_at = p.posted_at;
  }
  return { kept, merged };
}

export async function filter(asOf = new Date()) {
  const raw: RawPosting[] = listJson(P.rawPostings).flatMap((f) => readJson<{ postings: RawPosting[] }>(f).postings);
  const cutoff = asOf.getTime() - FILTER.maxAgeDays * 86_400_000;
  const drops: Record<string, number> = {};
  const drop = (why: string) => { drops[why] = (drops[why] ?? 0) + 1; };
  const notes: string[] = [];

  const stage1: (RawPosting & { _verdict: 'keep' | 'unclear' })[] = [];
  for (const r of raw) {
    const v = classifyTitle(r.title);
    if (v === 'drop') { drop('title'); continue; }
    if (r.text.trim().length < 200) { drop('no description'); continue; }
    if (!isUsLocation(r.locations, r.text)) { drop('not US'); continue; }
    const d = r.posted_at ?? r.updated_at;
    if (d && new Date(d).getTime() < cutoff) { drop('older than 60 days'); continue; }
    stage1.push({ ...r, _verdict: v });
  }

  // LLM check for unclear titles, batched.
  const unclear = stage1.filter((r) => r._verdict === 'unclear');
  const llmKeep = new Set<string>();
  if (unclear.length && hasCredentials()) {
    for (let i = 0; i < unclear.length; i += 25) {
      const batch = unclear.slice(i, i + 25);
      const res = await callLlm({
        stage: 'filter', system: TITLE_SYSTEM, formatName: TITLE_TOOL.name, formatDescription: TITLE_TOOL.description,
        schema: titleCheckSchema, effort: 'low', maxTokens: 8000,
        user: titleUser(batch.map((b) => ({ id: b.raw_id, title: b.title, snippet: b.text.slice(0, 700) }))),
      });
      if (res.ok) {
        for (const it of res.data.items) if (it.keep) llmKeep.add(it.id);
      } else {
        notes.push(`title check batch failed: ${res.error}`);
      }
    }
  } else if (unclear.length) {
    notes.push(`${unclear.length} unclear titles dropped: no OPENAI_API_KEY for the title check`);
  }

  const kept: FilteredPosting[] = [];
  for (const r of stage1) {
    if (r._verdict === 'unclear' && !llmKeep.has(r.raw_id)) { drop(hasCredentials() ? 'unclear title, LLM check said drop' : 'unclear title, not checked (no API key)'); continue; }
    const { _verdict, ...rest } = r;
    kept.push({
      ...rest,
      posting_id: postingId(r.company, r.title, r.source_url),
      merged_raw_ids: [r.raw_id],
      extra_salary_lines: [],
      date_basis: r.posted_at ? 'posted_at' : r.updated_at ? 'updated_at' : 'unknown',
      title_decision: _verdict === 'keep' ? 'rule' : 'llm',
    });
  }
  const { kept: unique, merged } = dedupe(kept);
  if (merged) drop('duplicate (merged)');
  drops['duplicate (merged)'] = merged;
  writeJson(path.join(P.processed, 'filtered.json'), unique);
  const companies = new Set(unique.map((u) => u.domain)).size;
  recordStage({
    stage: 'filter', in: raw.length, out: unique.length,
    notes: [`${companies} companies`, ...Object.entries(drops).map(([k, v]) => `dropped ${v}: ${k}`), ...notes],
  });
}
