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
      salary: { min: salaryHour ? s.min! / 2080 : s.min, max: salaryHour && s.max ? s.max / 2080 : s.max, period: s.period, currency: s.min !== null ? 'USD' : null, raw_text: p.text.split('\n').find((l) => /\$\s?\d/.test(l) && /(salary|pay|range|hour|annual|compensation)/i.test(l)) ?? null },
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
  recordStage({ stage: 'extract', in: fixtures.length, out: fixtures.length, notes: ['fixture preview: hand labels, no Claude calls'] });
  recordStage({ stage: 'match', in: fixtures.length, out: fixtures.length, notes: ['fixture preview: hand labels, no Claude calls'] });
  // Stale downstream outputs from a previous real run must not leak into the preview.
  for (const f of ['news.json', 'gaps.json', 'briefs.json']) fs.rmSync(path.join(P.processed, f), { force: true });
  await score();
  await publish({ asOf: new Date('2026-10-20T12:00:00Z'), mode: 'fixture_preview' });
}

main().catch((e) => { console.error(e); process.exit(1); });
