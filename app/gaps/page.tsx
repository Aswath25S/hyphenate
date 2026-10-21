import type { Metadata } from 'next';
import { Container, EmptyState, PageHero, Section } from '@/components/ui';
import { GapsView } from '@/components/GapsView';
import { getCompanies, getGaps, getMeta } from '@/lib/data';
import { pct } from '@/lib/format';

export const metadata: Metadata = { title: 'Gaps' };

export default function GapsPage() {
  const meta = getMeta();
  const { themes } = getGaps();
  if (!meta) return <Section><EmptyState /></Section>;
  const companies = Object.fromEntries(getCompanies().map((c) => [c.domain, { name: c.company, slug: c.slug }]));
  const gaps = themes.filter((t) => t.bucket === 'possible_gap');
  const top = gaps[0];
  const strongTotal = top?.metrics.strong_postings_total ?? themes[0]?.metrics.strong_postings_total ?? meta.headlines.strong_postings;
  return (
    <>
      <PageHero
        eyebrow="The gaps"
        title={top ? <>{top.name} shows up in {pct(top.metrics.share_strong_leads)} of strong leads and is not on Hyphenate&apos;s public site.</> : <>What finance postings ask for that Hyphenate does not advertise.</>}
        sub="Every duty labelled human, gap candidate or unclear is grouped into a theme. Possible gaps are product input: what to build next, and what prospects will ask about. This is not a claim that Hyphenate cannot do the work."
        meta={`${gaps.length} possible gaps · ${themes.length} themes · ${themes.reduce((a, t) => a + t.duty_ids.length, 0)} duties`}
      />
      <section className="py-12 sm:py-16">
        <Container>
          {themes.length ? <GapsView themes={themes} companies={companies} strongTotal={strongTotal} /> : <EmptyState title="Gap themes appear after the gaps stage runs." />}
        </Container>
      </section>
    </>
  );
}
