import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Container, EmptyState, PageHero, Section } from '@/components/ui';
import { LeadsView, type LeadRow } from '@/components/LeadsView';
import { getCompanies, getMeta, getPostings } from '@/lib/data';
import { pct, shortDate } from '@/lib/format';
import { salaryMid } from '@/lib/scoring';

export const metadata: Metadata = { title: 'Leads' };

/** Average of each role's posted salary midpoint (or single figure), roles with a salary only. */
function avgSalary(ps: { salary_min: number | null; salary_max: number | null }[]): number | null {
  const xs = ps.filter((p) => p.salary_min !== null).map((p) => salaryMid(p.salary_min!, p.salary_max));
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

export default function LeadsPage() {
  const meta = getMeta();
  if (!meta) return <Section><EmptyState /></Section>;
  const companies = getCompanies();
  const postings = getPostings();
  const leads = companies.filter((c) => !c.excluded);
  const rows: LeadRow[] = leads.map((c) => {
    const ps = postings.filter((p) => c.posting_ids.includes(p.posting_id));
    return {
      slug: c.slug, company: c.company, domain: c.domain, pain: c.pain, fit: c.fit,
      avg_overlap: c.avg_overlap, avg_weighted_overlap: c.avg_weighted_overlap, open_roles: c.open_roles,
      savings_total: c.savings_total, savings_roles: c.savings_roles, salary_roles: c.salary_roles, lead_product: c.lead_product,
      erp: c.erp, erp_class: c.erp_class, erp_score: c.erp_score, size_class: c.size_class, size_score: c.size_score,
      employee_band: c.employee_band, size_source_url: c.size_source_url, size_note: c.size_note, complexity_score: c.complexity_score, complexity_count: c.complexity_count, complexity_flags: c.complexity_flags,
      hq_state: c.hq_state, role_families: [...new Set(ps.map((p) => p.role_family))],
      covered_share_avg: ps.length ? ps.reduce((a, p) => a + p.covered_share, 0) / ps.length : 0,
      tools: c.tools, has_brief: Boolean(c.brief),
      roles: [...ps].sort((a, b) => b.overlap - a.overlap).map((p) => ({ posting_id: p.posting_id, title: p.title, role_family: p.role_family, source_url: p.source_url, overlap: p.overlap, covered_share: p.covered_share, salary_min: p.salary_min, salary_max: p.salary_max, savings: p.savings })),
      avg_salary: avgSalary(ps),
    };
  });
  const strong = leads.filter((c) => c.avg_overlap >= 0.5).length;
  const top = leads[0];
  return (
    <>
      <PageHero
        eyebrow="The leads"
        title={<>{strong} companies are hiring for roles where at least half the duties are on Hyphenate&apos;s site.</>}
        sub={top ? <>Every company gets a lead score from 0 to 100. By default, about two thirds (67%) of the score reflects how much of the work in its open finance jobs that Hyphenate already does, and the remaining third (33%) how closely it resembles a typical Hyphenate customer. Click any row to see its open jobs and the detailed breakdown.</> : undefined}
        meta={`As of ${shortDate(meta.as_of)} · median overlap ${pct(meta.headlines.median_overlap)}`}
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
