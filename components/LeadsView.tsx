'use client';
import Link from 'next/link';
import { Fragment, useMemo } from 'react';
import { LEAD_WEIGHTS } from '@/config/scoring';
import { leadScore } from '@/lib/scoring';
import { ROLE_LABELS, TRIGGER_LABELS, pct, shortDate, usd } from '@/lib/format';
import { useUrlState } from '@/lib/useUrlState';
import { downloadCsv } from '@/lib/csv';
import { Note, OverlapBar, OverlapLegend } from './ui';

export type LeadRole = { posting_id: string; title: string; role_family: string; source_url: string; overlap: number; covered_share: number; salary_min: number | null; savings: number | null };

export type LeadRow = {
  slug: string; company: string; domain: string; pain: number; fit: number; timing: number;
  avg_overlap: number; avg_weighted_overlap: number; open_roles: number;
  savings_total: number; savings_roles: number; salary_roles: number; lead_product: string | null;
  top_trigger: { trigger_type: string; event_date: string | null; url: string; headline: string; weight: number; age_multiplier: number } | null;
  news_searched: boolean; erp: string[]; erp_class: string; erp_score: number; size_class: string; size_score: number; employee_band: string | null;
  complexity_score: number; complexity_count: number; complexity_flags: Record<string, boolean>; hq_state: string | null; role_families: string[];
  covered_share_avg: number; tools: string[]; has_brief: boolean; roles: LeadRole[];
};

const ERP_CLASS: Record<string, string> = { enterprise: 'Enterprise ERP', smb_only: 'QuickBooks/Xero only', not_stated: 'Not stated', other: 'Other' };
const SIZE_CLASS: Record<string, string> = { in_band: '200–5,000 employees', out_of_band: 'Outside 200–5,000', unknown: 'Unknown' };
const KEYS = ['wp', 'wf', 'wt', 'sort', 'dir', 'role', 'erp', 'size', 'state', 'salary', 'trigger', 'open'];

/** Plain-language names for the three score parts; formulas live on /method. */
const PARTS = {
  pain: { name: 'Hyphenate can do the work', tag: 'Pain', desc: 'How much of the work in their open finance roles is on Hyphenate’s site, and how many of those roles they are hiring for.' },
  fit: { name: 'Looks like a Hyphenate customer', tag: 'Fit', desc: 'Runs an ERP Hyphenate works with (NetSuite, SAP, Intacct, Dynamics, Oracle), has 200–5,000 employees, and has complex finance such as several entities or currencies.' },
  timing: { name: 'Potential paying customer', tag: 'Timing', desc: 'Recent news such as a funding round, acquisition, new CFO or ERP change. News older than 90 days counts half; older than 180 days, not at all.' },
} as const;

export function LeadsView({ rows, excludedCount }: { rows: LeadRow[]; excludedCount: number }) {
  const u = useUrlState();
  const open = u.get('open') || null;
  const setOpen = (slug: string | null) => u.set({ open: slug });
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
    const byScore = [...scored].sort((a, b) => b.score - a.score || a.company.localeCompare(b.company));
    const rank = new Map(byScore.map((r, i) => [r.slug, i + 1]));
    let list = scored.map((r) => ({ ...r, rank: rank.get(r.slug)! }));
    if (f.role) list = list.filter((r) => r.role_families.includes(f.role));
    if (f.erp) list = list.filter((r) => r.erp_class === f.erp);
    if (f.size) list = list.filter((r) => r.size_class === f.size);
    if (f.state) list = list.filter((r) => r.hq_state === f.state);
    if (f.salary === 'yes') list = list.filter((r) => r.salary_roles > 0);
    if (f.trigger) list = list.filter((r) => (f.trigger === 'none' ? !r.top_trigger : r.top_trigger?.trigger_type === f.trigger));
    const key: Record<string, (r: (typeof list)[number]) => number | string> = {
      score: (r) => r.score, company: (r) => r.company.toLowerCase(), overlap: (r) => r.avg_overlap,
      savings: (r) => r.savings_total, rank: (r) => -r.rank,
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
      <select value={f[k]} onChange={(e) => u.set({ [k]: e.target.value })} className="w-full min-w-0 rounded-md border border-line bg-surface px-2.5 py-2 text-[14px]">
        <option value="">All</option>
        {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
  const exportCsv = () => downloadCsv('leads.csv', ranked.map((r) => ({
    rank: r.rank, company: r.company, domain: r.domain, lead_score: r.score.toFixed(1), pain: r.pain.toFixed(3), fit: r.fit.toFixed(3), timing: r.timing.toFixed(3),
    overlap: r.avg_overlap.toFixed(3), open_roles: r.open_roles, minimum_savings: Math.round(r.savings_total), lead_product: r.lead_product ?? '',
    top_trigger: r.top_trigger ? TRIGGER_LABELS[r.top_trigger.trigger_type] : '', trigger_url: r.top_trigger?.url ?? '', erp: r.erp, employee_band: r.employee_band ?? '', hq_state: r.hq_state ?? '',
    job_links: r.roles.map((x) => x.source_url),
  })), ['rank', 'company', 'domain', 'lead_score', 'pain', 'fit', 'timing', 'overlap', 'open_roles', 'minimum_savings', 'lead_product', 'top_trigger', 'trigger_url', 'erp', 'employee_band', 'hq_state', 'job_links']);

  const slider = (k: 'wp' | 'wf' | 'wt', part: keyof typeof PARTS, v: number, eff: number) => (
    <label className="block">
      <span className="flex items-baseline justify-between gap-2"><span className="text-[14px] font-medium">{PARTS[part].name}</span><span className="num font-mono text-[12px] text-ink-muted">{pct(eff)}</span></span>
      <span className="mt-1 block text-[12.5px] leading-relaxed text-ink-muted">{PARTS[part].desc}</span>
      <input type="range" min={0} max={1} step={0.05} value={v} onChange={(e) => u.set({ [k]: e.target.value })} className="mt-2 w-full" aria-label={`${PARTS[part].name} weight`} />
    </label>
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[290px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="card p-5">
          <div className="flex items-baseline justify-between"><span className="t-mono">What the score weighs</span>
            <button onClick={() => u.reset(KEYS)} className="link text-[13px]">Reset</button></div>
          <div className="mt-4 space-y-5">
            {slider('wp', 'pain', raw.pain, weights.pain)}
            {slider('wf', 'fit', raw.fit, weights.fit)}
            {slider('wt', 'timing', raw.timing, weights.timing)}
          </div>
          <p className="mt-4 text-[12.5px] leading-relaxed text-ink-muted">
            Default: 50% / 25% / 25%. Slide to re-rank instantly.{custom && ' Scores below use your weights.'}
          </p>
          <Link href="/method#scoring" className="link mt-3 inline-block text-[13px]">How scores are calculated</Link>
        </div>
      </aside>

      <div className="min-w-0 space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {select('role', 'Role family', options.roles.map((r) => [r, ROLE_LABELS[r] ?? r]))}
          {select('erp', 'ERP', Object.entries(ERP_CLASS))}
          {select('size', 'Size', Object.entries(SIZE_CLASS))}
          {select('state', 'HQ state', options.states.map((s) => [s, s]))}
          {select('salary', 'Salary', [['yes', 'Has salary']])}
          {select('trigger', 'News trigger', [...options.triggers.map((t) => [t, TRIGGER_LABELS[t] ?? t] as [string, string]), ['none', 'No trigger']])}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="t-mono">Showing {ranked.length} of {rows.length} lead companies{excludedCount ? ` · ${excludedCount} finance-software ${excludedCount === 1 ? 'vendor' : 'vendors'} not shown` : ''}</span>
          <div className="flex gap-3">
            <button onClick={() => u.reset(KEYS)} className="link text-[13px]">Reset to defaults</button>
            <button onClick={exportCsv} className="btn-secondary !py-1.5 !text-[13px]">Export CSV</button>
          </div>
        </div>
        <OverlapLegend />
        <div className="card relative overflow-x-auto">
          <table className="w-full min-w-[720px] table-fixed border-collapse text-[14px]">
            {/* Fixed column widths so headers never shift when a row opens. */}
            <colgroup>
              <col className="w-[3.5rem]" />
              <col />
              <col className="w-[7.5rem]" />
              <col className="w-[12rem]" />
              <col className="w-[10rem]" />
              <col className="w-[10.5rem]" />
            </colgroup>
            <thead className="border-b border-line">
              <tr>
                {th('rank', '#')}{th('company', 'Company')}{th('score', 'Lead score', true)}{th('overlap', 'Overlap')}{th('savings', 'Min. savings / yr', true)}
                <th scope="col" className="px-3 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((r) => {
                const isOpen = open === r.slug;
                return (
                  <Fragment key={r.slug}>
                    <tr className={`cursor-pointer border-t border-dashed border-line-dashed transition-colors hover:bg-surface-tint ${isOpen ? 'bg-surface-tint' : ''}`} onClick={() => setOpen(isOpen ? null : r.slug)}>
                      <td className="num px-3 py-4 font-mono text-[12px] text-ink-muted">{String(r.rank).padStart(2, '0')}</td>
                      <td className="px-3 py-4">
                        <span className="font-medium">{r.company}</span>
                        <div className="t-mono mt-0.5">{r.open_roles} open finance {r.open_roles === 1 ? 'role' : 'roles'}</div>
                      </td>
                      <td className="px-3 py-4 text-right">
                        <span className="num text-[22px] leading-none tracking-[-0.02em] text-ink-display">{r.score.toFixed(0)}</span>
                        {custom && <div className="t-mono mt-1">default {r.default_score.toFixed(0)}</div>}
                      </td>
                      <td className="w-[170px] px-3 py-4">
                        <OverlapBar covered={r.covered_share_avg} assisted={Math.max(0, r.avg_overlap - r.covered_share_avg)} />
                        <div className="t-mono mt-1.5">{pct(r.avg_overlap)} of duties</div>
                      </td>
                      <td className="num px-3 py-4 text-right">
                        {r.savings_roles ? usd(r.savings_total) : <span className="text-[13px] text-ink-muted">No salary posted</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-right">
                        <Link href={`/companies/${r.slug}`} onClick={(e) => e.stopPropagation()} className="btn-secondary !px-3 !py-1.5 !text-[13px]">View case</Link>
                        <button className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-ink-muted hover:border-brand hover:text-brand"
                          aria-expanded={isOpen} aria-label={isOpen ? `Hide details for ${r.company}` : `Show details for ${r.company}`}
                          onClick={(e) => { e.stopPropagation(); setOpen(isOpen ? null : r.slug); }}>
                          <svg aria-hidden viewBox="0 0 16 16" className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}><path d="M3.5 6l4.5 4.5L12.5 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </button>
                      </td>
                    </tr>
                    <tr className={isOpen ? 'bg-surface-tint' : ''} aria-hidden={!isOpen}>
                      <td colSpan={6} className="p-0">
                        <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                          <div className="min-h-0 overflow-hidden">
                            <div className="px-3 pb-6 pt-2 sm:px-5" inert={!isOpen}>
                              <Details r={r} weights={weights} />
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
              {!ranked.length && <tr><td colSpan={6} className="px-3 py-10 text-center text-ink-muted">No leads match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
        <Note>
          <b className="font-medium text-ink">Salary</b> is the lowest yearly pay the job posting lists.{' '}
          <b className="font-medium text-ink">Min. savings / yr</b> is the part of that salary tied to work Hyphenate fully does: salary × share of duties Hyphenate does end to end × 0.5 safety discount, summed across the company&apos;s open roles.
          It is a deliberate floor, before Hyphenate&apos;s own price. <Link href="/savings" className="link">How savings are calculated</Link>.
        </Note>
      </div>
    </div>
  );
}

function Details({ r, weights }: { r: LeadRow & { parts: { pain: number; fit: number; timing: number }; score: number }; weights: { pain: number; fit: number; timing: number } }) {
  const flags = Object.entries(r.complexity_flags).filter(([, v]) => v).map(([k]) => k.replace(/_/g, ' '));
  const part = (k: keyof typeof PARTS, w: number, v: number, pts: number, text: React.ReactNode) => (
    <div className="card-flat p-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[14px] font-medium">{PARTS[k].name}</span>
        <span className="num whitespace-nowrap font-mono text-[12px] text-ink-display">{pts.toFixed(1)} pts</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-bg ring-1 ring-line"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(1, v) * 100}%` }} /></div>
      <p className="mt-2 text-[13px] leading-relaxed text-ink/80">{text}</p>
      <p className="t-mono mt-2">{PARTS[k].tag} {(v * 100).toFixed(0)}/100 · weight {pct(w)}</p>
    </div>
  );
  return (
    <div className="space-y-5 py-2">
      <div>
        <span className="t-mono">Open finance roles</span>
        <ul className="mt-2 divide-y divide-dashed divide-line-dashed rounded-[var(--radius-card)] border border-line bg-surface">
          {r.roles.map((x) => (
            <li key={x.posting_id} className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] sm:items-center sm:gap-6">
              <span>
                <span className="text-[14.5px] font-medium">{x.title}</span>
                <span className="t-mono ml-2">{ROLE_LABELS[x.role_family] ?? x.role_family}</span>
              </span>
              <span><OverlapBar covered={x.covered_share} assisted={Math.max(0, x.overlap - x.covered_share)} /><span className="t-mono mt-1 block">{pct(x.overlap)} of duties</span></span>
              <span className="num text-[13px] leading-snug">
                {x.salary_min !== null ? <>Salary from {usd(x.salary_min)}<span className="block text-ink-muted">Min. savings {x.savings !== null ? usd(x.savings) : '–'}</span></> : <span className="text-ink-muted">No salary posted</span>}
              </span>
              <span className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
                <Link href={`/postings/${x.posting_id}`} className="link whitespace-nowrap">Duty breakdown</Link>
                <a href={x.source_url} target="_blank" rel="noreferrer" className="link whitespace-nowrap">Job posting ↗</a>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <span className="t-mono">Why it scores {r.score.toFixed(0)}</span>
        <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-3">
          {part('pain', weights.pain, r.pain, r.parts.pain, <>On average {pct(r.avg_overlap)} of the duties in their {r.open_roles} open {r.open_roles === 1 ? 'role is' : 'roles are'} work Hyphenate advertises.</>)}
          {part('fit', weights.fit, r.fit, r.parts.fit, <>ERP: {r.erp.length ? r.erp.join(', ') : 'not stated'}. Size: {r.employee_band ?? 'unknown'}{r.employee_band ? ' (unverified)' : ''}. Complexity: {flags.length ? flags.join(', ') : 'none stated'}.</>)}
          {part('timing', weights.timing, r.timing, r.parts.timing, r.top_trigger
            ? <>{TRIGGER_LABELS[r.top_trigger.trigger_type]} on {shortDate(r.top_trigger.event_date)}: <a href={r.top_trigger.url} target="_blank" rel="noreferrer" className="link">{r.top_trigger.headline}</a></>
            : r.news_searched ? <>No qualifying news in the last 180 days.</> : <>News is only searched for the 30 strongest companies by the first two parts.</>)}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/companies/${r.slug}`} className="btn-primary !py-2 !text-[14px]">View full case for {r.company}</Link>
      </div>
    </div>
  );
}
