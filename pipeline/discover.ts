/**
 * Seed-list helper (not a pipeline stage). Probes candidate board slugs on the
 * three public job-board APIs and reports which have recent US finance roles.
 * Usage: npm run seed:discover -- config/seed_candidates.txt
 */
import fs from 'node:fs';
import path from 'node:path';
import { FILTER } from '../config/scoring';
import { writeJson } from './lib/io';
import { P } from './lib/paths';
import { classifyTitle } from './lib/roles';
import { fetchBoard, type Ats, type RawPosting } from './lib/sources';
import { isUsLocation } from './lib/geo';
import { pool } from './lib/claude';

type Candidate = { slug: string; company: string; domain: string };

const file = process.argv[2] ?? 'config/seed_candidates.txt';
const candidates: Candidate[] = fs.readFileSync(file, 'utf8').split('\n')
  .map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
  .map((l) => { const [slug, company, domain] = l.split('|').map((x) => x.trim()); return { slug, company: company || slug, domain: domain || '' }; });

const outFile = path.join(P.processed, 'discovery.json');
const prior: Record<string, unknown>[] = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, 'utf8')) : [];
const done = new Set(prior.map((r) => `${r.ats}:${r.slug}`));
const results: Record<string, unknown>[] = [...prior];
const cutoff = Date.now() - FILTER.maxAgeDays * 86_400_000;

function summarise(c: Candidate, ats: Ats, jobs: RawPosting[]) {
  const fin = jobs.filter((j) => classifyTitle(j.title) !== 'drop');
  const finUs = fin.filter((j) => isUsLocation(j.locations, j.text));
  const recent = finUs.filter((j) => {
    const d = j.posted_at ?? j.updated_at;
    return !d || new Date(d).getTime() >= cutoff;
  });
  return {
    slug: c.slug, company: c.company, domain: c.domain, ats, total_jobs: jobs.length,
    finance_titles: fin.length, finance_us: finUs.length, finance_us_recent: recent.length,
    sample_titles: recent.slice(0, 6).map((j) => j.title),
    has_salary_text: recent.filter((j) => /\$\s?\d/.test(j.text) || j.structured_salary).length,
  };
}

const tasks: { c: Candidate; ats: Ats }[] = [];
for (const c of candidates) for (const ats of ['greenhouse', 'lever', 'ashby'] as Ats[]) if (!done.has(`${ats}:${c.slug}`)) tasks.push({ c, ats });

console.log(`Probing ${tasks.length} board URLs for ${candidates.length} candidates…`);
let n = 0;
await pool(tasks, 6, async ({ c, ats }) => {
  try {
    const jobs = await fetchBoard({ company: c.company, domain: c.domain, ats, board_token: c.slug });
    const s = summarise(c, ats, jobs);
    if (jobs.length) results.push(s);
    else results.push({ slug: c.slug, company: c.company, ats, total_jobs: 0 });
    if (s.finance_us_recent) console.log(`  ✓ ${ats.padEnd(10)} ${c.slug.padEnd(22)} jobs=${jobs.length} fin=${s.finance_us_recent} ${s.sample_titles.slice(0, 3).join(' | ')}`);
  } catch {
    results.push({ slug: c.slug, company: c.company, ats, total_jobs: 0, error: true });
  }
  if (++n % 60 === 0) { writeJson(outFile, results); console.log(`  … ${n}/${tasks.length}`); }
});
writeJson(outFile, results);
const hits = results.filter((r) => (r.finance_us_recent as number) > 0);
console.log(`Done. ${hits.length} boards with recent US finance roles. Report: ${path.relative(process.cwd(), outFile)}`);
