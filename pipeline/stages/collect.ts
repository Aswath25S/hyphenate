/** Stage 1: fetch postings from public job-board APIs and manual imports. */
import fs from 'node:fs';
import path from 'node:path';
import { ensureDir, shortHash, writeJson } from '../lib/io';
import { P } from '../lib/paths';
import { loadSeeds } from '../lib/seeds';
import { fetchBoard, type RawPosting } from '../lib/sources';
import { classifyTitle } from '../lib/roles';
import { recordStage } from '../lib/stats';

/**
 * Manual import format (data/raw/manual/*.txt):
 *   Company: Acme
 *   Domain: acme.com
 *   Title: Staff Accountant
 *   URL: https://…
 *   Posted: 2026-10-01
 *   Location: Austin, TX
 *   ---
 *   <posting text>
 */
function readManual(): RawPosting[] {
  if (!fs.existsSync(P.rawManual)) return [];
  return fs.readdirSync(P.rawManual).filter((f) => f.endsWith('.txt')).map((f) => {
    const raw = fs.readFileSync(path.join(P.rawManual, f), 'utf8');
    const [head, ...body] = raw.split(/^---\s*$/m);
    const h = Object.fromEntries(head.split('\n').map((l) => l.match(/^(\w+):\s*(.*)$/)).filter(Boolean).map((m) => [m![1].toLowerCase(), m![2].trim()]));
    const url = h.url || `manual:${f}`;
    return {
      raw_id: `manual:${shortHash(f)}`, company: h.company ?? 'Unknown', domain: h.domain ?? '', ats: 'manual' as const,
      board_token: 'manual', source_job_id: f, title: h.title ?? f, locations: h.location ? [h.location] : [],
      text: body.join('---').trim(), structured_salary: null, workplace: null, posted_at: h.posted || null, updated_at: null,
      source_url: url, api_url: url, fetched_at: new Date().toISOString(),
    };
  });
}

export async function collect() {
  const seeds = loadSeeds();
  ensureDir(P.rawPostings);
  const notes: string[] = [];
  let totalJobs = 0;
  let kept = 0;
  const report: Record<string, unknown>[] = [];
  for (const seed of seeds) {
    try {
      const jobs = await fetchBoard(seed);
      totalJobs += jobs.length;
      // Store only titles the role rules do not reject outright; the filter stage decides the rest.
      const candidates = jobs.filter((j) => classifyTitle(j.title) !== 'drop');
      kept += candidates.length;
      writeJson(path.join(P.rawPostings, `${seed.ats}-${seed.board_token}.json`), {
        company: seed.company, domain: seed.domain, ats: seed.ats, board_token: seed.board_token,
        fetched_at: new Date().toISOString(), total_jobs: jobs.length, postings: candidates,
      });
      report.push({ company: seed.company, ats: seed.ats, total_jobs: jobs.length, finance_candidates: candidates.length });
      console.log(`  ${seed.company.padEnd(28)} ${String(jobs.length).padStart(4)} jobs, ${candidates.length} finance candidates`);
    } catch (e) {
      notes.push(`${seed.company}: ${(e as Error).message}`);
      report.push({ company: seed.company, ats: seed.ats, error: (e as Error).message });
    }
  }
  const manual = readManual();
  if (manual.length) {
    writeJson(path.join(P.rawPostings, 'manual.json'), { company: 'manual', ats: 'manual', fetched_at: new Date().toISOString(), total_jobs: manual.length, postings: manual });
    kept += manual.length;
  }
  writeJson(path.join(P.processed, 'collection_report.json'), { at: new Date().toISOString(), seeds: seeds.length, total_jobs: totalJobs, finance_candidates: kept, manual: manual.length, boards: report });
  recordStage({ stage: 'collect', in: seeds.length, out: kept, failed: notes.length, notes: [`${totalJobs} jobs seen across ${seeds.length} boards`, ...notes] });
}
