import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Container, EmptyState, PageHero, Section } from '@/components/ui';
import { SavingsView, type SavingsRow } from '@/components/SavingsView';
import { getMeta, getPostings } from '@/lib/data';
import { usd } from '@/lib/format';

export const metadata: Metadata = { title: 'Savings' };

export default function SavingsPage() {
  const meta = getMeta();
  if (!meta) return <Section><EmptyState /></Section>;
  const rows: SavingsRow[] = getPostings().map((p) => ({ posting_id: p.posting_id, company: p.company, slug: p.slug, title: p.title, role_family: p.role_family, salary_min: p.salary_min, salary_max: p.salary_max, n: p.n, C: p.C, A: p.A, excluded: p.excluded }));
  const h = meta.headlines;
  return (
    <>
      <PageHero
        eyebrow="The money"
        title={<>Across {h.savings_postings} postings with salaries, at least {usd(h.savings_total)} a year is tied to duties Hyphenate&apos;s agents already handle.</>}
        sub="A deliberate floor: the lowest advertised salary, times the share of fully covered duties, cut in half. Every input is shown and adjustable below."
        meta={`Based on ${h.salary_postings} of ${h.postings} postings that list a salary · gross value, not net savings`}
      />
      <section className="py-12 sm:py-16">
        <Container>
          <Suspense fallback={<div className="card p-8 text-ink-muted">Loading…</div>}><SavingsView rows={rows} /></Suspense>
        </Container>
      </section>
    </>
  );
}
