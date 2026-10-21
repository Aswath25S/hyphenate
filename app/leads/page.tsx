import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Container, EmptyState, PageHero, Section } from '@/components/ui';
import { LeadsView, type LeadRow } from '@/components/LeadsView';
import { getCompanies, getMeta, getPostings } from '@/lib/data';
import { pct } from '@/lib/format';

export const metadata: Metadata = { title: 'Leads' };

export default function LeadsPage() {
  const meta = getMeta();
  if (!meta) return <Section><EmptyState /></Section>;
  const companies = getCompanies();
  const postings = getPostings();
  const leads = companies.filter((c) => !c.excluded);
  const rows: LeadRow[] = leads.map((c) => {
    const ps = postings.filter((p) => c.posting_ids.includes(p.posting_id));
    return {
      slug: c.slug, company: c.company, domain: c.domain, pain: c.pain, fit: c.fit, timing: c.timing,
      avg_overlap: c.avg_overlap, avg_weighted_overlap: c.avg_weighted_overlap, open_roles: c.open_roles,
      savings_total: c.savings_total, savings_roles: c.savings_roles, salary_roles: c.salary_roles, lead_product: c.lead_product,
      top_trigger: c.top_trigger ? { trigger_type: c.top_trigger.trigger_type, event_date: c.top_trigger.event_date, url: c.top_trigger.url, headline: c.top_trigger.headline, weight: c.top_trigger.weight, age_multiplier: c.top_trigger.age_multiplier } : null,
      news_searched: c.news_searched, erp: c.erp, erp_class: c.erp_class, erp_score: c.erp_score, size_class: c.size_class, size_score: c.size_score,
      employee_band: c.employee_band, complexity_score: c.complexity_score, complexity_count: c.complexity_count, complexity_flags: c.complexity_flags,
      hq_state: c.hq_state, role_families: [...new Set(ps.map((p) => p.role_family))],
      covered_share_avg: ps.length ? ps.reduce((a, p) => a + p.covered_share, 0) / ps.length : 0,
      tools: c.tools, has_brief: Boolean(c.brief),
      roles: [...ps].sort((a, b) => b.overlap - a.overlap).map((p) => ({ posting_id: p.posting_id, title: p.title, role_family: p.role_family, source_url: p.source_url, overlap: p.overlap, covered_share: p.covered_share, salary_min: p.salary_min, savings: p.savings })),
    };
  });
  const strong = leads.filter((c) => c.avg_overlap >= 0.5).length;
  const top = leads[0];
  return (
    <>
      <PageHero
        eyebrow="The leads"
        title={<>{strong} companies are hiring for roles where at least half the duties are on Hyphenate&apos;s site.</>}
        sub={top ? <>Every company gets a lead score from 0 to 100. By default, half of it reflects how much of the work in its open finance jobs Hyphenate already does, a quarter how closely it resembles a typical Hyphenate customer, and a quarter whether recent news suggests it is ready to buy. {top.company} scores highest. Click any row to see its open jobs and why it scored the way it did.</> : undefined}
        meta={`As of ${meta.as_of} · median overlap ${pct(meta.headlines.median_overlap)}`}
      />
      <section className="hatch border-b border-line py-10 sm:py-14">
        <Container>
          <Suspense fallback={<div className="card p-8 text-ink-muted">Loading leads…</div>}>
            <LeadsView rows={rows} excludedCount={companies.length - leads.length} />
          </Suspense>
        </Container>
      </section>
    </>
  );
}
