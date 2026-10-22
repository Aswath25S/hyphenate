/**
 * Fixture preview: builds data/app from the 10 hand-labelled fixtures so the
 * dashboard can be reviewed without an API key. The UI shows a banner.
 * Usage: npm run preview:fixtures
 */
import fs from 'node:fs';
import path from 'node:path';
import { writeJson } from './lib/io';
import { P } from './lib/paths';
import { loadFixtures } from './lib/fixtures';
import { loadCoverage, coverageIndex } from './lib/coverage';
import { finaliseLabels } from './prompts/match';
import { score } from './stages/score';
import { publish } from './stages/publish';
import { recordStage } from './lib/stats';
import type { ExtractedPosting, MatchedPosting } from './lib/types';
import { collectGapDuties, themeMetrics, type GapTheme } from './stages/gaps';
import { readJson } from './lib/io';
import type { PostingScore } from './stages/score';

/** Hand-assigned preview themes (keyword rules over hand-labelled duties). The real run clusters with the LLM. */
const PREVIEW_THEMES: { theme_id: string; name: string; description: string; bucket: GapTheme['bucket']; re: RegExp }[] = [
  { theme_id: 'indirect_tax_1099', name: 'Indirect tax and 1099 compliance', description: 'Sales and use tax, VAT/GST filings, notices, registrations and 1099 reporting.', bucket: 'possible_gap', re: /tax|1099/i },
  { theme_id: 'expense_review', name: 'Expense report review', description: 'Reviewing employee expense reports and expense-management processes.', bucket: 'possible_gap', re: /expense/i },
  { theme_id: 'payroll_accounting', name: 'Payroll and benefits accounting', description: 'Owning payroll and benefits accounting entries and reconciliations.', bucket: 'possible_gap', re: /payroll/i },
  { theme_id: 'structured_finance_ops', name: 'Structured-finance treasury operations', description: 'Loan purchases, concentration limits, trust account setup and KYC packages.', bucket: 'possible_gap', re: /loan|concentration|kyc|trust accounts/i },
  { theme_id: 'auditor_relationships', name: 'Auditor relationships', description: 'Acting as the primary contact for and partner to external auditors.', bucket: 'human_work', re: /auditor/i },
  { theme_id: 'team_leadership', name: 'Team leadership', description: 'Managing, mentoring and leading finance staff and reviews.', bucket: 'human_work', re: /manage a team|mentor|^lead |standardized/i },
  { theme_id: 'cross_functional', name: 'Cross-functional partnering', description: 'Partnering with GTM, operations and leadership; escalations and guidance.', bucket: 'human_work', re: /partner|relationship|contact|escalat|guidance|gather/i },
  { theme_id: 'process_improvement', name: 'Process improvement projects', description: 'Automation, system implementations, AI tooling and close acceleration.', bucket: 'human_work', re: /improv|automat|implement|system|ai tools|build|speed|document|test|procedures/i },
  { theme_id: 'vague_support', name: 'Vague support duties', description: 'Duties too general to judge, such as supporting close or operations.', bucket: 'unclear', re: /./ },
];

function previewGaps() {
  const postings = Object.fromEntries(fs.readdirSync(P.extracted).map((f) => [f, readJson<ExtractedPosting>(path.join(P.extracted, f))]));
  const matched = new Map(fs.readdirSync(P.matched).map((f) => readJson<MatchedPosting>(path.join(P.matched, f))).map((m) => [m.posting_id, m]));
  const scored = new Map(readJson<PostingScore[]>(path.join(P.processed, 'scored_postings.json')).map((p) => [p.posting_id, p]));
  const duties = collectGapDuties(Object.values(postings), matched);
  const byId = new Map(duties.map((d) => [d.duty_id, d]));
  const members = new Map<string, string[]>();
  for (const d of duties) {
    const t = PREVIEW_THEMES.find((x) => x.re.test(d.text))!;
    members.set(t.theme_id, [...(members.get(t.theme_id) ?? []), d.duty_id]);
  }
  const themes: GapTheme[] = PREVIEW_THEMES.filter((t) => members.has(t.theme_id)).map((t) => ({
    theme_id: t.theme_id, name: t.name, description: t.description, bucket: t.bucket, duty_ids: members.get(t.theme_id)!,
    canonical_tasks: members.get(t.theme_id)!.map((id) => byId.get(id)!.text.toLowerCase()),
    ...themeMetrics(members.get(t.theme_id)!, byId, scored),
  })).sort((a, b) => b.metrics.share_strong_leads - a.metrics.share_strong_leads || b.metrics.postings - a.metrics.postings);
  writeJson(path.join(P.processed, 'gaps.json'), { themes, duties: duties.map((d) => ({ duty_id: d.duty_id, canonical: d.text.toLowerCase(), label: d.label })) });
  recordStage({ stage: 'gaps', in: duties.length, out: themes.length, notes: ['fixture preview: hand-assigned themes, no model calls'] });
}

async function main() {
  const fixtures = loadFixtures();
  const { levels } = coverageIndex(loadCoverage());
  fs.rmSync(P.extracted, { recursive: true, force: true });
  fs.rmSync(P.matched, { recursive: true, force: true });
  for (const fx of fixtures) {
    const p = fx.input;
    const s = fx.expected.salary_annual;
    const salaryHour = s.period === 'hour' && s.min !== null;
    const posting: ExtractedPosting = {
      posting_id: p.posting_id, company: p.company, domain: p.domain, title: p.title,
      role_family: fx.expected.role_family as ExtractedPosting['role_family'], seniority: fx.expected.seniority as ExtractedPosting['seniority'],
      locations: p.locations, remote: 'unknown',
      salary: { min: salaryHour ? s.min! / 2080 : s.min, max: salaryHour && s.max ? s.max / 2080 : s.max, period: s.period, currency: s.min !== null ? 'USD' : null, raw_text: p.text.split('\n').find((l) => /\$\s?\d[\d,.]*\s*(?:-|–|—|to)\s*\$?\s?\d/.test(l)) ?? null },
      erp: fx.expected.erp, tools: [],
      complexity: { multi_entity: false, multi_currency: false, usage_based_billing: false, high_volume: false, entity_count: null },
      pain_phrases: [], duties: fx.expected.duties.map(({ label: _l, capability_id: _c, ...d }) => d),
      posted_at: p.posted_at, source_url: p.source_url, fetched_at: p.fetched_at, prompt_version: 'hand-labelled',
      text: p.text, extra_salary_lines: p.extra_salary_lines, salary_source: s.min !== null ? 'posting_text' : null, ats: p.ats,
    };
    const labels = finaliseLabels(fx.expected.duties.map((d) => ({ duty_id: d.duty_id, label: d.label, capability_id: d.capability_id, confidence: 1, rationale: 'Hand label (fixture).' })), levels);
    const matched: MatchedPosting = { posting_id: p.posting_id, prompt_version: 'hand-labelled', labels };
    writeJson(path.join(P.extracted, `${p.posting_id}.json`), posting);
    writeJson(path.join(P.matched, `${p.posting_id}.json`), matched);
  }
  recordStage({ stage: 'extract', in: fixtures.length, out: fixtures.length, notes: ['fixture preview: hand labels, no model calls'] });
  recordStage({ stage: 'match', in: fixtures.length, out: fixtures.length, notes: ['fixture preview: hand labels, no model calls'] });
  // Stale downstream outputs from a previous real run must not leak into the preview.
  for (const f of ['gaps.json', 'briefs.json']) fs.rmSync(path.join(P.processed, f), { force: true });
  await score();
  previewGaps();
  await publish({ asOf: new Date('2026-10-20T12:00:00Z'), mode: 'fixture_preview' });
}

main().catch((e) => { console.error(e); process.exit(1); });
