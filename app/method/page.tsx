import type { Metadata } from 'next';
import Link from 'next/link';
import { Container, Mono, Note, PageHero, Section } from '@/components/ui';
import { StageList, type Stage } from '@/components/StageList';
import { Formula, Frac } from '@/components/Math';
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

      <Section id="coverage" eyebrow="Coverage map" title="Hyphenate’s 30 capabilities and features, across its five products.">
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

      <Section id="scoring" eyebrow="Formulas and assumptions" title="How every number is worked out.">
        <p className="mb-8 max-w-[760px] text-[15px] leading-relaxed text-ink/80">
          Every number starts from one thing: for each open role, which of its duties Hyphenate does end to end, which it prepares for a person to approve, and which it does not mention.
          The rest is simple arithmetic on those counts and the posted salary.
        </p>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Formula title="1. Overlap of a role" desc="The share of a role’s duties that are on Hyphenate’s site. This is the percentage shown throughout the site."
            note={<>For the lead score, duties Hyphenate only prepares count {C.OVERLAP.assistedWeight === 0.5 ? 'half' : `${C.OVERLAP.assistedWeight}×`}. This is called the weighted overlap.</>}>
            Overlap = <Frac num="duties Hyphenate does + duties it prepares" den="all duties in the role" />
          </Formula>

          <Formula title="2. How much work Hyphenate can do for a company" desc="Mostly how much of each open role Hyphenate covers, plus a bonus for hiring several finance roles at once."
            note={<>Three open accounts payable roles count for more than one. The bonus stops growing after {C.PAIN.rolesCap} roles.</>}>
            Work score = {C.PAIN.overlapWeight} × average weighted overlap + {C.PAIN.rolesWeight} × <Frac num={`open roles (up to ${C.PAIN.rolesCap})`} den={C.PAIN.rolesCap} />
          </Formula>

          <Formula title="3. How much the company looks like a Hyphenate customer" desc="Three things Hyphenate’s best customers tend to have: an ERP it runs on, a decent size, and complex finance."
            note={
              <ul className="space-y-1">
                <li><b className="font-medium text-ink">ERP:</b> {C.ERP_SCORES.enterprise} for NetSuite, SAP, Sage Intacct, Microsoft Dynamics or Oracle · {C.ERP_SCORES.notStated} if not stated · {C.ERP_SCORES.smbOnly} for QuickBooks or Xero only.</li>
                <li><b className="font-medium text-ink">Size:</b> bigger scores higher. {C.SIZE_BRACKETS.map((b) => `${b.label} employees → ${b.score}`).join(' · ')} · unknown → {C.SIZE_UNKNOWN_SCORE}.</li>
                <li><b className="font-medium text-ink">Complexity:</b> several entities, currencies, usage-based billing or high volume. {C.COMPLEXITY_SCORES.twoOrMore} for two or more · {C.COMPLEXITY_SCORES.one} for one · {C.COMPLEXITY_SCORES.none} for none.</li>
              </ul>
            }>
            Fit score = {C.FIT_WEIGHTS.erp} × ERP + {C.FIT_WEIGHTS.size} × size + {C.FIT_WEIGHTS.complexity} × complexity
          </Formula>

          <Formula title="4. Lead score" desc="Combines the two scores above into one number from 0 to 100. Companies are ranked by it."
            note="The slider on the Leads page changes the balance between the two parts.">
            Lead score = 100 × ( {pct(C.LEAD_WEIGHTS.pain)} × work score + {pct(C.LEAD_WEIGHTS.fit)} × fit score )
          </Formula>

          <Formula title="5. Minimum savings for a role" desc="The part of a role’s salary tied to duties Hyphenate does end to end. It is deliberately low."
            note={<>Hourly pay is converted at {C.SALARY.hoursPerYear.toLocaleString()} hours a year. No salary posted means no figure, and roles with fewer than {C.OVERLAP.thinPostingMinDuties} duties are left out. The {C.SAVINGS_DEFAULTS.discount} safety discount allows for review time and duties that take unequal time.</>}>
            Minimum savings = lowest posted salary × <Frac num="duties Hyphenate does end to end" den="all duties in the role" /> × {C.SAVINGS_DEFAULTS.discount}
          </Formula>

          <Formula title="6. Totals" desc="A company’s minimum savings add up its roles. The Overview’s salary figure measures the size of the opportunity rather than savings."
            note={<>The salary figure uses the middle of each posted pay range and counts roles where at least {pct(C.OVERLAP.salaryHeadlineMinOverlap)} of duties are on Hyphenate’s site.</>}>
            Overview salary = sum of mid-range salaries for roles with overlap ≥ {pct(C.OVERLAP.salaryHeadlineMinOverlap)}
          </Formula>

          <Formula title="7. Ranking gaps" desc="A gap matters most when it shows up in a role Hyphenate otherwise covers well, because that is where it could block a deal."
            note={<>A strong role is one with at least {pct(C.OVERLAP.strongLeadOverlap)} overlap. Salary attached adds up each role’s lowest posted salary times the share of its duties in the theme.</>}>
            Gap rank = <Frac num="strong roles that include the gap" den="all strong roles" />
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
