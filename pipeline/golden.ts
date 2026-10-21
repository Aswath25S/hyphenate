/**
 * Golden tests: rerun extraction and matching on the 10 hand-labelled fixtures
 * and report agreement. Rerun on every prompt change.
 *   M1: schema valid 10/10; scored duty count within 1 of hand label for 8/10; salary parsed exactly.
 *   M2: label agreement ≥ 80%; no covered/assisted label without a capability id.
 * Matching is scored on the hand-split duties so it measures matching alone.
 */
import fs from 'node:fs';
import path from 'node:path';
import { writeJson } from './lib/io';
import { P } from './lib/paths';
import { hasCredentials } from './lib/llm';
import { loadFixtures } from './lib/fixtures';
import { loadCoverage } from './lib/coverage';
import { extractOne, buildPosting } from './stages/extract';
import { matchOne, scoredDuties } from './stages/match';
import { normaliseSalary } from '../lib/scoring';
import { EXTRACT_PROMPT_VERSION } from './prompts/extract';
import { MATCH_PROMPT_VERSION } from './prompts/match';

if (fs.existsSync('.env')) process.loadEnvFile('.env');

async function main() {
  if (!hasCredentials()) { console.error('golden needs OPENAI_API_KEY'); process.exit(1); }
  const fixtures = loadFixtures();
  const coverage = loadCoverage();
  const rows: Record<string, unknown>[] = [];
  let schemaOk = 0, countOk = 0, salaryOk = 0, agree = 0, total = 0, capMissing = 0, capAgree = 0, capTotal = 0;
  const confusion: Record<string, Record<string, number>> = {};

  for (const fx of fixtures) {
    const ex = await extractOne(fx.input);
    const row: Record<string, unknown> = { fixture: fx.fixture_id, expected_duties: fx.expected.scored_duty_count };
    if (ex.ok) {
      schemaOk++;
      const posting = buildPosting(fx.input, ex.data);
      const n = scoredDuties(posting).length;
      const sal = normaliseSalary(posting.salary, fx.input.extra_salary_lines.length);
      const salaryMatch = sal.min === fx.expected.salary_annual.min && sal.max === fx.expected.salary_annual.max;
      if (Math.abs(n - fx.expected.scored_duty_count) <= 1) countOk++;
      if (salaryMatch) salaryOk++;
      Object.assign(row, { extracted_duties: n, duty_diff: n - fx.expected.scored_duty_count, salary: `${sal.min ?? '–'}–${sal.max ?? '–'}`, salary_ok: salaryMatch, role_family: ex.data.role_family, role_ok: ex.data.role_family === fx.expected.role_family });
    } else {
      Object.assign(row, { extract_error: ex.error });
    }

    const m = await matchOne({ duties: fx.expected.duties, title: fx.input.title, role_family: fx.expected.role_family as never }, coverage);
    if (m.ok) {
      const byId = new Map(m.labels.map((l) => [l.duty_id, l]));
      let a = 0;
      for (const d of fx.expected.duties) {
        const got = byId.get(d.duty_id);
        if (!got) continue;
        total++;
        confusion[d.label] ??= {};
        confusion[d.label][got.label] = (confusion[d.label][got.label] ?? 0) + 1;
        if (got.label === d.label) { agree++; a++; if (d.capability_id) { capTotal++; if (got.capability_id === d.capability_id) capAgree++; } }
        if ((got.label === 'covered' || got.label === 'assisted') && !got.capability_id) capMissing++;
      }
      row.label_agreement = `${a}/${fx.expected.duties.length}`;
    } else {
      row.match_error = m.error;
    }
    rows.push(row);
    console.log(JSON.stringify(row));
  }

  const n = fixtures.length;
  const report = {
    at: new Date().toISOString(), prompts: { extract: EXTRACT_PROMPT_VERSION, match: MATCH_PROMPT_VERSION }, fixtures: n,
    m1: { schema_valid: `${schemaOk}/${n}`, duty_count_within_1: `${countOk}/${n}`, salary_exact: `${salaryOk}/${n}`,
      pass: schemaOk === n && countOk >= Math.ceil(n * 0.8) && salaryOk === n },
    m2: { label_agreement: total ? agree / total : 0, labels: `${agree}/${total}`, capability_agreement_when_label_agrees: capTotal ? capAgree / capTotal : null,
      covered_or_assisted_without_capability: capMissing, pass: total > 0 && agree / total >= 0.8 && capMissing === 0 },
    confusion_hand_vs_model: confusion,
    rows,
  };
  writeJson(path.join(P.fixtures, 'golden_report.json'), report);
  console.log('\nM1', JSON.stringify(report.m1));
  console.log('M2', JSON.stringify(report.m2));
}

main().catch((e) => { console.error(e); process.exit(1); });
