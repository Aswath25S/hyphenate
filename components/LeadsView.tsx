'use client';
import Link from 'next/link';
import { Fragment, useMemo, useState } from 'react';
import { LEAD_WEIGHTS, SIZE_BRACKETS } from '@/config/scoring';
import { leadScore } from '@/lib/scoring';
import { ROLE_LABELS, formatBand, pct, usd } from '@/lib/format';
import { useUrlState } from '@/lib/useUrlState';
import { downloadCsv } from '@/lib/csv';
import { Note, OverlapBar, OverlapLegend } from './ui';
import { Select } from './Select';

export type LeadRole = { posting_id: string; title: string; role_family: string; source_url: string; overlap: number; covered_share: number; salary_min: number | null; salary_max: number | null; savings: number | null };

export type LeadRow = {
  slug: string; company: string; domain: string; pain: number; fit: number;
  avg_overlap: number; avg_weighted_overlap: number; open_roles: number;
  savings_total: number; savings_roles: number; salary_roles: number; avg_salary: number | null; lead_product: string | null;
  erp: string[]; erp_class: string; erp_score: number; size_class: string; size_score: number; employee_band: string | null; size_source_url: string | null; size_note: string | null;
  complexity_score: number; complexity_count: number; complexity_flags: Record<string, boolean>; hq_state: string | null; role_families: string[];
  covered_share_avg: number; tools: string[]; has_brief: boolean; roles: LeadRole[];
};

const ERP_CLASS: Record<string, string> = { enterprise: 'Enterprise ERP', smb_only: 'QuickBooks/Xero only', not_stated: 'Not stated', other: 'Other' };
const SIZE_OPTIONS: [string, string][] = [...SIZE_BRACKETS.map((b) => [b.label, `${b.label} employees`] as [string, string]), ['unknown', 'Unknown']];
const KEYS = ['wp', 'sort', 'dir', 'role', 'erp', 'size', 'salary'];

/** Average-salary buckets for the Salary filter. */
const SALARY_BUCKETS: { value: string; label: string; test: (s: number) => boolean }[] = [
  { value: 'lt75', label: 'Under $75K', test: (s) => s < 75_000 },
  { value: '75-100', label: '$75K–$100K', test: (s) => s >= 75_000 && s < 100_000 },
  { value: '100-150', label: '$100K–$150K', test: (s) => s >= 100_000 && s < 150_000 },
  { value: '150-200', label: '$150K–$200K', test: (s) => s >= 150_000 && s < 200_000 },
  { value: '200plus', label: '$200K and above', test: (s) => s >= 200_000 },
];
const SALARY_OPTIONS: [string, string][] = [['yes', 'Any posted salary'], ...SALARY_BUCKETS.map((b) => [b.value, `Avg. ${b.label}`] as [string, string]), ['none', 'No salary posted']];

/** Plain-language names for the two score parts; formulas live on /method. */
const PARTS = {
  pain: { name: 'Hyphenate can do the work', tag: 'Pain', desc: 'How much of the work in their open finance roles is on Hyphenate’s site, and how many of those roles they are hiring for.' },
  fit: { name: 'Looks like a Hyphenate customer', tag: 'Fit', desc: 'Runs an ERP Hyphenate works with (NetSuite, SAP, Intacct, Dynamics, Oracle), has more employees (bigger companies score higher), and has complex finance such as several entities or currencies.' },
} as const;

export function LeadsView({ rows, excludedCount }: { rows: LeadRow[]; excludedCount: number }) {
  const u = useUrlState();
  // Open row is local state (as on the Gaps page) so it animates on the next frame;
  // routing it through the URL delayed the transition. ?open= still works on load.
  const [open, setOpen] = useState<string | null>(() => u.get('open') || null);
  // One slider: the share given to "Hyphenate can do the work"; the rest goes to fit.
  const painW = Math.min(1, Math.max(0, u.getNum('wp', LEAD_WEIGHTS.pain)));
  const weights = { pain: painW, fit: 1 - painW };
  const custom = Math.abs(painW - LEAD_WEIGHTS.pain) > 1e-6;
  const sort = u.get('sort', 'score');
  const dir = u.get('dir', 'desc');
  const f = { role: u.get('role'), erp: u.get('erp'), size: u.get('size'), salary: u.get('salary') };

  const scored = useMemo(() => rows.map((r) => {
    const def = leadScore(r.pain, r.fit);
    const yours = leadScore(r.pain, r.fit, weights);
    return { ...r, score: yours.score, parts: yours.parts, default_score: def.score };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [rows, weights.pain, weights.fit]);

  const ranked = useMemo(() => {
    const byScore = [...scored].sort((a, b) => b.score - a.score || a.company.localeCompare(b.company));
    const rank = new Map(byScore.map((r, i) => [r.slug, i + 1]));
    let list = scored.map((r) => ({ ...r, rank: rank.get(r.slug)! }));
    if (f.role) list = list.filter((r) => r.role_families.includes(f.role));
    if (f.erp) list = list.filter((r) => r.erp_class === f.erp);
    if (f.size) list = list.filter((r) => r.size_class === f.size);
    if (f.salary === 'yes') list = list.filter((r) => r.avg_salary !== null);
    else if (f.salary === 'none') list = list.filter((r) => r.avg_salary === null);
    else if (f.salary) { const b = SALARY_BUCKETS.find((x) => x.value === f.salary); if (b) list = list.filter((r) => r.avg_salary !== null && b.test(r.avg_salary)); }
    const key: Record<string, (r: (typeof list)[number]) => number | string> = {
      score: (r) => r.score, company: (r) => r.company.toLowerCase(), overlap: (r) => r.avg_overlap,
      salary: (r) => r.avg_salary ?? -1, rank: (r) => -r.rank,
    };
    const k = key[sort] ?? key.score;
    list.sort((a, b) => { const x = k(a), y = k(b); const c = x < y ? -1 : x > y ? 1 : 0; return dir === 'asc' ? c : -c; });
    return list;
  }, [scored, f.role, f.erp, f.size, f.salary, sort, dir]);

  const options = useMemo(() => ({
    roles: [...new Set(rows.flatMap((r) => r.role_families))].sort(),
  }), [rows]);

  const th = (k: string, label: string, right = false) => (
    <th scope="col" className={`whitespace-nowrap px-3 py-3 font-normal ${right ? 'text-right' : 'text-left'}`}>
      <button className={`t-mono hover:text-brand ${sort === k ? '!text-accent-ink' : ''}`} onClick={() => u.set({ sort: k, dir: sort === k && dir === 'desc' ? 'asc' : 'desc' })}>
        {label}{sort === k ? (dir === 'desc' ? ' ↓' : ' ↑') : ''}
      </button>
    </th>
  );
  const select = (k: keyof typeof f, label: string, opts: [string, string][]) => (
    <Select label={label} value={f[k]} options={opts} onChange={(v) => u.set({ [k]: v })} />
  );
  const exportCsv = () => downloadCsv('leads.csv', ranked.map((r) => ({
    rank: r.rank, company: r.company, domain: r.domain, lead_score: r.score.toFixed(1), pain: r.pain.toFixed(3), fit: r.fit.toFixed(3),
    overlap: r.avg_overlap.toFixed(3), open_roles: r.open_roles, avg_salary: r.avg_salary !== null ? Math.round(r.avg_salary) : '', minimum_savings: Math.round(r.savings_total), lead_product: r.lead_product ?? '',
    erp: r.erp, employee_band: r.employee_band ?? '',
    job_links: r.roles.map((x) => x.source_url),
  })), ['rank', 'company', 'domain', 'lead_score', 'pain', 'fit', 'overlap', 'open_roles', 'avg_salary', 'minimum_savings', 'lead_product', 'erp', 'employee_band', 'job_links']);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[290px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="card p-5">
          <div className="flex items-baseline justify-between"><span className="t-mono">What the score weighs</span>
            <button onClick={() => u.reset(KEYS)} className="link text-[13px]">Reset</button></div>
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="num text-[24px] leading-none tracking-[-0.02em] text-ink-display">{pct(weights.pain)}</p>
                <p className="mt-1 text-[13px] font-medium leading-snug">{PARTS.pain.name}</p>
              </div>
              <div className="text-right">
                <p className="num text-[24px] leading-none tracking-[-0.02em] text-ink-display">{pct(weights.fit)}</p>
                <p className="mt-1 text-[13px] font-medium leading-snug">{PARTS.fit.name}</p>
              </div>
            </div>
            <input type="range" min={0} max={1} step={0.05} value={painW} onChange={(e) => u.set({ wp: e.target.value })} className="w-full"
              aria-label="Balance between how much work Hyphenate can do and how much the company looks like a Hyphenate customer" aria-valuetext={`${pct(weights.pain)} work, ${pct(weights.fit)} fit`} />
            <div className="space-y-2 text-[12.5px] leading-relaxed text-ink-muted">
              <p><b className="font-medium text-ink">{PARTS.pain.name}:</b> {PARTS.pain.desc}</p>
              <p><b className="font-medium text-ink">{PARTS.fit.name}:</b> {PARTS.fit.desc}</p>
            </div>
          </div>
          <p className="mt-4 text-[12.5px] leading-relaxed text-ink-muted">
            Default: 67% / 33%. Slide to re-rank instantly.{custom && ' Scores below use your balance.'}
          </p>
          <Link href="/method#scoring" className="link mt-3 inline-block text-[13px]">How scores are calculated</Link>
        </div>
      </aside>

      <div className="min-w-0 space-y-4">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {select('role', 'Role family', options.roles.map((r) => [r, ROLE_LABELS[r] ?? r]))}
          {select('erp', 'ERP', Object.entries(ERP_CLASS))}
          {select('size', 'Employees', SIZE_OPTIONS)}
          {select('salary', 'Avg. salary', SALARY_OPTIONS)}
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
                {th('rank', '#')}{th('company', 'Company')}{th('score', 'Lead score', true)}{th('overlap', 'Overlap')}{th('salary', 'Avg. salary', true)}
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
                        {r.avg_salary !== null ? usd(r.avg_salary) : <span className="text-[13px] text-ink-muted">No salary posted</span>}
                        {r.avg_salary !== null && r.salary_roles < r.open_roles && <div className="t-mono mt-1">{r.salary_roles} of {r.open_roles} roles</div>}
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
          <b className="font-medium text-ink">Avg. salary</b> is the average yearly pay across the company&apos;s open finance roles that list a salary, using the middle of each posted range.
          Minimum savings for every role are on <Link href="/savings" className="link">Roles &amp; Savings</Link>.
        </Note>
      </div>
    </div>
  );
}

function Details({ r, weights }: { r: LeadRow & { parts: { pain: number; fit: number }; score: number }; weights: { pain: number; fit: number } }) {
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
      <dl className="flex flex-wrap gap-x-8 gap-y-2 text-[14px]">
        <div><dt className="t-mono">Employees</dt><dd className="mt-0.5">{r.employee_band ? formatBand(r.employee_band) : 'Unknown'}{' '}
          {r.size_source_url ? <a href={r.size_source_url} target="_blank" rel="noreferrer" className="link text-[12.5px]">({r.size_note?.split(',')[0]} ↗)</a> : r.employee_band ? <span className="text-[12.5px] text-ink-muted">(estimate)</span> : null}</dd></div>
        <div><dt className="t-mono">ERP</dt><dd className="mt-0.5">{r.erp.length ? r.erp.join(', ') : 'Not stated'}</dd></div>
      </dl>

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
                {x.salary_min !== null ? <>Salary {usd(x.salary_min)}{x.salary_max ? `–${usd(x.salary_max)}` : ''}</> : <span className="text-ink-muted">No salary posted</span>}
              </span>
              <span className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
                <Link href={`/postings/${x.posting_id}`} className="link whitespace-nowrap">Role breakdown</Link>
                <a href={x.source_url} target="_blank" rel="noreferrer" className="link whitespace-nowrap">Job posting ↗</a>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <span className="t-mono">Why it scores {r.score.toFixed(0)}</span>
        <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
          {part('pain', weights.pain, r.pain, r.parts.pain, <>On average {pct(r.avg_overlap)} of the duties in their {r.open_roles} open {r.open_roles === 1 ? 'role is' : 'roles are'} work Hyphenate advertises.</>)}
          {part('fit', weights.fit, r.fit, r.parts.fit, <>ERP: {r.erp.length ? r.erp.join(', ') : 'not stated'}. Size: {r.employee_band ? `${formatBand(r.employee_band)} employees${r.size_source_url ? '' : ' (estimate)'}` : 'unknown'}. Complexity: {flags.length ? flags.join(', ') : 'none stated'}.</>)}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/companies/${r.slug}`} className="btn-primary !py-2 !text-[14px]">View full case for {r.company}</Link>
      </div>
    </div>
  );
}
