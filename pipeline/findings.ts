/** Writes FINDINGS.md: a one-page memo computed straight from data/app. Rerun after every pipeline run. */
import fs from 'node:fs';
import path from 'node:path';
import { readJson } from './lib/io';
import { P } from './lib/paths';
import { pct, usd, ROLE_LABELS } from '../lib/format';
import { median } from '../lib/scoring';
import { PRODUCT_NAME } from '../config/site';
import type { CompanyRow, GapsFile, Meta, PostingRow } from '../lib/app-types';

const meta = readJson<Meta>(path.join(P.app, 'meta.json'));
const postings = readJson<PostingRow[]>(path.join(P.app, 'postings.json'));
const companies = readJson<CompanyRow[]>(path.join(P.app, 'companies.json'));
const { themes } = readJson<GapsFile>(path.join(P.app, 'gaps.json'));
const h = meta.headlines;
const leads = companies.filter((c) => c.rank !== null);
const gaps = themes.filter((t) => t.bucket === 'possible_gap');

const byFamily = new Map<string, number[]>();
for (const p of postings) if (p.n > 0) byFamily.set(p.role_family, [...(byFamily.get(p.role_family) ?? []), p.overlap]);
const families = [...byFamily.entries()].filter(([, xs]) => xs.length >= 2).map(([f, xs]) => ({ f, n: xs.length, med: median(xs) ?? 0 })).sort((a, b) => b.med - a.med);
const savingsByFamily = new Map<string, number>();
for (const p of postings) if (p.savings !== null) savingsByFamily.set(p.role_family, (savingsByFamily.get(p.role_family) ?? 0) + p.savings);
const topSavingsFamily = [...savingsByFamily.entries()].sort((a, b) => b[1] - a[1])[0];
const products = new Map<string, number>();
for (const c of leads) if (c.lead_product) products.set(c.lead_product, (products.get(c.lead_product) ?? 0) + 1);
const topProduct = [...products.entries()].sort((a, b) => b[1] - a[1])[0];

const preview = meta.mode === 'fixture_preview';
const lines = [
  `# Findings: ${PRODUCT_NAME}`, '',
  `Data as of ${meta.as_of}. ${h.postings} US finance postings from ${h.companies} companies, read duty by duty against Hyphenate's public capabilities (model ${meta.model}).`,
  ...(preview ? ['', '> **Fixture preview.** These numbers come from the 10 hand-labelled fixtures, not the full pipeline run. Rerun `npm run pipeline && npm run findings` with an API key for the real memo.'] : []),
  '', '## Three headline numbers', '',
  `1. **${pct(h.median_overlap)} median overlap.** The median posting has ${pct(h.median_overlap)} of its scored duties on Hyphenate's public site (covered or assisted). ${families[0] ? `${ROLE_LABELS[families[0].f] ?? families[0].f} roles are highest at ${pct(families[0].med)} median across ${families[0].n} postings.` : ''}`,
  `2. **${h.companies_with_covered_work} companies are hiring for work Hyphenate's agents already do.** That is ${h.companies_with_covered_work} of ${h.lead_companies} lead companies with at least one fully covered duty in an open role. ${topProduct ? `${topProduct[0]} is the most common lead product (${topProduct[1]} companies).` : ''}`,
  `3. **At least ${usd(h.savings_total)} a year** in posted salary is tied to duties Hyphenate's agents already handle, across ${h.savings_postings} postings (based on ${h.salary_postings} of ${h.postings} postings that list a salary). ${topSavingsFamily ? `${ROLE_LABELS[topSavingsFamily[0]] ?? topSavingsFamily[0]} roles hold the most (${usd(topSavingsFamily[1])}).` : ''} This is a floor: lowest advertised salary × covered share × 0.5. It is gross value, not net of Hyphenate's price, and it is work Hyphenate could absorb before the next hire, not people to cut.`,
  '', '## Who to call first', '',
  ...leads.slice(0, 5).map((c) => `- **${c.company}** (lead score ${c.lead_score.toFixed(0)}): ${c.open_roles} open ${c.open_roles === 1 ? 'role' : 'roles'}, ${pct(c.avg_overlap)} overlap, lead with ${c.lead_product ?? 'n/a'}.`),
  '', '## What prospects will ask about', '',
  ...(gaps.length ? gaps.slice(0, 3).map((g) => `- **${g.name}**: in ${pct(g.metrics.share_strong_leads)} of strong leads (${g.metrics.postings} postings, ${g.metrics.companies} companies). Not on Hyphenate's public site; verification pending.`) : ['- Gap themes appear after the gaps stage runs.']),
  '', '## Caveats', '',
  '- The coverage map is our reading of hyphenate.ai (20 Oct 2026), not Hyphenate\'s own list.',
  '- Postings show intent to hire, not budget or real day-to-day work; duties are not weighted by time.',
  '- Public job boards over-represent venture-backed tech; employee bands are unverified estimates.',
  '- Every number above links to its evidence in the dashboard.',
];
fs.writeFileSync('FINDINGS.md', lines.join('\n') + '\n');
console.log(lines.join('\n'));
