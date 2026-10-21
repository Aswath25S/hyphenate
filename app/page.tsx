import Link from 'next/link';
import { Container, EmptyState, Mono, Note, OverlapBar, PageHero, Section, StatBlock } from '@/components/ui';
import { getCompanies, getGaps, getMeta } from '@/lib/data';
import { TRIGGER_LABELS, pct, usd } from '@/lib/format';

export default function Overview() {
  const meta = getMeta();
  if (!meta) {
    return (
      <>
        <PageHero eyebrow="Before the Next Hire" title="Finance job postings, read duty by duty." sub="A prospect-intelligence prototype. It reads finance job postings, splits each into single duties, and measures how many of them an AI finance platform already advertises." />
        <Section><EmptyState /></Section>
      </>
    );
  }
  const h = meta.headlines;
  const companies = getCompanies();
  const leads = companies.filter((c) => c.rank !== null).slice(0, 5);
  const gaps = getGaps().themes.filter((t) => t.bucket === 'possible_gap').slice(0, 3);
  return (
    <>
      <PageHero
        eyebrow="The finding"
        title={<>{h.companies_with_covered_work} companies are hiring for work Hyphenate&apos;s agents already do.</>}
        sub={<>Across {h.postings} open finance postings from {h.companies} US companies, the median posting has {pct(h.median_overlap)} of its duties on Hyphenate&apos;s public site. That is work an AI platform could absorb before the next hire.</>}
        meta={`As of ${meta.as_of} · ${h.postings} postings · ${h.companies} companies`}
      >
        <div className="flex flex-wrap gap-3 pt-2">
          <Link href="/leads" className="btn-primary">See the leads</Link>
          <Link href="/method" className="btn-secondary">How it works</Link>
        </div>
      </PageHero>

      <section className="hatch border-b border-line py-12 sm:py-16">
        <Container>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatBlock value={h.postings} label="Postings analysed" href="/method#data" />
            <StatBlock value={h.companies} label="Companies" href="/leads" />
            <StatBlock value={pct(h.median_overlap)} label="Median overlap" href="/savings#roles" note="Covered + assisted duties ÷ scored duties" />
            <StatBlock value={usd(h.savings_total, { compact: true })} label="Minimum $ a year" href="/savings" note={`Based on ${h.savings_postings} of ${h.postings} postings`} />
          </div>
        </Container>
      </section>

      <Section eyebrow="The leads" title="Top five companies to call first." action={<Link href="/leads" className="btn-secondary">All {h.lead_companies} leads</Link>}>
        <div className="card overflow-hidden">
          {leads.map((c) => (
            <Link key={c.slug} href={`/companies/${c.slug}`} className="dash-row grid grid-cols-[2.25rem_1fr_auto] items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-tint sm:grid-cols-[2.5rem_1.6fr_1fr_1fr_5rem]">
              <span className="num font-mono text-[13px] text-ink-muted">{String(c.rank).padStart(2, '0')}</span>
              <span>
                <span className="t-card block">{c.company}</span>
                <Mono>{c.open_roles} open {c.open_roles === 1 ? 'role' : 'roles'} · {c.lead_product ?? 'no lead product'}</Mono>
              </span>
              <span className="hidden sm:block">
                <OverlapBar covered={c.avg_overlap ? c.avg_weighted_overlap - (c.avg_overlap - c.avg_weighted_overlap) : 0} assisted={c.avg_overlap ? 2 * (c.avg_overlap - c.avg_weighted_overlap) : 0} />
                <Mono className="mt-1 block">{pct(c.avg_overlap)} overlap</Mono>
              </span>
              <span className="hidden text-[14px] text-ink/80 sm:block">{c.top_trigger ? TRIGGER_LABELS[c.top_trigger.trigger_type] : <span className="text-ink-muted">{c.news_searched ? "No trigger found" : "News not searched"}</span>}</span>
              <span className="num text-right text-[28px] leading-none tracking-[-0.03em] text-ink-display">{c.lead_score.toFixed(0)}</span>
            </Link>
          ))}
        </div>
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
