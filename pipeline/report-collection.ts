/** Writes docs/collection-report.md from the collect + filter outputs. */
import fs from 'node:fs';
import path from 'node:path';
import { readJson } from './lib/io';
import { P } from './lib/paths';
import type { FilteredPosting } from './lib/types';
import type { StageStat } from './lib/stats';

const f = readJson<FilteredPosting[]>(path.join(P.processed, 'filtered.json'));
const rep = readJson<{ at: string; seeds: number; total_jobs: number; finance_candidates: number }>(path.join(P.processed, 'collection_report.json'));
const st = readJson<Record<string, StageStat>>(path.join(P.processed, 'stage_stats.json'));
const byCo: Record<string, number> = {};
for (const p of f) byCo[p.company] = (byCo[p.company] ?? 0) + 1;
const ats = f.reduce<Record<string, number>>((a, p) => ((a[p.ats] = (a[p.ats] ?? 0) + 1), a), {});
const sal = f.filter((p) => /\$\s?\d{2}/.test(p.text) || p.structured_salary).length;
const dates = f.map((p) => p.posted_at ?? '').filter(Boolean).sort();
const top = Object.entries(byCo).sort((a, b) => b[1] - a[1]);
const errors = (st.collect?.notes ?? []).slice(1);
const lines = [
  '# Collection report', '',
  `Run on ${rep.at.slice(0, 10)}. Sources: public Greenhouse, Lever and Ashby job-board APIs only.`, '',
  '| Step | Count |', '| --- | --- |',
  `| Seed companies (config/sources.csv) | ${rep.seeds} |`,
  `| Jobs seen on their boards | ${rep.total_jobs} |`,
  `| Finance-title candidates stored | ${rep.finance_candidates} |`,
  `| Kept after filter and dedupe | ${f.length} |`,
  `| Companies with at least one kept posting | ${Object.keys(byCo).length} |`,
  `| Kept postings with a salary in text or board data | ${sal} |`, '',
  `**Filter drops:** ${(st.filter?.notes ?? []).filter((n) => n.startsWith('dropped')).join('; ')}.`, '',
  `**By source:** ${Object.entries(ats).map(([k, v]) => `${k} ${v}`).join(', ')}. Every record keeps \`source_url\` and \`fetched_at\`.`, '',
  `**Posting dates:** ${dates[0]?.slice(0, 10)} to ${dates[dates.length - 1]?.slice(0, 10)} (first-published date from each board).`, '',
  `**Board errors:** ${errors.length ? errors.join('; ') : 'none'}.`, '',
  `**Companies with the most kept postings:** ${top.slice(0, 12).map(([c, n]) => `${c} (${n})`).join(', ')}.`, '',
  '## Known gaps', '',
  ...(st.filter?.notes ?? []).filter((n) => n.includes('not checked')).map((n) => `- ${n}. With an API key the filter sends these titles to an LLM check, which may add a few postings.`),
  '- Employee bands in the seed list are unverified estimates (see DECISIONS.md).',
  '- Public job boards over-represent venture-backed technology companies; FP&A roles are a large share of what they list.',
];
fs.mkdirSync('docs', { recursive: true });
fs.writeFileSync('docs/collection-report.md', lines.join('\n') + '\n');
console.log(lines.join('\n'));
