/** Stage 3: Claude turns each posting into structured fields and single duties. */
import path from 'node:path';
import fs from 'node:fs';
import { readJson, writeJson, ensureDir } from '../lib/io';
import { P } from '../lib/paths';
import { callTool, hasCredentials, pool } from '../lib/claude';
import { locateSpan } from '../lib/text';
import { EXTRACT_PROMPT_VERSION, EXTRACT_SYSTEM, EXTRACT_TOOL, checkExtraction, extractSchema, extractUser } from '../prompts/extract';
import { recordStage } from '../lib/stats';
import type { ExtractionOutput, Salary } from '../../lib/schemas';
import type { ExtractedPosting, FilteredPosting } from '../lib/types';

export function postingText(p: Pick<FilteredPosting, 'text' | 'extra_salary_lines'>): string {
  if (!p.extra_salary_lines.length) return p.text;
  return `${p.text}\n\nPay listed on other location postings for this same role:\n${p.extra_salary_lines.map((s) => `${s.location}: ${s.line}`).join('\n')}`;
}

export function boardSalary(p: Pick<FilteredPosting, 'structured_salary'>): Salary | null {
  const s = p.structured_salary;
  if (!s || (s.currency && s.currency !== 'USD') || (!s.min && !s.max)) return null;
  return {
    min: s.min, max: s.max, period: s.period, currency: 'USD',
    raw_text: s.summary ? `Job board pay data: ${s.summary}` : `Job board pay data: ${s.min ?? ''}–${s.max ?? ''} USD per ${s.period ?? 'year'}`,
  };
}

/** Assemble the stored Posting from the model output plus code-owned fields. */
export function buildPosting(p: FilteredPosting, out: ExtractionOutput): ExtractedPosting {
  const fromText = out.salary.min !== null || out.salary.max !== null;
  const board = boardSalary(p);
  const salary = fromText ? out.salary : board ?? out.salary;
  return {
    posting_id: p.posting_id,
    company: p.company,
    domain: p.domain,
    title: p.title,
    role_family: out.role_family,
    seniority: out.seniority,
    locations: out.locations.length ? out.locations : p.locations,
    remote: out.remote,
    salary,
    erp: out.erp,
    tools: out.tools,
    complexity: out.complexity,
    pain_phrases: out.pain_phrases.slice(0, 8),
    duties: out.duties.map((d, i) => ({ duty_id: `${p.posting_id}-${String(i + 1).padStart(2, '0')}`, ...d })),
    posted_at: p.posted_at ?? p.updated_at,
    source_url: p.source_url,
    fetched_at: p.fetched_at,
    prompt_version: EXTRACT_PROMPT_VERSION,
    text: p.text,
    extra_salary_lines: p.extra_salary_lines,
    salary_source: fromText ? 'posting_text' : board ? 'job_board' : null,
    ats: p.ats,
  };
}

export async function extractOne(p: FilteredPosting, opts: { ephemeral?: boolean } = {}) {
  const text = postingText(p);
  const board = boardSalary(p);
  return callTool({
    stage: 'extract',
    system: EXTRACT_SYSTEM,
    user: extractUser({ company: p.company, title: p.title, locations: p.locations, text, salaryHint: board ? board.raw_text : null }),
    toolName: EXTRACT_TOOL.name,
    toolDescription: EXTRACT_TOOL.description,
    schema: extractSchema,
    check: (out) => checkExtraction(out, text, locateSpan),
    ephemeral: opts.ephemeral,
    maxTokens: 12000,
  });
}

export async function extract(opts: { limit?: number } = {}) {
  if (!hasCredentials()) throw new Error('extract needs ANTHROPIC_API_KEY.');
  const all = readJson<FilteredPosting[]>(path.join(P.processed, 'filtered.json'));
  const postings = opts.limit ? all.slice(0, opts.limit) : all;
  ensureDir(P.extracted);
  const failures: { posting_id: string; company: string; title: string; error: string }[] = [];
  const dropped: { posting_id: string; reason: string }[] = [];
  let ok = 0;
  let cost = 0;
  await pool(postings, 4, async (p, i) => {
    const res = await extractOne(p);
    cost += res.usage.cost_usd;
    if (!res.ok) {
      failures.push({ posting_id: p.posting_id, company: p.company, title: p.title, error: res.error });
      console.log(`  ✗ ${p.company} — ${p.title}: ${res.error.slice(0, 120)}`);
      return;
    }
    if (res.data.non_usd_salary) { dropped.push({ posting_id: p.posting_id, reason: 'non-USD salary' }); return; }
    writeJson(path.join(P.extracted, `${p.posting_id}.json`), buildPosting(p, res.data));
    ok++;
    if ((i + 1) % 20 === 0) console.log(`  … ${i + 1}/${postings.length}`);
  });
  // Remove stale outputs for postings no longer in the filtered set.
  const live = new Set(postings.map((p) => `${p.posting_id}.json`));
  if (!opts.limit) for (const f of fs.readdirSync(P.extracted)) if (!live.has(f)) fs.unlinkSync(path.join(P.extracted, f));
  writeJson(path.join(P.processed, 'extract_failures.json'), { failures, dropped });
  recordStage({ stage: 'extract', in: postings.length, out: ok, failed: failures.length, notes: [`${dropped.length} dropped (non-USD)`, `new spend $${cost.toFixed(2)}`] });
}
