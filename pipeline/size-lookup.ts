/**
 * Employee counts from public sources, written into config/sources.csv.
 *   1. Wikidata: match each seed by official website (P856); read "employees" (P1128) with its date.
 *   2. English Wikipedia: read the infobox "num_employees" of the matched article.
 * The most recent dated figure wins; Wikidata figures older than 2023 are ignored.
 * Seeds without a public figure keep their estimate, marked as such.
 *
 *   npm run seed:sizes              → apply cached lookups in data/raw/size/
 *   npm run seed:sizes -- --refresh → fetch again (slow: Wikipedia rate-limits)
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseCsv, toCsv, writeJson, readJson } from './lib/io';
import { P } from './lib/paths';

const UA = 'PotentialMarketForHyphenate/0.1 (independent research prototype; company-level data only)';
const DIR = path.join(P.rawSize);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  for (const wait of [0, 10_000, 30_000, 60_000]) {
    await sleep(wait);
    const res = await fetch(url, { ...init, headers: { 'User-Agent': UA, Accept: 'application/json', ...(init?.headers ?? {}) } });
    if (res.status === 429) continue;
    if (!res.ok) throw new Error(`${url} → ${res.status}`);
    return (await res.json()) as T;
  }
  throw new Error(`rate limited: ${url}`);
}

type Wd = Record<string, { qid: string; employees: number | null; date: string | null }>;
type Wp = Record<string, { qid: string; title: string; url: string; raw: string; year: string; employees: number | null }>;

async function refresh(domains: string[]) {
  fs.mkdirSync(DIR, { recursive: true });
  const values = domains.flatMap((d) => ['https://www.', 'https://', 'http://www.', 'http://'].flatMap((pre) => ['', '/'].map((suf) => `<${pre}${d}${suf}>`)));
  const query = `SELECT ?site ?item ?emp ?date WHERE { VALUES ?site { ${values.join(' ')} } ?item wdt:P856 ?site .
    OPTIONAL { ?item p:P1128 ?st . ?st ps:P1128 ?emp . OPTIONAL { ?st pq:P585 ?date } } }`;
  const res = await getJson<{ results: { bindings: Record<string, { value: string }>[] } }>('https://query.wikidata.org/sparql', {
    method: 'POST', body: new URLSearchParams({ query, format: 'json' }), headers: { Accept: 'application/sparql-results+json' },
  });
  writeJson(path.join(DIR, 'wikidata.json'), res);

  const qids: Record<string, string> = {};
  for (const b of res.results.bindings) qids[b.site.value.split('://')[1].replace('www.', '').replace(/\/$/, '')] = b.item.value.split('/').pop()!;
  const titles: Record<string, string> = {};
  const ids = [...new Set(Object.values(qids))];
  for (let i = 0; i < ids.length; i += 50) {
    const d = await getJson<{ entities: Record<string, { sitelinks?: { enwiki?: { title: string } } }> }>(
      `https://www.wikidata.org/w/api.php?${new URLSearchParams({ action: 'wbgetentities', ids: ids.slice(i, i + 50).join('|'), props: 'sitelinks', sitefilter: 'enwiki', format: 'json' })}`);
    for (const [q, e] of Object.entries(d.entities)) if (e.sitelinks?.enwiki) titles[q] = e.sitelinks.enwiki.title;
    await sleep(3000);
  }
  const out: Wp = {};
  for (const [dom, q] of Object.entries(qids)) {
    const t = titles[q];
    if (!t) continue;
    const d = await getJson<{ parse?: { wikitext?: { '*': string } } }>(
      `https://en.wikipedia.org/w/api.php?${new URLSearchParams({ action: 'parse', page: t, prop: 'wikitext', section: '0', format: 'json', redirects: '1' })}`);
    await sleep(3000);
    const wt = d.parse?.wikitext?.['*'] ?? '';
    const raw = (wt.match(/\|\s*num_employees\s*=\s*([^\n|]*)/)?.[1] ?? '').trim();
    const year = (wt.match(/\|\s*num_employees_year\s*=\s*([^\n|]*)/)?.[1] ?? '').trim();
    const nums = (raw.replace(/\{\{[^}]*\}\}|<ref.*?(<\/ref>|\/>)/g, '').match(/\d[\d,]{1,}/g) ?? []).map((n) => Number(n.replace(/,/g, ''))).filter((n) => n >= 10 && n <= 1_000_000);
    out[dom] = { qid: q, title: t, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(t.replace(/ /g, '_'))}`, raw: raw.slice(0, 120), year, employees: nums[0] ?? null };
  }
  writeJson(path.join(DIR, 'wikipedia.json'), out);
}

function loadWikidata(): Wd {
  const res = readJson<{ results: { bindings: Record<string, { value: string }>[] } }>(path.join(DIR, 'wikidata.json'));
  const out: Wd = {};
  for (const b of res.results.bindings) {
    const dom = b.site.value.split('://')[1].replace('www.', '').replace(/\/$/, '');
    const qid = b.item.value.split('/').pop()!;
    const cur = out[dom] ?? { qid, employees: null, date: null };
    if (b.emp) {
      const date = b.date?.value.slice(0, 10) ?? null;
      if (!cur.date || (date && date > cur.date)) Object.assign(cur, { employees: Number(b.emp.value), date });
    }
    out[dom] = cur;
  }
  return out;
}

async function main() {
  const file = path.join(P.config, 'sources.csv');
  const rows = parseCsv(fs.readFileSync(file, 'utf8'));
  if (process.argv.includes('--refresh') || !fs.existsSync(path.join(DIR, 'wikipedia.json'))) await refresh(rows.map((r) => r.domain.toLowerCase()));
  const wd = loadWikidata();
  const wp = readJson<Wp>(path.join(DIR, 'wikipedia.json'));
  let sourced = 0;
  for (const r of rows) {
    const dom = r.domain.toLowerCase();
    const w = wp[dom]?.employees ? wp[dom] : null;
    const d = wd[dom]?.employees && wd[dom].date && wd[dom].date! >= '2023' ? wd[dom] : null;
    const wYear = w?.year.match(/\d{4}/)?.[0] ?? null;
    const useWd = d && (!w || !wYear || d.date!.slice(0, 4) > wYear);
    if (useWd) {
      r.employee_band = String(d!.employees);
      r.size_source_url = `https://www.wikidata.org/wiki/${d!.qid}`;
      r.size_note = `Wikidata, ${d!.date!.slice(0, 7)}`;
    } else if (w) {
      r.employee_band = String(w.employees);
      r.size_source_url = w.url;
      r.size_note = `Wikipedia infobox${wYear ? `, ${wYear}` : ''}`;
    } else {
      r.size_note = 'unverified estimate; no public figure found on Wikidata or Wikipedia';
      continue;
    }
    sourced++;
  }
  fs.writeFileSync(file, toCsv(rows, ['company', 'domain', 'ats', 'board_token', 'employee_band', 'hq_state', 'size_source_url', 'size_note']));
  console.log(`Employee counts from a public source: ${sourced} of ${rows.length} seed companies. Others keep an estimate.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
