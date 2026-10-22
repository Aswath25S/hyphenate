import type { Metadata } from 'next';
import Link from 'next/link';
import { Container, Mono, Note, PageHero, Section } from '@/components/ui';
import { StageList, type Stage } from '@/components/StageList';
import { Formula, Frac, V } from '@/components/Math';
import { getMeta } from '@/lib/data';
import * as C from '@/config/scoring';
import { COVERAGE_AS_OF } from '@/config/site';
import { pct, shortDate } from '@/lib/format';
import coverageMap from '@/config/coverage_map.json';

export const metadata: Metadata = { title: 'Method' };

const STAGES: Stage[] = [
  { key: 'collect', name: 'Collect', summary: 'Fetch open jobs from public job boards.', details: [
    'Each seed company publishes its open jobs through a public Greenhouse, Lever or Ashby job board. These boards have APIs meant for exactly this kind of reading.',
    'We download every open job, keep the ones whose titles look like finance roles, and store the full description with its source link and the time it was fetched. LinkedIn, Indeed and Glassdoor are never touched.',
  ] },
  { key: 'filter', name: 'Filter', summary: 'Keep recent US finance roles and remove duplicates.', details: [
    'A role is kept when its title is a finance or CFO-office role (accounts payable and receivable, accountants, controllers, treasury, FP&A, payroll, tax), it is based in the US, and it was posted in the last 60 days. Unclear titles are checked by the language model.',
    'The same role is often posted several times, once per location. Those copies are merged into one role, and every location’s pay range is kept.',
  ] },
  { key: 'extract', name: 'Extract', summary: 'Split each posting into single duties.', details: [
    'A language model reads each posting and lists the separate tasks it describes, one action per duty, for example "Apply customer payments daily". Each duty keeps the exact sentence it came from, which is what the role breakdown page highlights.',
    'It also records the salary, ERP, tools and signs of complexity such as multiple entities. Qualifications and culture lines are marked so they are not counted as work.',
  ] },
  { key: 'match', name: 'Match', summary: 'Compare every duty with what Hyphenate offers.', details: [
    'Each duty is compared with 30 capabilities read from Hyphenate’s website. It is labelled as something Hyphenate does end to end, something it prepares for a person to approve, work that needs a person, a possible gap, or too vague to judge.',
    'When the model is unsure, the stricter label wins. Low-confidence labels become "too vague", so uncertain matches never inflate the numbers.',
  ] },
  { key: 'score', name: 'Score', summary: 'Turn the labels into overlap, lead scores and savings.', details: [
    'Plain arithmetic, no model: the same labels always give the same numbers. The formulas are listed in the next section.',
  ] },
  { key: 'gaps', name: 'Find gaps', summary: 'Group the work Hyphenate does not mention into themes.', details: [
    'Every duty that is not on Hyphenate’s site is rewritten as a short standard task, then grouped into themes such as sales tax filing or expense report review.',
    'Themes are ranked by how often they show up in otherwise strong leads, because a gap inside a good lead is the one most likely to come up in a sales call.',
  ] },
  { key: 'brief', name: 'Write briefs', summary: 'Write a short sales brief for the top 15 companies.', details: [
    'The model writes each brief only from the numbers already computed for that company. A code check then confirms that every number and name in the brief appears in that data; a brief that fails is rewritten once, then dropped.',
  ] },
  { key: 'publish', name: 'Publish', summary: 'Package everything for this website.', details: [
    'The results are saved as files that this site reads. The site itself never calls a language model, so every page shows exactly what the pipeline produced.',
  ] },
];

const LIMITS = [
  'A posting shows pain and intent to hire, not budget or the real day-to-day work.',
  'Duties are not weighted by time spent; the 50% discount stands in for that.',
  "The coverage map is a reading of Hyphenate's public site and needs checking with Hyphenate.",
  'Public job boards over-represent tech and venture-backed companies.',
  'Salary data exists only where postings list it, mostly in states that require ranges.',
  'Model labels can be wrong; confidence scores and the evidence view let people check.',
  'Employee bands in the seed list are unverified estimates until replaced with a public source.',
];

export default function MethodPage() {
  const meta = getMeta();
  const caps = coverageMap.capabilities;
  return (
    <>
      <PageHero
        eyebrow="The method"
        title="Every number traces back to the posting text that produced it."
        sub="One extraction engine feeds three outputs: a ranked lead list, a gap report and a minimum cost-savings estimate. An OpenAI GPT model reads and labels; code does all the arithmetic."
        meta={meta ? `As of ${meta.as_of} · model ${meta.model} · generated ${shortDate(meta.generated_at)}` : 'No pipeline run yet'}
      />

      <Section id="how" eyebrow="How it works" title="Eight steps from job posting to lead.">
        <p className="mb-6 max-w-[760px] text-[15px] leading-relaxed text-ink/80">Click a step to see what it does.</p>
        <StageList stages={STAGES} />
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

      <Section id="scoring" eyebrow="Formulas and assumptions" title="The maths behind every number.">
        <p className="mb-8 max-w-[760px] text-[15px] leading-relaxed text-ink/80">
          For one open role, let <V>n</V> be the number of duties the model found, <V>C</V> the duties Hyphenate does end to end, and <V>A</V> the duties it prepares for a person to approve.
          Everything else is built from these three counts and the posted salary.
        </p>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Formula title="1 · Overlap of one role" where={[
            [<V key="o">overlap</V>, 'Share of the role’s duties on Hyphenate’s site. This is the percentage shown across the site.'],
            [<V key="w">w</V>, `Weighted overlap: duties Hyphenate only prepares count ${C.OVERLAP.assistedWeight === 0.5 ? 'half' : C.OVERLAP.assistedWeight}. Used in the lead score.`],
          ]}>
            <V>overlap</V> = <Frac num={<><V>C</V> + <V>A</V></>} den={<V>n</V>} />
            <span className="mx-4 text-ink-muted">and</span>
            <V>w</V> = <Frac num={<><V>C</V> + {C.OVERLAP.assistedWeight}<V>A</V></>} den={<V>n</V>} />
          </Formula>

          <Formula title="2 · How much work Hyphenate can do for a company (pain)" where={[
            [<V key="w">w̄</V>, 'Average weighted overlap across the company’s open finance roles.'],
            [<V key="r">R</V>, `Number of open finance roles; more roles mean more pain, up to ${C.PAIN.rolesCap}.`],
          ]}>
            <V>P</V> = {C.PAIN.overlapWeight}<V>w̄</V> + {C.PAIN.rolesWeight} · <Frac num={<>min(<V>R</V>, {C.PAIN.rolesCap})</>} den={C.PAIN.rolesCap} />
          </Formula>

          <Formula title="3 · How much the company looks like a Hyphenate customer (fit)" where={[
            [<V key="e">E</V>, <>ERP: {C.ERP_SCORES.enterprise} for NetSuite, SAP, Sage Intacct, Microsoft Dynamics or Oracle; {C.ERP_SCORES.notStated} if not stated; {C.ERP_SCORES.smbOnly} for QuickBooks or Xero only.</>],
            [<V key="s">S</V>, <>Size by employees: {C.SIZE_BRACKETS.map((b) => `${b.label} → ${b.score}`).join(', ')}; unknown → {C.SIZE_UNKNOWN_SCORE}.</>],
            [<V key="x">X</V>, <>Complex finance (several entities, currencies, usage-based billing or high volume): {C.COMPLEXITY_SCORES.twoOrMore} for two or more signs, {C.COMPLEXITY_SCORES.one} for one, {C.COMPLEXITY_SCORES.none} for none.</>],
          ]}>
            <V>F</V> = {C.FIT_WEIGHTS.erp}<V>E</V> + {C.FIT_WEIGHTS.size}<V>S</V> + {C.FIT_WEIGHTS.complexity}<V>X</V>
          </Formula>

          <Formula title="4 · Lead score" where={[
            [<V key="a">α</V>, <>Balance between the two parts. Default {(C.LEAD_WEIGHTS.pain).toFixed(2)} (about {pct(C.LEAD_WEIGHTS.pain)}); the slider on the Leads page changes it.</>],
            [<V key="l">L</V>, 'From 0 to 100. Companies are ranked by it.'],
          ]}>
            <V>L</V> = 100 · ( <V>α</V><V>P</V> + (1 − <V>α</V>)<V>F</V> )
          </Formula>

          <Formula title="5 · Minimum savings for one role" where={[
            [<V key="s">s</V>, <>Lowest posted yearly salary. Hourly pay × {C.SALARY.hoursPerYear.toLocaleString()} hours. No salary posted means no figure.</>],
            [<V key="d">d</V>, <>Safety discount, {C.SAVINGS_DEFAULTS.discount} by default, for review time and duties that take unequal time.</>],
            [<V key="m">m</V>, <>Benefits and payroll taxes, {C.SAVINGS_DEFAULTS.loadedCostMultiplier.toFixed(1)} by default (ignored).</>],
          ]}>
            <V>M</V> = <V>s</V> · <Frac num={<V>C</V>} den={<V>n</V>} /> · <V>d</V> · <V>m</V>
          </Formula>

          <Formula title="6 · Totals" where={[
            [<V key="sm">s̃</V>, 'Middle of the posted salary range (or the single figure).'],
            [<V key="t">T</V>, `Overview figure: total salary of roles with at least ${pct(C.OVERLAP.salaryHeadlineMinOverlap)} overlap.`],
          ]}>
            <span className="whitespace-nowrap">company savings = Σ <V>M</V></span>
            <span className="mx-4 text-ink-muted">and</span>
            <span className="whitespace-nowrap"><V>T</V> = Σ <V>s̃</V> over roles with <V>overlap</V> ≥ {C.OVERLAP.salaryHeadlineMinOverlap}</span>
          </Formula>

          <Formula title="7 · Ranking gaps" where={[
            [<V key="g">G</V>, `Share of strong roles (overlap ≥ ${pct(C.OVERLAP.strongLeadOverlap)}) that include the theme.`],
            [<V key="k">k</V>, 'Duties in the role that belong to the theme.'],
          ]}>
            <V>G</V> = <Frac num="strong roles with the theme" den="all strong roles" />
            <span className="mx-4 text-ink-muted">and</span>
            salary attached = Σ <V>s</V> · <Frac num={<V>k</V>} den={<V>n</V>} />
          </Formula>
        </div>

        <h3 className="t-sub mt-14">Assumptions</h3>
        <ul className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
          {[
            `Only roles posted in the last ${C.FILTER.maxAgeDays} days count.`,
            `Copies of one role posted for different locations are merged when their descriptions are at least ${pct(C.FILTER.dedupeSimilarity)} alike.`,
            `A role with fewer than ${C.OVERLAP.thinPostingMinDuties} duties is scored but left out of savings.`,
            `A label the model is less than ${pct(C.OVERLAP.unclearConfidenceBelow)} sure of becomes "too vague", and a duty that only matches a prepare-for-approval capability is never counted as done end to end.`,
            'Duties are not weighted by how long they take; the safety discount stands in for that.',
            'Savings are gross: Hyphenate’s own price is unknown, and the figure is work it could take on before the next hire, not people to cut.',
            'Existing Hyphenate customers and finance-software vendors are analysed but never shown as leads.',
            'Employee counts are estimates and need checking against a public source.',
          ].map((a) => <li key={a} className="card-flat p-4 text-[15px] leading-relaxed">{a}</li>)}
        </ul>
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
            <p className="mt-2">Data is kept at company level. No recruiter or hiring-manager names are stored.</p>
          </div>
        </div>
      </Section>
    </>
  );
}
