import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Container, Eyebrow, Mono } from '@/components/ui';
import { PostingEvidence } from '@/components/PostingEvidence';
import { BackLink } from '@/components/BackLink';
import { getPosting, getPostings } from '@/lib/data';
import { pct, shortDate } from '@/lib/format';

export function generateStaticParams() {
  return getPostings().map((p) => ({ id: p.posting_id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const p = getPosting((await params).id);
  return { title: p ? `${p.title} at ${p.company}` : 'Posting' };
}

export default async function PostingPage({ params }: { params: Promise<{ id: string }> }) {
  const p = getPosting((await params).id);
  if (!p) notFound();
  const headline = p.n === 0
    ? 'This posting lists no scorable duties.'
    : p.C + p.A === 0
      ? `None of this role's ${p.n} duties are on Hyphenate's public site.`
      : `${p.C + p.A} of this role's ${p.n} duties are work Hyphenate's agents advertise.`;
  return (
    <>
      <section className="relative border-b border-line">
        <div aria-hidden className="hero-lines pointer-events-none absolute inset-0" />
        <Container className="relative space-y-5 pb-10 pt-10 sm:pt-14">
          <div className="flex flex-wrap gap-2">
            <BackLink href={`/companies/${p.slug}`} label={p.company} />
            <BackLink href="/leads" label="All lead companies" />
            <BackLink href="/savings" label="Roles & Savings" />
          </div>
          <Eyebrow>Role breakdown</Eyebrow>
          <div className="space-y-2">
            <h1 className="t-section max-w-[1100px]">{p.title}</h1>
            <p className="t-sub">at <Link href={`/companies/${p.slug}`} className="underline decoration-accent/40 decoration-2 underline-offset-4 hover:decoration-accent">{p.company}</Link></p>
            <Mono>{p.locations.join(' · ') || 'Location not listed'}{p.posted_at ? ` · posted ${shortDate(p.posted_at)}` : ''}</Mono>
          </div>
          <p className="max-w-[900px] text-[20px] leading-snug text-ink">{headline}</p>
          <p className="max-w-[760px] text-[15px] text-ink/70">
            Every highlight below is a duty the model split out of the original text, labelled against Hyphenate&apos;s public capabilities. Overlap {pct(p.overlap)}; savings use only duties Hyphenate does end to end.
          </p>
        </Container>
      </section>
      <section className="py-10 sm:py-14"><Container><PostingEvidence p={p} /></Container></section>
    </>
  );
}
