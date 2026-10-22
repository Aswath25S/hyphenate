import type { Metadata } from 'next';
import Link from 'next/link';
import { Container, Mono, Note, PageHero, Section } from '@/components/ui';
import { getMeta } from '@/lib/data';
import * as C from '@/config/scoring';
import { COVERAGE_AS_OF } from '@/config/site';
import { pct, shortDate } from '@/lib/format';
import coverageMap from '@/config/coverage_map.json';

export const metadata: Metadata = { title: 'Method' };

const STAGES = [
  ['collect', 'Fetch postings from public Greenhouse, Lever and Ashby job-board APIs for the seed companies.', false],
  ['filter', 'Keep US finance and CFO-office roles posted in the last 60 days; dedupe near-identical postings.', 'unclear titles'],
  ['extract', 'Turn each posting into structured fields and single duties, each with a verbatim source span.', true],
  ['match', 'Label each scored duty against the 30-capability coverage map.', true],
  ['score', 'Compute overlap, fit, pain and minimum savings. Pure code: the same labels always give the same numbers.', false],
  ['gaps', 'Normalise uncovered duties into canonical tasks and cluster them into themes.', true],
  ['brief', 'Write a short brief per top-15 company from structured data only; fact-check it in code.', true],
  ['publish', 'Write the JSON files this dashboard reads.', false],
] as const;

const LIMITS = [
  'A posting shows pain and intent to hire, not budget or the real day-to-day work.',
  'Duties are not weighted by time spent; the 50% discount stands in for that.',
  "The coverage map is a reading of Hyphenate's public site and needs checking with Hyphenate.",
  'Public job boards over-represent tech and venture-backed companies.',
  'Salary data exists only where postings list it, mostly in states that require ranges.',
  'Model labels can be wrong; confidence scores and the evidence view let people check.',
  'Employee bands in the seed list are unverified estimates until replaced with a public source.',
];

function KV({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="divide-y divide-dashed divide-line-dashed">
      {rows.map(([k, v], i) => <div key={`${i}-${k}`} className="grid grid-cols-[1fr_auto] gap-4 py-2 text-[14px]"><dt className="text-ink/80">{k}</dt><dd className="num text-right font-mono text-[13px]">{v}</dd></div>)}
    </dl>
  );
}

export default function MethodPage() {
  const meta = getMeta();
  const stats = meta?.stage_stats ?? {};
  const cost = meta?.cost_report ?? {};
  const totalCost = Object.values(cost).reduce((a, s) => a + s.cost_usd, 0);
  const caps = coverageMap.capabilities;
  return (
    <>
      <PageHero
        eyebrow="The method"
        title="Every number traces back to the posting text that produced it."
        sub="One extraction engine feeds three outputs: a ranked lead list, a gap report and a minimum cost-savings estimate. An OpenAI GPT model reads and labels; code does all the arithmetic."
        meta={meta ? `As of ${meta.as_of} · model ${meta.model} · generated ${shortDate(meta.generated_at)}` : 'No pipeline run yet'}
      />

      <Section id="how" eyebrow="How it works" title="Eight stages, each rerunnable on its own.">
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-[14px]">
            <thead className="border-b border-line"><tr>{['', 'Stage', 'What it does', 'LLM', 'In → out'].map((h, i) => <th key={i} className={`px-4 py-3 text-left font-normal ${i === 4 ? 'text-right' : ''}`}><Mono>{h}</Mono></th>)}</tr></thead>
            <tbody>
              {STAGES.map(([name, what, llm], i) => (
                <tr key={name} className="border-t border-dashed border-line-dashed align-top">
                  <td className="px-4 py-3 font-mono text-[12px] text-accent">{String(i + 1).padStart(2, '0')}</td>
                  <td className="px-4 py-3 font-medium">{name}</td>
                  <td className="px-4 py-3 text-ink/80">{what}</td>
                  <td className="px-4 py-3">{llm === true ? <span className="rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[11px] uppercase text-accent-ink">Yes</span> : llm ? <span className="text-[13px] text-ink-muted">{llm}</span> : <span className="text-ink-muted">No</span>}</td>
                  <td className="num px-4 py-3 text-right font-mono text-[13px]">{stats[name] ? `${stats[name].in} → ${stats[name].out}${stats[name].failed ? ` (${stats[name].failed} failed)` : ''}` : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="card-flat p-5 text-[14px] leading-relaxed"><Mono>Cached and validated</Mono><p className="mt-2">Every model call is cached by a hash of its input, so reruns cost nothing and results stay stable. Every response is validated against a schema, retried once on failure, then logged as failed.</p></div>
          <div className="card-flat p-5 text-[14px] leading-relaxed"><Mono>Strict labels</Mono><p className="mt-2">Covered or assisted labels need a capability id. Confidence below {C.OVERLAP.unclearConfidenceBelow} becomes unclear. A covered label on an assisted capability is downgraded to assisted.</p></div>
          <div className="card-flat p-5 text-[14px] leading-relaxed"><Mono>Spans located</Mono><p className="mt-2">{meta ? `${meta.spans.found} of ${meta.spans.total}` : '–'} duty spans were found verbatim in the posting text, so each can be highlighted in the evidence view.</p></div>
        </div>
        {Object.keys(cost).length > 0 && (
          <div className="mt-6 card overflow-x-auto">
            <table className="w-full min-w-[560px] text-[14px]">
              <thead className="border-b border-line"><tr>{['Stage', 'Model calls', 'Cache hits', 'Input tokens', 'Output tokens', 'Cost'].map((h, i) => <th key={h} className={`px-4 py-3 font-normal ${i ? 'text-right' : 'text-left'}`}><Mono>{h}</Mono></th>)}</tr></thead>
              <tbody>
                {Object.entries(cost).map(([k, v]) => (
                  <tr key={k} className="num border-t border-dashed border-line-dashed font-mono text-[13px]"><td className="px-4 py-2.5 font-sans text-[14px]">{k}</td><td className="px-4 py-2.5 text-right">{v.calls}</td><td className="px-4 py-2.5 text-right">{v.cached}</td><td className="px-4 py-2.5 text-right">{v.input_tokens.toLocaleString()}</td><td className="px-4 py-2.5 text-right">{v.output_tokens.toLocaleString()}</td><td className="px-4 py-2.5 text-right">{v.unpriced_calls ? 'price not set' : `$${v.cost_usd.toFixed(2)}`}</td></tr>
                ))}
                <tr className="num border-t border-line font-mono text-[13px]"><td className="px-4 py-2.5 font-sans font-medium">Total</td><td colSpan={4} /><td className="px-4 py-2.5 text-right font-medium">{Object.values(cost).some((v) => v.unpriced_calls) ? 'price not set' : `$${totalCost.toFixed(2)}`}</td></tr>
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section id="coverage" eyebrow="Coverage map" title="30 capabilities across five products.">
        <p className="mb-6 max-w-[760px] text-[15px] text-ink/80">Our reading of claims on hyphenate.ai&apos;s <a className="link" href="https://hyphenate.ai/platform" target="_blank" rel="noreferrer">platform</a> and <a className="link" href="https://hyphenate.ai/controller" target="_blank" rel="noreferrer">controller</a> pages as of {COVERAGE_AS_OF}. <b className="font-medium">Based on public site, to be validated.</b> It is not Hyphenate&apos;s own list. Covered means the site says the agent does the work end to end; assisted means the agent prepares it and a person approves, or the task needs judgment.</p>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[820px] text-[14px]">
            <thead className="border-b border-line"><tr>{['Id', 'Product', 'Capability', 'Default', 'Not included (near misses)'].map((h) => <th key={h} className="px-4 py-3 text-left font-normal"><Mono>{h}</Mono></th>)}</tr></thead>
            <tbody>
              {caps.map((c) => (
                <tr key={c.id} className="border-t border-dashed border-line-dashed align-top">
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[12px] text-ink-muted">{c.id}</td>
                  <td className="whitespace-nowrap px-4 py-2.5">{c.product}</td>
                  <td className="px-4 py-2.5">{c.capability}</td>
                  <td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 font-mono text-[11px] uppercase ${c.default_level === 'covered' ? 'bg-success-soft text-success-ink' : 'bg-accent-soft text-accent-ink'}`}>{c.default_level}</span></td>
                  <td className="px-4 py-2.5 text-[13px] text-ink-muted">{c.not_included.join('; ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4"><Note>Known areas the public site does not advertise, used to seed the gap analysis: {coverageMap.known_not_advertised.join(', ')}.</Note></div>
      </Section>

      <Section id="scoring" eyebrow="Every assumption" title="All weights live in one config file.">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="card p-5"><Mono>Overlap</Mono>
            <KV rows={[['Covered share', 'C ÷ n'], ['Overlap (headline)', '(C + A) ÷ n'], ['Weighted overlap (lead score)', `(C + ${C.OVERLAP.assistedWeight}A) ÷ n`], ['Thin posting', `< ${C.OVERLAP.thinPostingMinDuties} scored duties`], ['Strong lead (gaps)', `overlap ≥ ${pct(C.OVERLAP.strongLeadOverlap)}`]]} /></div>
          <div className="card p-5"><Mono>Lead score</Mono>
            <KV rows={[['Weight: Hyphenate can do the work (pain)', pct(C.LEAD_WEIGHTS.pain)], ['Weight: looks like a customer (fit)', pct(C.LEAD_WEIGHTS.fit)], ['Pain, overlap part', `${C.PAIN.overlapWeight} × avg weighted overlap`], ['Pain, open-roles part', `${C.PAIN.rolesWeight} × min(roles, ${C.PAIN.rolesCap}) ÷ ${C.PAIN.rolesCap}`], ['Fit formula', `${C.FIT_WEIGHTS.erp} ERP + ${C.FIT_WEIGHTS.size} size + ${C.FIT_WEIGHTS.complexity} complexity`]]} /></div>
          <div className="card p-5"><Mono>Fit factors</Mono>
            <KV rows={[['ERP: NetSuite, SAP, Intacct, Dynamics, Oracle', C.ERP_SCORES.enterprise], ['ERP: not stated', C.ERP_SCORES.notStated], ['ERP: QuickBooks or Xero only', C.ERP_SCORES.smbOnly], [`Size ${C.SIZE_BAND.min.toLocaleString()}–${C.SIZE_BAND.max.toLocaleString()}`, C.SIZE_SCORES.inBand], ['Size unknown / outside', `${C.SIZE_SCORES.unknown} / ${C.SIZE_SCORES.outOfBand}`], ['Complexity 2+ / 1 / none', `${C.COMPLEXITY_SCORES.twoOrMore} / ${C.COMPLEXITY_SCORES.one} / ${C.COMPLEXITY_SCORES.none}`]]} /></div>
          <div className="card p-5"><Mono>Minimum savings</Mono>
            <KV rows={[['Formula', 'salary_min × C/n × d'], ['Salary used', 'Bottom of range'], ['Discount d', C.SAVINGS_DEFAULTS.discount], ['Assisted duties', 'Off (or 0.25)'], ['Loaded-cost multiplier', C.SAVINGS_DEFAULTS.loadedCostMultiplier], ['Hourly pay', `× ${C.SALARY.hoursPerYear.toLocaleString()} hours`]]} /></div>
          <div className="card p-5"><Mono>Collection</Mono>
            <KV rows={[['Posting window', `${C.FILTER.maxAgeDays} days`], ['Dedupe similarity', `≥ ${pct(C.FILTER.dedupeSimilarity)}`], ['Briefs for top companies', C.BRIEFS.topCompanies], ['Gap themes', `${C.GAPS.minThemes}–${C.GAPS.maxThemes}, merge < ${C.GAPS.minThemeSize}`]]} /></div>
        </div>
        <div className="mt-6 space-y-2">
          <Note>No salary in the posting means no figure; we never estimate one. Thin postings are excluded from savings. Savings are gross value, not net of Hyphenate&apos;s price, and always framed as work Hyphenate could absorb before the next hire.</Note>
          <Note>Existing customers named on hyphenate.ai and finance-software vendors stay in research totals but never appear as leads.</Note>
        </div>
      </Section>

      <Section id="limits" eyebrow="Known limits" title="What this cannot tell you.">
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {LIMITS.map((l) => <li key={l} className="card-flat p-4 text-[15px]">{l}</li>)}
        </ul>
      </Section>

      <Section id="data" eyebrow="Data sources" title="Public APIs and feeds only.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="card p-5 text-[14px] leading-relaxed">
            <Mono>Job postings</Mono>
            <p className="mt-2">Greenhouse, Lever and Ashby public job-board APIs, which companies publish for exactly this purpose. {meta?.collection.seeds ? `${meta.collection.seeds} seed companies, ${meta.collection.total_jobs?.toLocaleString()} jobs scanned, fetched ${shortDate(meta.collection.at)}.` : ''} One request per second per host, an honest user agent. LinkedIn, Indeed and Glassdoor are never fetched.</p>
          </div>
          <div className="card p-5 text-[14px] leading-relaxed">
            <Mono>Hyphenate&apos;s capabilities</Mono>
            <p className="mt-2">hyphenate.ai/platform and hyphenate.ai/controller, read on {COVERAGE_AS_OF}. Colours and type were matched to the public site&apos;s CSS; no logos, imagery or copy were reused.</p>
          </div>
          <div className="card p-5 text-[14px] leading-relaxed">
            <Mono>Privacy</Mono>
            <p className="mt-2">Data is kept at company level. No recruiter or hiring-manager names are stored. Text pasted into the <Link href="/try" className="link">live demo</Link> is never stored or logged.</p>
          </div>
        </div>
      </Section>
    </>
  );
}
