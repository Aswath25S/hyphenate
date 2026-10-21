'use client';
import Link from 'next/link';
import { Fragment, useMemo, useState } from 'react';
import { LEAD_WEIGHTS, PAIN, FIT_WEIGHTS } from '@/config/scoring';
import { leadScore } from '@/lib/scoring';
import { ROLE_LABELS, TRIGGER_LABELS, pct, shortDate, usd } from '@/lib/format';
import { useUrlState } from '@/lib/useUrlState';
import { downloadCsv } from '@/lib/csv';
import { OverlapBar } from './ui';

export type LeadRow = {
  slug: string; company: string; domain: string; pain: number; fit: number; timing: number;
  avg_overlap: number; avg_weighted_overlap: number; open_roles: number;
  savings_total: number; savings_roles: number; salary_roles: number; lead_product: string | null;
  top_trigger: { trigger_type: string; event_date: string | null; url: string; headline: string; weight: number; age_multiplier: number } | null;
  news_searched: boolean; erp: string[]; erp_class: string; erp_score: number; size_class: string; size_score: number; employee_band: string | null;
  complexity_score: number; complexity_count: number; complexity_flags: Record<string, boolean>; hq_state: string | null; role_families: string[];
  covered_share_avg: number;
};

const ERP_CLASS: Record<string, string> = { enterprise: 'Enterprise ERP', smb_only: 'QuickBooks/Xero only', not_stated: 'Not stated', other: 'Other' };
const SIZE_CLASS: Record<string, string> = { in_band: '200–5,000', out_of_band: 'Outside band', unknown: 'Unknown' };
const KEYS = ['wp', 'wf', 'wt', 'sort', 'dir', 'role', 'erp', 'size', 'state', 'salary', 'trigger'];

export function LeadsView({ rows, excludedCount }: { rows: LeadRow[]; excludedCount: number }) {
  const u = useUrlState();
  const [open, setOpen] = useState<string | null>(null);
  const raw = { pain: u.getNum('wp', LEAD_WEIGHTS.pain), fit: u.getNum('wf', LEAD_WEIGHTS.fit), timing: u.getNum('wt', LEAD_WEIGHTS.timing) };
  const sum = raw.pain + raw.fit + raw.timing || 1;
  const weights = { pain: raw.pain / sum, fit: raw.fit / sum, timing: raw.timing / sum };
  const custom = raw.pain !== LEAD_WEIGHTS.pain || raw.fit !== LEAD_WEIGHTS.fit || raw.timing !== LEAD_WEIGHTS.timing;
  const sort = u.get('sort', 'score');
  const dir = u.get('dir', 'desc');
  const f = { role: u.get('role'), erp: u.get('erp'), size: u.get('size'), state: u.get('state'), salary: u.get('salary'), trigger: u.get('trigger') };

  const scored = useMemo(() => rows.map((r) => {
    const def = leadScore(r.pain, r.fit, r.timing);
    const yours = leadScore(r.pain, r.fit, r.timing, weights);
    return { ...r, score: yours.score, parts: yours.parts, default_score: def.score };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [rows, weights.pain, weights.fit, weights.timing]);

  const ranked = useMemo(() => {
    const byDefault = [...scored].sort((a, b) => b.score - a.score || a.company.localeCompare(b.company));
    const rank = new Map(byDefault.map((r, i) => [r.slug, i + 1]));
    let list = scored.map((r) => ({ ...r, rank: rank.get(r.slug)! }));
    if (f.role) list = list.filter((r) => r.role_families.includes(f.role));
    if (f.erp) list = list.filter((r) => r.erp_class === f.erp);
    if (f.size) list = list.filter((r) => r.size_class === f.size);
    if (f.state) list = list.filter((r) => r.hq_state === f.state);
    if (f.salary === 'yes') list = list.filter((r) => r.salary_roles > 0);
    if (f.trigger) list = list.filter((r) => (f.trigger === 'none' ? !r.top_trigger : r.top_trigger?.trigger_type === f.trigger));
    const key: Record<string, (r: (typeof list)[number]) => number | string> = {
      score: (r) => r.score, company: (r) => r.company.toLowerCase(), overlap: (r) => r.avg_overlap, roles: (r) => r.open_roles,
      savings: (r) => r.savings_total, product: (r) => r.lead_product ?? '', trigger: (r) => r.top_trigger?.weight ?? 0, rank: (r) => -r.rank,
    };
    const k = key[sort] ?? key.score;
    list.sort((a, b) => { const x = k(a), y = k(b); const c = x < y ? -1 : x > y ? 1 : 0; return dir === 'asc' ? c : -c; });
    return list;
  }, [scored, f.role, f.erp, f.size, f.state, f.salary, f.trigger, sort, dir]);

  const options = useMemo(() => ({
    roles: [...new Set(rows.flatMap((r) => r.role_families))].sort(),
    states: [...new Set(rows.map((r) => r.hq_state).filter(Boolean) as string[])].sort(),
    triggers: [...new Set(rows.map((r) => r.top_trigger?.trigger_type).filter(Boolean) as string[])].sort(),
  }), [rows]);

  const th = (k: string, label: string, right = false) => (
    <th scope="col" className={`whitespace-nowrap px-3 py-3 font-normal ${right ? 'text-right' : 'text-left'}`}>
      <button className={`t-mono hover:text-brand ${sort === k ? '!text-accent-ink' : ''}`} onClick={() => u.set({ sort: k, dir: sort === k && dir === 'desc' ? 'asc' : 'desc' })}>
        {label}{sort === k ? (dir === 'desc' ? ' ↓' : ' ↑') : ''}
      </button>
    </th>
  );
  const select = (k: keyof typeof f, label: string, opts: [string, string][]) => (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="t-mono">{label}</span>
      <select value={f[k]} onChange={(e) => u.set({ [k]: e.target.value })} className="rounded-md border border-line bg-surface px-2.5 py-2 text-[14px]">
        <option value="">All</option>
        {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
  const exportCsv = () => downloadCsv('leads.csv', ranked.map((r) => ({
    rank: r.rank, company: r.company, domain: r.domain, lead_score: r.score.toFixed(1), pain: r.pain.toFixed(3), fit: r.fit.toFixed(3), timing: r.timing.toFixed(3),
    overlap: r.avg_overlap.toFixed(3), open_roles: r.open_roles, minimum_savings: Math.round(r.savings_total), lead_product: r.lead_product ?? '',
    top_trigger: r.top_trigger ? TRIGGER_LABELS[r.top_trigger.trigger_type] : '', trigger_url: r.top_trigger?.url ?? '', erp: r.erp, employee_band: r.employee_band ?? '', hq_state: r.hq_state ?? '',
  })), ['rank', 'company', 'domain', 'lead_score', 'pain', 'fit', 'timing', 'overlap', 'open_roles', 'minimum_savings', 'lead_product', 'top_trigger', 'trigger_url', 'erp', 'employee_band', 'hq_state']);

  const slider = (k: 'wp' | 'wf' | 'wt', label: string, v: number, eff: number) => (
    <label className="block">
      <span className="flex items-baseline justify-between"><span className="text-[14px]">{label}</span><span className="num font-mono text-[12px] text-ink-muted">{pct(eff)}</span></span>
      <input type="range" min={0} max={1} step={0.05} value={v} onChange={(e) => u.set({ [k]: e.target.value })} className="mt-2 w-full" aria-label={`${label} weight`} />
    </label>
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
        <div className="card p-5">
          <div className="flex items-baseline justify-between"><span className="t-mono">Weights</span>
            <button onClick={() => u.reset(KEYS)} className="link text-[13px]">Reset to defaults</button></div>
          <div className="mt-4 space-y-4">
            {slider('wp', 'Pain', raw.pain, weights.pain)}
            {slider('wf', 'Fit', raw.fit, weights.fit)}
            {slider('wt', 'Timing', raw.timing, weights.timing)}
          </div>
          <p className="mt-4 text-[12.5px] leading-relaxed text-ink-muted">Weights are normalised to sum to 100%. Default: pain 50%, fit 25%, timing 25%.{custom && ' Scores below use your weights.'}</p>
        </div>
        <div className="card-flat p-5 text-[13px] leading-relaxed text-ink-muted">
          <p><b className="font-medium text-ink">Pain</b> = {PAIN.overlapWeight} × average weighted overlap + {PAIN.rolesWeight} × min(open roles, {PAIN.rolesCap}) ÷ {PAIN.rolesCap}.</p>
          <p className="mt-2"><b className="font-medium text-ink">Fit</b> = {FIT_WEIGHTS.erp} ERP + {FIT_WEIGHTS.size} size + {FIT_WEIGHTS.complexity} complexity.</p>
          <p className="mt-2"><b className="font-medium text-ink">Timing</b> = strongest trigger × age.</p>
          <Link href="/method#scoring" className="link mt-3 inline-block">Full method</Link>
        </div>
      </aside>

      <div className="min-w-0 space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {select('role', 'Role family', options.roles.map((r) => [r, ROLE_LABELS[r] ?? r]))}
          {select('erp', 'ERP', Object.entries(ERP_CLASS))}
          {select('size', 'Size', Object.entries(SIZE_CLASS))}
          {select('state', 'HQ state', options.states.map((s) => [s, s]))}
          {select('salary', 'Salary', [['yes', 'Has salary']])}
          {select('trigger', 'Trigger', [...options.triggers.map((t) => [t, TRIGGER_LABELS[t] ?? t] as [string, string]), ['none', 'No trigger']])}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="t-mono">{ranked.length} of {rows.length} leads{excludedCount ? ` · ${excludedCount} existing customers and vendors hidden` : ''}</span>
          <div className="flex gap-3">
            <button onClick={() => u.reset(KEYS)} className="link text-[13px]">Reset to defaults</button>
            <button onClick={exportCsv} className="btn-secondary !py-1.5 !text-[13px]">Export CSV</button>
          </div>
        </div>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-[14px]">
            <thead className="border-b border-line">
              <tr>
                {th('rank', '#')}{th('company', 'Company')}{th('score', 'Lead score', true)}{th('overlap', 'Overlap')}{th('roles', 'Open roles', true)}
                {th('savings', 'Min. savings', true)}{th('product', 'Lead product')}{th('trigger', 'Top trigger')}
                <th scope="col" className="px-3 py-3 text-left font-normal"><span className="t-mono">ERP</span></th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((r) => (
                <Fragment key={r.slug}>
                  <tr className={`cursor-pointer border-t border-dashed border-line-dashed align-top transition-colors hover:bg-surface-tint ${open === r.slug ? 'bg-surface-tint' : ''}`} onClick={() => setOpen(open === r.slug ? null : r.slug)}>
                    <td className="num px-3 py-3.5 font-mono text-[12px] text-ink-muted">{String(r.rank).padStart(2, '0')}</td>
                    <td className="px-3 py-3.5">
                      <Link href={`/companies/${r.slug}`} onClick={(e) => e.stopPropagation()} className="font-medium hover:text-brand">{r.company}</Link>
                      <div className="t-mono mt-0.5">{r.employee_band ?? 'size unknown'}{r.employee_band ? ' · unverified' : ''}{r.hq_state ? ` · ${r.hq_state}` : ''}</div>
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      <button className="evidence num text-[20px] leading-none tracking-[-0.02em] text-ink-display" aria-expanded={open === r.slug} aria-label={`Lead score ${r.score.toFixed(0)}, show breakdown`}>{r.score.toFixed(0)}</button>
                      {custom && <div className="t-mono mt-1">default {r.default_score.toFixed(0)}</div>}
                    </td>
                    <td className="w-[150px] px-3 py-3.5">
                      <OverlapBar covered={r.covered_share_avg} assisted={Math.max(0, r.avg_overlap - r.covered_share_avg)} />
                      <div className="t-mono mt-1.5">{pct(r.avg_overlap)}</div>
                    </td>
                    <td className="num px-3 py-3.5 text-right">{r.open_roles}</td>
                    <td className="num px-3 py-3.5 text-right">
                      {r.savings_roles ? <Link href={`/companies/${r.slug}#savings`} onClick={(e) => e.stopPropagation()} className="evidence">{usd(r.savings_total)}</Link> : <span className="text-[13px] text-ink-muted">No salary posted</span>}
                    </td>
                    <td className="px-3 py-3.5">{r.lead_product ?? <span className="text-ink-muted">–</span>}</td>
                    <td className="px-3 py-3.5">{r.top_trigger
                      ? <a href={r.top_trigger.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="link">{TRIGGER_LABELS[r.top_trigger.trigger_type]}</a>
                      : <span className="text-ink-muted">{r.news_searched ? 'None found' : 'Not searched'}</span>}</td>
                    <td className="px-3 py-3.5 text-[13px]">{r.erp.length ? r.erp.join(', ') : <span className="text-ink-muted">Not stated</span>}</td>
                  </tr>
                  {open === r.slug && (
                    <tr className="bg-surface-tint">
                      <td colSpan={9} className="px-3 pb-5 pt-1">
                        <Breakdown r={r} weights={weights} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {!ranked.length && <tr><td colSpan={9} className="px-3 py-10 text-center text-ink-muted">No leads match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Breakdown({ r, weights }: { r: LeadRow & { parts: { pain: number; fit: number; timing: number }; score: number }; weights: { pain: number; fit: number; timing: number } }) {
  const flags = Object.entries(r.complexity_flags).filter(([, v]) => v).map(([k]) => k.replace(/_/g, ' '));
  const cell = (title: string, w: number, v: number, pts: number, lines: React.ReactNode) => (
    <div className="card-flat p-4">
      <div className="flex items-baseline justify-between"><span className="t-mono">{title}</span><span className="num font-mono text-[12px]">{v.toFixed(2)} × {pct(w)} = <b className="font-medium text-ink-display">{pts.toFixed(1)}</b></span></div>
      <div className="mt-2 space-y-1 text-[13px] leading-relaxed text-ink/80">{lines}</div>
    </div>
  );
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {cell('Pain', weights.pain, r.pain, r.parts.pain, <>
          <p>{PAIN.overlapWeight} × {pct(r.avg_weighted_overlap)} weighted overlap + {PAIN.rolesWeight} × {Math.min(r.open_roles, PAIN.rolesCap)}/{PAIN.rolesCap} roles</p>
          <Link href={`/companies/${r.slug}#roles`} className="link">See the {r.open_roles} {r.open_roles === 1 ? 'posting' : 'postings'}</Link>
        </>)}
        {cell('Fit', weights.fit, r.fit, r.parts.fit, <>
          <p>ERP {r.erp_score} ({ERP_CLASS[r.erp_class]}) · size {r.size_score} ({SIZE_CLASS[r.size_class]}{r.employee_band ? `, ${r.employee_band}, unverified` : ''})</p>
          <p>Complexity {r.complexity_score} ({flags.length ? flags.join(', ') : 'none stated'})</p>
        </>)}
        {cell('Timing', weights.timing, r.timing, r.parts.timing, r.top_trigger ? <>
          <p>{TRIGGER_LABELS[r.top_trigger.trigger_type]} ({r.top_trigger.weight}) × age {r.top_trigger.age_multiplier} · {shortDate(r.top_trigger.event_date)}</p>
          <a href={r.top_trigger.url} target="_blank" rel="noreferrer" className="link">{r.top_trigger.headline}</a>
        </> : <p>{r.news_searched ? 'No qualifying trigger in the last 180 days.' : 'News is searched for the top companies by pain and fit only.'}</p>)}
      </div>
      <p className="num font-mono text-[12px] text-ink-muted">Lead score {r.parts.pain.toFixed(1)} + {r.parts.fit.toFixed(1)} + {r.parts.timing.toFixed(1)} = {r.score.toFixed(1)}</p>
    </div>
  );
}
