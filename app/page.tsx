import Link from 'next/link';
import { Container, EmptyState, Mono, Note, OverlapBar, OverlapLegend, PageHero, Section, StatBlock } from '@/components/ui';
import { getCompanies, getGaps, getMeta, getPostings } from '@/lib/data';
import { ROLE_LABELS, pct, shortDate, usd } from '@/lib/format';
import { PRODUCT_NAME } from '@/config/site';

export default function Overview() {
  const meta = getMeta();
  if (!meta) {
    return (
      <>
        <PageHero eyebrow={PRODUCT_NAME} title="Finance job postings, read duty by duty." sub="A prospect-intelligence prototype. It reads finance job postings, splits each into single duties, and measures how many of them an AI finance platform already advertises." />
        <Section><EmptyState /></Section>
      </>
    );
  }
  const h = meta.headlines;
  const excluded = h.companies - h.lead_companies;
  const companies = getCompanies();
  const postings = getPostings();
  const leads = companies.filter((c) => c.rank !== null).slice(0, 5);
  const gaps = getGaps().themes.filter((t) => t.bucket === 'possible_gap').slice(0, 3);
  return (
    <>
      <PageHero
        eyebrow="The finding"
        title={<>{h.companies_with_covered_work} companies are hiring for work Hyphenate&apos;s agents already do.</>}
        sub={<>We analysed {h.postings} open finance postings from {h.companies} US companies. {h.lead_companies} of those companies are leads{excluded ? <> ({excluded} finance-software {excluded === 1 ? 'vendor is' : 'vendors are'} analysed but never shown as {excluded === 1 ? 'a lead' : 'leads'})</> : null}, and {h.companies_with_covered_work} of the leads have at least one open role with a duty Hyphenate fully covers. The median posting has {pct(h.median_overlap)} of its duties on Hyphenate&apos;s public site. That is work that Hyphenate could replace.</>}
        meta={`As of ${shortDate(meta.as_of)} · ${h.postings} postings · ${h.companies} companies`}
      >
        <div className="flex flex-wrap gap-3 pt-2">
          <Link href="/leads" className="btn-primary">See the leads</Link>
          <Link href="/method" className="btn-secondary">How it works</Link>
        </div>
      </PageHero>

      <section className="hatch border-b border-line py-12 sm:py-16">
        <Container>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatBlock value={h.postings} label="Postings analysed" href="/method#data" note="Open US finance roles, last 60 days" />
            <StatBlock value={h.companies} label="Companies analysed" href="/leads" note={excluded ? `${h.lead_companies} are leads; ${excluded} software ${excluded === 1 ? 'vendor' : 'vendors'} excluded` : `All ${h.lead_companies} are leads`} />
            <StatBlock value={pct(h.median_overlap)} label="Median overlap" href="/savings#roles" note="Covered + assisted duties ÷ scored duties" />
            <StatBlock value={usd(h.overlap_salary_total, { compact: true })} label="Salary in roles Hyphenate overlaps" href="/savings" note={`Yearly pay of the roles where at least ${pct(h.overlap_salary_min_overlap)} of the duties are on Hyphenate's site`} />
          </div>
        </Container>
      </section>

      <Section eyebrow="The leads" title="Top five companies to call first." action={<Link href="/leads" className="btn-secondary">All {h.lead_companies} lead companies</Link>}>
        <OverlapLegend className="mb-4" />
        <div className="card overflow-hidden">
          <div className="hidden gap-6 border-b border-line px-5 py-3 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <Mono>Company</Mono><Mono>Open finance roles</Mono><Mono>Role type</Mono><Mono>Work Hyphenate does</Mono>
          </div>
          {leads.map((c) => {
            const roles = postings.filter((p) => c.posting_ids.includes(p.posting_id)).sort((a, b) => b.overlap - a.overlap);
            const covered = roles.length ? roles.reduce((a, p) => a + p.covered_share, 0) / roles.length : 0;
            return (
              <Link key={c.slug} href={`/companies/${c.slug}`} className="dash-row grid grid-cols-1 gap-3 px-5 py-4 transition-colors hover:bg-surface-tint md:h-[78px] md:items-center md:gap-6 md:py-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <span className="t-card truncate">{c.company}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[14px]" title={roles.map((p) => p.title).join('\n')}>{roles[0]?.title ?? '–'}</span>
                  <Mono className="mt-0.5 block">{roles.length > 1 ? `+${roles.length - 1} more ${roles.length - 1 === 1 ? 'role' : 'roles'}` : '1 open role'}</Mono>
                </span>
                <span className="min-w-0">
                  {(() => {
                    const families = [...new Set(roles.map((p) => ROLE_LABELS[p.role_family] ?? p.role_family))];
                    return (
                      <>
                        <span className="block truncate text-[14px] text-ink/80" title={families.join(', ')}>{families[0] ?? '–'}</span>
                        <Mono className="mt-0.5 block">{families.length > 1 ? `+${families.length - 1} more ${families.length - 1 === 1 ? 'type' : 'types'}` : roles.length > 1 ? 'all roles' : '\u00a0'}</Mono>
                      </>
                    );
                  })()}
                </span>
                <span>
                  <OverlapBar covered={covered} assisted={Math.max(0, c.avg_overlap - covered)} />
                  <Mono className="mt-1 block">{pct(c.avg_overlap)} of duties</Mono>
                </span>
              </Link>
            );
          })}
        </div>
        <div className="mt-3"><Note>Ranked by lead score, which also weighs how closely each company resembles a Hyphenate customer. See <Link href="/leads" className="link">all lead companies</Link> for the full ranking.</Note></div>
      </Section>

      <Section eyebrow="The gaps" title="What postings ask for that Hyphenate's site does not mention." action={<Link href="/gaps" className="btn-secondary">All gap themes</Link>}>
        {gaps.length ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {gaps.map((g) => (
              <Link key={g.theme_id} href={`/gaps#${g.theme_id}`} className="card block p-6 transition-transform hover:-translate-y-0.5">
                <Mono>{pct(g.metrics.share_strong_leads)} of strong leads</Mono>
                <p className="t-sub mt-3">{g.name}</p>
                <p className="mt-2 text-[15px] text-ink/75">{g.description}</p>
                <Mono className="mt-4 block">{g.metrics.postings} postings · {g.metrics.companies} companies</Mono>
              </Link>
            ))}
          </div>
        ) : (
          <Note>Gap themes appear after the gaps stage runs.</Note>
        )}
        <div className="mt-8"><Note>&ldquo;Not on Hyphenate&apos;s public site&rdquo; means exactly that. It is not a claim that Hyphenate cannot do the work.</Note></div>
      </Section>

      <Section>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="t-sub max-w-[760px]">Every score, gap and dollar figure links back to the posting text that produced it.</p>
          <Link href="/method" className="btn-primary">Read the method</Link>
        </div>
      </Section>
    </>
  );
}
