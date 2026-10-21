/**
 * npm run pipeline            → all stages in order
 * npm run stage -- <name>     → one stage (collect, filter, extract, match, score, news, gaps, brief, publish)
 * Options: --limit N (extract only), --as-of YYYY-MM-DD
 */
import fs from 'node:fs';
import { collect } from './stages/collect';
import { filter } from './stages/filter';
import { extract } from './stages/extract';
import { match } from './stages/match';
import { score } from './stages/score';
import { news } from './stages/news';
import { gaps } from './stages/gaps';
import { brief } from './stages/brief';
import { publish } from './stages/publish';

if (fs.existsSync('.env')) process.loadEnvFile('.env');

const args = process.argv.slice(2);
const name = args[0];
const flag = (k: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
const asOf = flag('as-of') ? new Date(`${flag('as-of')}T12:00:00Z`) : new Date();
const limit = flag('limit') ? Number(flag('limit')) : undefined;

const STAGES: Record<string, () => Promise<void>> = {
  collect: () => collect(),
  filter: () => filter(asOf),
  extract: () => extract({ limit }),
  match: () => match(),
  score: () => score(),
  news: () => news(asOf),
  gaps: () => gaps(),
  brief: () => brief(asOf),
  publish: () => publish({ asOf }),
};

async function main() {
  if (!name || (name !== 'all' && !STAGES[name])) {
    console.error(`Usage: npm run stage -- <${Object.keys(STAGES).join('|')}>   or   npm run pipeline`);
    process.exit(1);
  }
  const order = name === 'all' ? Object.keys(STAGES) : [name];
  for (const s of order) {
    const t = Date.now();
    console.log(`\n▸ ${s}`);
    await STAGES[s]();
    console.log(`  done in ${((Date.now() - t) / 1000).toFixed(1)}s`);
  }
}

main().catch((e) => {
  console.error(`\n✗ ${(e as Error).message}`);
  process.exit(1);
});
