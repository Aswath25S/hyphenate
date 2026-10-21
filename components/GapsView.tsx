'use client';
import Link from 'next/link';
import { Fragment, useEffect, useState } from 'react';
import type { GapTheme } from '@/lib/app-types';
import { ROLE_LABELS, pct, usd } from '@/lib/format';
import { downloadCsv } from '@/lib/csv';

type Verify = 'unverified' | 'confirmed' | 'supported';
const STORE = 'btnh-gap-verification';
const VERIFY_LABEL: Record<Verify, string> = { unverified: 'Unverified', confirmed: 'Confirmed gap', supported: 'Actually supported' };

export function GapsView({ themes, companies, strongTotal }: { themes: GapTheme[]; companies: Record<string, { name: string; slug: string }>; strongTotal: number }) {
  const [open, setOpen] = useState<string | null>(null);
  const [verify, setVerify] = useState<Record<string, Verify>>({});
  useEffect(() => {
    try { setVerify(JSON.parse(localStorage.getItem(STORE) ?? '{}')); } catch { /* storage unavailable */ }
    const hash = decodeURIComponent(location.hash.slice(1));
    if (hash) setOpen(hash);
  }, []);
  const setV = (id: string, v: Verify) => {
    const next = { ...verify, [id]: v };
    setVerify(next);
    try { localStorage.setItem(STORE, JSON.stringify(next)); } catch { /* storage unavailable */ }
  };
  const gaps = themes.filter((t) => t.bucket === 'possible_gap');
  const human = themes.filter((t) => t.bucket === 'human_work');
  const unclear = themes.filter((t) => t.bucket === 'unclear');

  const exportCsv = () => downloadCsv('gaps.csv', themes.map((t) => ({
    theme: t.name, bucket: t.bucket, description: t.description, share_of_strong_leads: t.metrics.share_strong_leads.toFixed(3),
    postings: t.metrics.postings, companies: t.metrics.companies, salary_attached_min_indicative: Math.round(t.metrics.salary_attached),
    roles: t.metrics.roles, verification: VERIFY_LABEL[verify[t.theme_id] ?? 'unverified'],
    example_phrases: t.examples.map((e) => `${e.company}: ${e.source_span}`), posting_ids: t.posting_ids,
  })), ['theme', 'bucket', 'description', 'share_of_strong_leads', 'postings', 'companies', 'salary_attached_min_indicative', 'roles', 'verification', 'example_phrases', 'posting_ids']);

  const table = (list: GapTheme[]) => (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[880px] text-[14px]">
        <thead className="border-b border-line">
          <tr>
            {['Theme', 'Share of strong leads', 'Postings', 'Companies', 'Salary attached', 'Roles', 'Verification'].map((h, i) => (
              <th key={h} className={`whitespace-nowrap px-4 py-3 font-normal ${i > 0 && i < 5 ? 'text-right' : 'text-left'}`}><span className="t-mono">{h}</span></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {list.map((t) => (
            <Fragment key={t.theme_id}>
              <tr id={t.theme_id} className={`cursor-pointer scroll-mt-28 border-t border-dashed border-line-dashed align-top hover:bg-surface-tint ${open === t.theme_id ? 'bg-surface-tint' : ''}`} onClick={() => setOpen(open === t.theme_id ? null : t.theme_id)}>
                <td className="px-4 py-3.5"><span className="font-medium">{t.name}</span><div className="mt-0.5 max-w-[360px] text-[13px] text-ink-muted">{t.description}</div></td>
                <td className="px-4 py-3.5 text-right">
                  <span className="num text-[20px] leading-none tracking-[-0.02em] text-ink-display">{pct(t.metrics.share_strong_leads)}</span>
                  <div className="t-mono mt-1">{t.metrics.strong_postings_with_theme} of {strongTotal}</div>
                </td>
                <td className="num px-4 py-3.5 text-right"><button className="evidence" aria-expanded={open === t.theme_id}>{t.metrics.postings}</button></td>
                <td className="num px-4 py-3.5 text-right">{t.metrics.companies}</td>
                <td className="num px-4 py-3.5 text-right">{t.metrics.salary_postings ? usd(t.metrics.salary_attached) : '–'}<div className="t-mono mt-1">min, indicative</div></td>
                <td className="px-4 py-3.5 text-[13px]">{t.metrics.roles.map((r) => ROLE_LABELS[r] ?? r).join(', ')}</td>
                <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                  <select aria-label={`Verification for ${t.name}`} value={verify[t.theme_id] ?? 'unverified'} onChange={(e) => setV(t.theme_id, e.target.value as Verify)}
                    className={`rounded-md border px-2 py-1.5 text-[13px] ${verify[t.theme_id] === 'confirmed' ? 'border-accent bg-accent-soft text-accent-ink' : verify[t.theme_id] === 'supported' ? 'border-success bg-success-soft text-success-ink' : 'border-line bg-surface'}`}>
                    {Object.entries(VERIFY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </td>
              </tr>
              {open === t.theme_id && (
                <tr className="bg-surface-tint">
                  <td colSpan={7} className="px-4 pb-5 pt-1">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-[2fr_1fr]">
                      <div className="card-flat p-4">
                        <span className="t-mono">Example phrases (verbatim)</span>
                        <ul className="mt-2 space-y-2">
                          {t.examples.map((e) => (
                            <li key={e.duty_id} className="text-[14px]">&ldquo;{e.source_span}&rdquo; <Link href={`/postings/${e.posting_id}`} className="link whitespace-nowrap text-[13px]">{e.company} posting</Link></li>
                          ))}
                        </ul>
                      </div>
                      <div className="card-flat p-4">
                        <span className="t-mono">Companies</span>
                        <ul className="mt-2 flex flex-wrap gap-1.5">
                          {t.company_domains.map((d) => companies[d] ? <li key={d}><Link href={`/companies/${companies[d].slug}`} className="inline-block rounded-full border border-line bg-surface px-2.5 py-0.5 text-[13px] hover:border-brand">{companies[d].name}</Link></li> : null)}
                        </ul>
                        <p className="mt-3 text-[12.5px] text-ink-muted">{t.duty_ids.length} duties across {t.metrics.postings} postings. Salary attached = Σ salary min × theme duties ÷ scored duties, postings with salaries only.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
          {!list.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-ink-muted">No themes in this bucket.</td></tr>}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-[720px] text-[14px] text-ink-muted">Ranked by share of strong leads: of the {strongTotal} postings with at least 60% overlap, how many include the theme. A gap inside an otherwise good lead is the gap that blocks a deal. Verification is stored in this browser only.</p>
        <button onClick={exportCsv} className="btn-secondary !py-1.5 !text-[13px]">Export CSV</button>
      </div>
      {table(gaps)}
      <details className="group">
        <summary className="cursor-pointer list-none">
          <span className="t-sub">Human work <span className="text-ink-muted">({human.length} themes)</span></span>
          <span className="ml-3 text-[14px] text-ink-muted group-open:hidden">Show</span>
          <p className="mt-1 text-[14px] text-ink-muted">Needs people by nature: managing staff, presenting, partnering, auditor relationships. Not a product gap.</p>
        </summary>
        <div className="mt-4">{table(human)}</div>
      </details>
      <details className="group">
        <summary className="cursor-pointer list-none">
          <span className="t-sub">Too vague to judge <span className="text-ink-muted">({unclear.length} themes)</span></span>
          <span className="ml-3 text-[14px] text-ink-muted group-open:hidden">Show</span>
        </summary>
        <div className="mt-4">{table(unclear)}</div>
      </details>
    </div>
  );
}
