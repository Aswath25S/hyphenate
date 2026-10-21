/**
 * Builds tests/fixtures/<slug>.json from hand_labels.json + the filtered posting
 * text, freezing the input so golden tests do not depend on live job boards.
 * Usage: npx tsx tests/fixtures/build-fixtures.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { locateSpan } from '../../pipeline/lib/text';
import type { FilteredPosting } from '../../pipeline/lib/types';

const dir = path.dirname(new URL(import.meta.url).pathname);
const labels = JSON.parse(fs.readFileSync(path.join(dir, 'hand_labels.json'), 'utf8'));
const filteredFile = path.join(process.cwd(), 'data/processed/filtered.json');
const filtered: FilteredPosting[] = fs.existsSync(filteredFile) ? JSON.parse(fs.readFileSync(filteredFile, 'utf8')) : [];
const coverage = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'config/coverage_map.json'), 'utf8'));
const capIds = new Set(coverage.capabilities.map((c: { id: string }) => c.id));
let problems = 0;

for (const [postingId, l] of Object.entries<Record<string, any>>(labels)) {
  if (postingId.startsWith('_')) continue;
  const out = path.join(dir, `${l.slug}.json`);
  const existing = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : null;
  const input: FilteredPosting | undefined = filtered.find((p) => p.posting_id === postingId) ?? existing?.input;
  if (!input) { console.error(`✗ ${l.slug}: posting ${postingId} not found`); problems++; continue; }
  const duties = (l.duties as [string, string, string, string | null][]).map(([text, source_span, label, capability_id], i) => {
    if (!locateSpan(input.text, source_span)) { console.error(`✗ ${l.slug} duty ${i + 1}: span not verbatim: ${source_span}`); problems++; }
    if ((label === 'covered' || label === 'assisted') && !capIds.has(capability_id)) { console.error(`✗ ${l.slug} duty ${i + 1}: bad capability ${capability_id}`); problems++; }
    return { duty_id: `${postingId}-h${String(i + 1).padStart(2, '0')}`, text, source_span, is_boilerplate: false, is_requirement: false, label, capability_id };
  });
  fs.writeFileSync(out, JSON.stringify({
    fixture_id: l.slug,
    labelled_by: 'Draft hand labels by Claude Code; pending user review',
    source: { company: input.company, title: input.title, source_url: input.source_url, posted_at: input.posted_at },
    input,
    expected: { role_family: l.role_family, seniority: l.seniority, salary_annual: l.salary, erp: l.erp, scored_duty_count: duties.length, duties },
  }, null, 2) + '\n');
  console.log(`✓ ${l.slug.padEnd(32)} ${duties.length} scored duties`);
}
if (problems) { console.error(`${problems} problems`); process.exit(1); }
