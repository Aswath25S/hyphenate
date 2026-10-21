import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Container, Eyebrow, Mono } from '@/components/ui';
import { PostingEvidence } from '@/components/PostingEvidence';
import { getPosting, getPostings } from '@/lib/data';
import { pct } from '@/lib/format';

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
        <Container className="relative space-y-5 pb-10 pt-14 sm:pt-20">
          <div className="flex flex-wrap items-center gap-3">
            <Eyebrow>The evidence</Eyebrow>
            <Mono><Link href={`/companies/${p.slug}`} className="hover:text-brand">{p.company}</Link> · {p.title}</Mono>
          </div>
          <h1 className="t-section max-w-[1000px]">{headline}</h1>
          <p className="max-w-[760px] text-[16px] text-ink/75">
            Every highlight below is a duty Claude split out of the original text, labelled against the coverage map. Overlap {pct(p.overlap)}; savings use covered duties only.
          </p>
        </Container>
      </section>
      <section className="py-10 sm:py-14"><Container><PostingEvidence p={p} /></Container></section>
    </>
  );
}
