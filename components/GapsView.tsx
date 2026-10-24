'use client';
import Link from 'next/link';
import { Fragment, useEffect, useState } from 'react';
import type { GapTheme } from '@/lib/app-types';
import { ROLE_LABELS, pct, usd } from '@/lib/format';
import { downloadCsv } from '@/lib/csv';
import { Collapsible } from './Collapsible';

export function GapsView({ themes, companies, strongTotal }: { themes: GapTheme[]; companies: Record<string, { name: string; slug: string }>; strongTotal: number }) {
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    const hash = decodeURIComponent(location.hash.slice(1));
    if (hash) setOpen(hash);
  }, []);
  const gaps = themes.filter((t) => t.bucket === 'possible_gap');
  const human = themes.filter((t) => t.bucket === 'human_work');
  const unclear = themes.filter((t) => t.bucket === 'unclear');

  const exportCsv = () => downloadCsv('gaps.csv', themes.map((t) => ({
    theme: t.name, bucket: t.bucket, description: t.description, share_of_strong_leads: t.metrics.share_strong_leads.toFixed(3),
    postings: t.metrics.postings, companies: t.metrics.companies, salary_attached_min_indicative: Math.round(t.metrics.salary_attached),
    roles: t.metrics.roles, example_phrases: t.examples.map((e) => `${e.company}: ${e.source_span}`), posting_ids: t.posting_ids,
  })), ['theme', 'bucket', 'description', 'share_of_strong_leads', 'postings', 'companies', 'salary_attached_min_indicative', 'roles', 'example_phrases', 'posting_ids']);

  const table = (list: GapTheme[]) => (
    <div className="card relative overflow-x-auto">
      <table className="w-full table-fixed border-collapse text-[14px] md:min-w-[900px]">
        {/* Fixed column widths so nothing shifts when a row opens.
            On phones, the counts move under the theme name. */}
        <colgroup>
          <col />
          <col className="w-[5.5rem] md:w-[11rem]" />
          <col className="w-0 md:w-[8.5rem]" />
          <col className="w-0 md:w-[7rem]" />
          <col className="w-0 md:w-[9.5rem]" />
          <col className="w-0 md:w-[11rem]" />
          <col className="w-[3.25rem] md:w-[3.5rem]" />
        </colgroup>
        <thead className="border-b border-line">
          <tr>
            {['Theme', 'Share of strong leads', 'Postings', 'Companies', 'Salary attached', 'Roles', ''].map((h, i) => (
              <th key={i} className={`whitespace-nowrap px-3 py-3 font-normal md:px-4 ${i > 0 && i < 5 ? 'text-right' : 'text-left'} ${i >= 2 && i <= 5 ? 'max-md:!p-0' : ''}`}>
                {i === 1 ? <><span className="t-mono md:hidden">Share</span><span className="t-mono hidden md:inline">{h}</span></> : h && <span className={`t-mono ${i >= 2 && i <= 5 ? 'max-md:hidden' : ''}`}>{h}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {list.map((t) => {
            const isOpen = open === t.theme_id;
            return (
              <Fragment key={t.theme_id}>
                <tr id={t.theme_id} className={`cursor-pointer scroll-mt-28 border-t border-dashed border-line-dashed align-top transition-colors hover:bg-surface-tint ${isOpen ? 'bg-surface-tint' : ''}`} onClick={() => setOpen(isOpen ? null : t.theme_id)}>
                  <td className="px-3 py-3.5 md:px-4">
                    <span className="font-medium">{t.name}</span><div className="mt-0.5 text-[13px] text-ink-muted">{t.description}</div>
                    <div className="t-mono mt-2 flex flex-wrap gap-x-2 md:hidden">
                      <span className="whitespace-nowrap">{t.metrics.postings} postings</span><span aria-hidden>·</span>
                      <span className="whitespace-nowrap">{t.metrics.companies} companies</span>
                      {t.metrics.salary_postings > 0 && <><span aria-hidden>·</span><span className="whitespace-nowrap">{usd(t.metrics.salary_attached)} salary</span></>}
                    </div>
                    <div className="mt-1 text-[12.5px] text-ink-muted md:hidden">{t.metrics.roles.map((r) => ROLE_LABELS[r] ?? r).join(', ')}</div>
                  </td>
                  <td className="px-3 py-3.5 text-right md:px-4">
                    <span className="num text-[20px] leading-none tracking-[-0.02em] text-ink-display">{pct(t.metrics.share_strong_leads)}</span>
                    <div className="t-mono mt-1">{t.metrics.strong_postings_with_theme} of {strongTotal}</div>
                  </td>
                  <td className="num px-4 py-3.5 text-right max-md:!p-0"><div className="max-md:hidden">{t.metrics.postings}</div></td>
                  <td className="num px-4 py-3.5 text-right max-md:!p-0"><div className="max-md:hidden">{t.metrics.companies}</div></td>
                  <td className="num px-4 py-3.5 text-right max-md:!p-0"><div className="max-md:hidden">{t.metrics.salary_postings ? usd(t.metrics.salary_attached) : '–'}<div className="t-mono mt-1">min, indicative</div></div></td>
                  <td className="px-4 py-3.5 text-[13px] max-md:!p-0"><div className="max-md:hidden">{t.metrics.roles.map((r) => ROLE_LABELS[r] ?? r).join(', ')}</div></td>
                  <td className="px-2 py-3 text-right">
                    <button className="inline-flex h-9 w-9 items-center md:h-8 md:w-8 justify-center rounded-md border border-line text-ink-muted hover:border-brand hover:text-brand"
                      aria-expanded={isOpen} aria-label={isOpen ? `Hide details for ${t.name}` : `Show details for ${t.name}`}
                      onClick={(e) => { e.stopPropagation(); setOpen(isOpen ? null : t.theme_id); }}>
                      <svg aria-hidden viewBox="0 0 16 16" className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}><path d="M3.5 6l4.5 4.5L12.5 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                  </td>
                </tr>
                <tr className={isOpen ? 'bg-surface-tint' : ''} aria-hidden={!isOpen}>
                  <td colSpan={7} className="p-0">
                    <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                      <div className="min-h-0 overflow-hidden">
                        <div className="px-3 pb-5 pt-1 md:px-4" inert={!isOpen}>
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-[2fr_1fr]">
                            <div className="card-flat p-4">
                              <span className="t-mono">Example phrases (verbatim)</span>
                              <ul className="mt-2 space-y-2">
                                {t.examples.map((e) => (
                                  <li key={e.duty_id} className="text-[14px]">&ldquo;{e.source_span}&rdquo; <Link href={`/postings/${e.posting_id}`} className="link whitespace-nowrap text-[13px]">{e.company} role</Link></li>
                                ))}
                              </ul>
                            </div>
                            <div className="card-flat p-4">
                              <span className="t-mono">Companies</span>
                              <ul className="mt-2 flex flex-wrap gap-1.5">
                                {t.company_domains.map((d) => companies[d] ? <li key={d}><Link href={`/companies/${companies[d].slug}`} className="inline-block rounded-full border border-line bg-surface px-2.5 py-0.5 text-[13px] hover:border-brand">{companies[d].name}</Link></li> : null)}
                              </ul>
                              <p className="mt-3 text-[12.5px] text-ink-muted">{t.duty_ids.length} duties across {t.metrics.postings} postings. Salary attached = lowest posted salary × share of the role&apos;s duties in this theme, summed over roles that list pay.</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              </Fragment>
            );
          })}
          {!list.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-ink-muted">No themes in this bucket.</td></tr>}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-[720px] text-[14px] text-ink-muted">Ranked by share of strong leads: of the {strongTotal} postings with at least 60% overlap, how many include the theme. A gap inside an otherwise good lead is the gap that blocks a deal.</p>
        <button onClick={exportCsv} className="btn-secondary !py-1.5 !text-[13px]">Export CSV</button>
      </div>
      {table(gaps)}
      <Collapsible title={<>Human work <span className="text-ink-muted">({human.length} themes)</span></>}
        subtitle="Needs people by nature: managing staff, presenting, partnering, auditor relationships. Not a product gap.">
        {table(human)}
      </Collapsible>
      <Collapsible title={<>Too vague to judge <span className="text-ink-muted">({unclear.length} themes)</span></>}
        subtitle="Duties like “support the team as needed” that are too general to match.">
        {table(unclear)}
      </Collapsible>
    </div>
  );
}
