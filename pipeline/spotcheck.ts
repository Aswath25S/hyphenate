/** Samples 20 random duty labels from the current run into docs/spot-check.md for a human to grade. */
import fs from 'node:fs';
import path from 'node:path';
import { listJson, readJson } from './lib/io';
import { P } from './lib/paths';
import type { PostingDetail } from '../lib/app-types';

const seed = Number(process.argv[2] ?? Date.now() % 100000);
let s = seed;
const rand = () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const duties = listJson(P.appPostings).flatMap((f) => {
  const p = readJson<PostingDetail>(f);
  return p.duties.filter((d) => d.scored).map((d) => ({ ...d, company: p.company, title: p.title, posting_id: p.posting_id }));
});
const pick = [...duties].sort(() => rand() - 0.5).slice(0, 20);
const lines = [
  '# Spot check: 20 random duty labels', '',
  `Seed ${seed}, drawn from ${duties.length} scored duties. Mark each row ✓ (agree) or ✗ (disagree, with the right label). Summarise the result in DECISIONS.md.`, '',
  '| # | Company · role | Duty | Label | Capability | Conf. | Agree? |', '| --- | --- | --- | --- | --- | --- | --- |',
  ...pick.map((d, i) => `| ${i + 1} | ${d.company} · ${d.title} | ${d.text.replace(/\|/g, '/')} | ${d.label} | ${d.capability_id ?? '–'} | ${d.confidence?.toFixed(2) ?? '–'} | |`),
];
fs.mkdirSync('docs', { recursive: true });
fs.writeFileSync(path.join('docs', 'spot-check.md'), lines.join('\n') + '\n');
console.log(`Wrote docs/spot-check.md (${pick.length} labels, seed ${seed}).`);
