import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Container, Eyebrow, LabelChip, Mono, Note, OverlapBar, Section, StatBlock } from '@/components/ui';
import { getCompanies, getCompany, getGaps, getPostings } from '@/lib/data';
import { PRODUCT_ORDER, ROLE_LABELS, TRIGGER_LABELS, pct, shortDate, usd } from '@/lib/format';

export function generateStaticParams() {
  return getCompanies().map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const c = getCompany((await params).slug);
  return { title: c?.company ?? 'Company' };
}

export default async function CompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  const c = getCompany((await params).slug);
  if (!c) notFound();
  const roles = getPostings().filter((p) => c.posting_ids.includes(p.posting_id)).sort((a, b) => b.overlap - a.overlap);
  const themes = getGaps().themes.filter((t) => t.company_domains.includes(c.domain));
  const maxW = Math.max(1, ...Object.values(c.product_split).map((v) => v.covered + v.assisted));
  const headline = c.brief?.headline
    ?? (roles.length ? `${c.company} is hiring ${c.open_roles} finance ${c.open_roles === 1 ? 'role' : 'roles'} with ${pct(c.avg_overlap)} average overlap.` : c.company);
  const exclusion = c.excluded === 'existing_customer' ? 'Existing Hyphenate customer (named on hyphenate.ai). Kept in research totals; never shown as a lead.'
    : c.excluded === 'finance_software_vendor' ? 'Finance-software vendor. Kept in research totals; never shown as a lead.' : null;

  return (
    <>
      <section className="relative border-b border-line">
        <div aria-hidden className="hero-lines pointer-events-none absolute inset-0" />
        <Container className="relative space-y-5 pb-12 pt-14 sm:pt-20">
          <div className="flex flex-wrap items-center gap-3">
            <Eyebrow>The case</Eyebrow>
            <Mono>{c.company} · {c.domain}{c.rank ? ` · rank ${c.rank}` : ''}</Mono>
          </div>
          <h1 className="t-section max-w-[1100px]">{headline}</h1>
          {exclusion && <p className="inline-block rounded-md border border-line bg-surface px-3 py-2 text-[14px] text-ink/80">{exclusion}</p>}
        </Container>
      </section>

      <section className="hatch border-b border-line py-10 sm:py-14">
        <Container>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatBlock value={c.lead_score.toFixed(0)} label="Lead score" href="#score" note={`${c.lead_parts.pain.toFixed(1)} pain + ${c.lead_parts.fit.toFixed(1)} fit + ${c.lead_parts.timing.toFixed(1)} timing`} />
            <StatBlock value={pct(c.avg_overlap)} label="Average overlap" href="#roles" note={`${c.open_roles} open ${c.open_roles === 1 ? 'role' : 'roles'}`} />
            <StatBlock value={c.savings_roles ? usd(c.savings_total, { compact: true }) : '–'} label="Minimum savings a year" href="#savings" note={c.savings_roles ? `At least ${usd(c.savings_total)} across ${c.savings_roles} ${c.savings_roles === 1 ? 'role' : 'roles'}` : 'No salary posted'} />
            <StatBlock value={<span className="text-[26px] tracking-[-0.02em] sm:text-[34px]">{c.lead_product ?? '–'}</span>} label="Lead with" href="#products" />
          </div>
        </Container>
      </section>

      {c.brief && (
        <Section eyebrow="The brief" title="Why them, why now.">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {([['Why them', c.brief.why_them], ['Why now', c.brief.why_now], ['Lead with', c.brief.lead_with], ['Minimum savings', c.brief.minimum_savings], ['What Hyphenate may not cover', c.brief.may_not_cover], ['Angle', c.brief.angle]] as const).map(([k, v]) => (
              <div key={k} className="card p-5"><Mono>{k}</Mono><p className="mt-2 text-[16px] leading-relaxed">{v}</p></div>
            ))}
          </div>
          <div className="mt-4"><Note>Written by Claude from the structured data on this page only, then checked in code: every number and name in it appears in the source data.</Note></div>
        </Section>
      )}

      <Section id="roles" eyebrow="Open roles" title={`${roles.length} open finance ${roles.length === 1 ? 'role' : 'roles'}.`}>
        <div className="card overflow-hidden">
          {roles.map((r) => (
            <Link key={r.posting_id} href={`/postings/${r.posting_id}`} className="dash-row grid grid-cols-1 gap-3 px-5 py-4 transition-colors hover:bg-surface-tint sm:grid-cols-[1.6fr_1fr_8rem_8rem] sm:items-center">
              <span><span className="t-card block">{r.title}</span><Mono>{ROLE_LABELS[r.role_family] ?? r.role_family} · {r.seniority} · posted {shortDate(r.posted_at)}{r.thin ? ' · thin posting' : ''}</Mono></span>
              <span><OverlapBar covered={r.covered_share} assisted={r.overlap - r.covered_share} /><Mono className="mt-1 block">{pct(r.overlap)} overlap · {r.C} covered, {r.A} assisted of {r.n}</Mono></span>
              <span className="num text-[14px] sm:text-right">{r.salary_min !== null ? usd(r.salary_min) : <span className="text-ink-muted">No salary</span>}</span>
              <span className="num text-[14px] sm:text-right">{r.savings !== null ? usd(r.savings) : <span className="text-ink-muted">–</span>}</span>
            </Link>
          ))}
        </div>
        <div className="mt-3 flex justify-end gap-8 pr-5 text-right"><Mono>Salary min</Mono><Mono>Min. savings</Mono></div>
      </Section>

      <Section id="products" eyebrow="Product split" title={c.lead_product ? `Lead with ${c.lead_product}.` : 'No product match yet.'}>
        <div className="card space-y-4 p-5 sm:p-6">
          {PRODUCT_ORDER.filter((p) => c.product_split[p]).map((p) => {
            const v = c.product_split[p];
            return (
              <div key={p} className="grid grid-cols-[9rem_1fr_6rem] items-center gap-3 sm:grid-cols-[12rem_1fr_8rem]">
                <span className={`text-[14px] ${p === c.lead_product ? 'font-medium text-accent-ink' : ''}`}>{p}</span>
                <div className="flex h-6 gap-[2px]">
                  <div className="rounded-l-[4px] bg-success" style={{ width: `${(v.covered / maxW) * 100}%` }} title={`${v.covered} covered`} />
                  <div className="rounded-r-[4px] bg-accent/70" style={{ width: `${(v.assisted / maxW) * 100}%` }} title={`${v.assisted} assisted`} />
                </div>
                <span className="num text-right font-mono text-[12px] text-ink-muted">{v.covered} cov · {v.assisted} asst</span>
              </div>
            );
          })}
          {!Object.keys(c.product_split).length && <Note>No duties matched a capability.</Note>}
          <Note>Lead product = most weighted duties (covered + 0.5 × assisted) across all open roles; ties go to more covered duties.</Note>
        </div>
      </Section>

      <Section id="score" eyebrow="Score breakdown" title={`Lead score ${c.lead_score.toFixed(0)}.`}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="card p-5"><Mono>Pain · {c.pain.toFixed(2)} → {c.lead_parts.pain.toFixed(1)} pts</Mono>
            <p className="mt-2 text-[14px]">0.8 × {pct(c.avg_weighted_overlap)} average weighted overlap + 0.2 × {Math.min(c.open_roles, 4)}/4 open roles.</p></div>
          <div className="card p-5"><Mono>Fit · {c.fit.toFixed(2)} → {c.lead_parts.fit.toFixed(1)} pts</Mono>
            <p className="mt-2 text-[14px]">ERP {c.erp_score} ({c.erp.join(', ') || 'not stated'}) · size {c.size_score} ({c.employee_band ?? 'unknown'}{c.employee_band ? ', unverified estimate' : ''}) · complexity {c.complexity_score} ({Object.entries(c.complexity_flags).filter(([, v]) => v).map(([k]) => k.replace(/_/g, ' ')).join(', ') || 'none stated'}).</p></div>
          <div className="card p-5"><Mono>Timing · {c.timing.toFixed(2)} → {c.lead_parts.timing.toFixed(1)} pts</Mono>
            <p className="mt-2 text-[14px]">{c.top_trigger ? `${TRIGGER_LABELS[c.top_trigger.trigger_type]} (weight ${c.top_trigger.weight}) × age ${c.top_trigger.age_multiplier}.` : c.news_searched ? 'No qualifying trigger found in the last 180 days.' : 'Not in the top 30 by pain and fit, so news was not searched.'}</p></div>
        </div>
      </Section>

      <Section eyebrow="Why now" title={c.triggers.length ? `${c.triggers.length} trigger ${c.triggers.length === 1 ? 'event' : 'events'}.` : 'No trigger events found.'}>
        {c.triggers.length ? (
          <div className="card overflow-hidden">
            {[...c.triggers].sort((a, b) => (b.event_date ?? '').localeCompare(a.event_date ?? '')).map((t) => (
              <a key={t.url} href={t.url} target="_blank" rel="noreferrer" className="dash-row grid grid-cols-1 gap-2 px-5 py-4 hover:bg-surface-tint sm:grid-cols-[10rem_12rem_1fr]">
                <Mono>{shortDate(t.event_date)}</Mono>
                <span className="text-[14px] font-medium">{TRIGGER_LABELS[t.trigger_type] ?? t.trigger_type}</span>
                <span className="text-[14px]"><span className="link">{t.headline}</span><span className="mt-1 block text-ink-muted">{t.summary} · {t.source} · confidence {t.confidence.toFixed(2)}</span></span>
              </a>
            ))}
          </div>
        ) : <Note>{c.news_searched ? 'Google News and newsroom feeds were searched; nothing qualified (confidence ≥ 0.7, company named in the headline, within 180 days).' : 'News runs only for the top 30 companies by pain and fit.'}</Note>}
      </Section>

      <Section id="savings" eyebrow="The money" title={c.savings_roles ? `At least ${usd(c.savings_total)} a year across ${c.savings_roles} ${c.savings_roles === 1 ? 'role' : 'roles'}.` : 'No salary posted, so no figure.'}>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-[14px]">
            <thead className="border-b border-line"><tr>{['Role', 'Salary min', 'Covered share', 'Discount', 'Minimum savings'].map((h, i) => <th key={h} className={`px-4 py-3 font-normal ${i ? 'text-right' : 'text-left'}`}><Mono>{h}</Mono></th>)}</tr></thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r.posting_id} className="border-t border-dashed border-line-dashed">
                  <td className="px-4 py-3"><Link href={`/postings/${r.posting_id}`} className="link">{r.title}</Link></td>
                  <td className="num px-4 py-3 text-right">{r.salary_min !== null ? usd(r.salary_min) : '–'}</td>
                  <td className="num px-4 py-3 text-right">{r.C}/{r.n}</td>
                  <td className="num px-4 py-3 text-right">0.5</td>
                  <td className="num px-4 py-3 text-right">{r.savings !== null ? usd(r.savings) : <span className="text-ink-muted">{r.savings_reason === 'no_salary' ? 'No salary posted' : r.savings_reason === 'thin_posting' ? 'Thin posting' : '–'}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3"><Note>Gross value, not net savings: Hyphenate&apos;s price is unknown. Work Hyphenate could absorb before the next hire, never people to cut. Based on {c.salary_roles} of {roles.length} roles that list a salary.</Note></div>
      </Section>

      <Section eyebrow="Tools named" title={c.tools.length ? 'What the team already uses.' : 'No tools named in the postings.'}>
        {c.tools.length > 0 && <ul className="flex flex-wrap gap-2">{c.tools.map((t) => <li key={t} className="rounded-full border border-line bg-surface px-3 py-1 text-[14px]">{t}</li>)}</ul>}
        <div className="mt-3"><Note>Shown for context, not scored.</Note></div>
      </Section>

      <Section eyebrow="The gaps" title={themes.length ? 'Work in these postings that is not on Hyphenate\'s public site.' : 'No gap themes yet for this company.'}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {themes.map((t) => {
            const count = c.gap_themes.find((g) => g.theme_id === t.theme_id)?.duties ?? 0;
            return (
              <Link key={t.theme_id} href={`/gaps#${t.theme_id}`} className="card-flat block p-4 hover:bg-surface-tint">
                <div className="flex items-center justify-between"><LabelChip label={t.bucket === 'possible_gap' ? 'gap_candidate' : t.bucket === 'human_work' ? 'human' : 'unclear'} /><Mono>{count} {count === 1 ? 'duty' : 'duties'}</Mono></div>
                <p className="mt-2 font-medium">{t.name}</p>
              </Link>
            );
          })}
        </div>
      </Section>
    </>
  );
}
