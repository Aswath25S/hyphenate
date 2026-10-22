'use client';
import Link from 'next/link';
import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { SAVINGS_DEFAULTS, SAVINGS_RANGES, type SalaryBasis } from '@/config/scoring';
import { median, minimumSavings } from '@/lib/scoring';
import { ROLE_LABELS, savingsShare, usd } from '@/lib/format';
import { useUrlState } from '@/lib/useUrlState';

export type SavingsRow = { posting_id: string; company: string; slug: string; title: string; role_family: string; salary_min: number | null; salary_max: number | null; n: number; C: number; A: number; excluded: string | null };

const KEYS = ['basis', 'd', 'assisted'];

export function SavingsView({ rows }: { rows: SavingsRow[] }) {
  const u = useUrlState();
  const s = {
    salaryBasis: (u.get('basis', SAVINGS_DEFAULTS.salaryBasis) === 'midpoint' ? 'midpoint' : 'bottom') as SalaryBasis,
    discount: u.getNum('d', SAVINGS_DEFAULTS.discount),
    countAssisted: u.get('assisted') ? u.get('assisted') === '1' : SAVINGS_DEFAULTS.countAssisted,
    assistedWeight: SAVINGS_DEFAULTS.assistedWeight,
  };
  const custom = s.salaryBasis !== SAVINGS_DEFAULTS.salaryBasis || s.discount !== SAVINGS_DEFAULTS.discount || s.countAssisted !== SAVINGS_DEFAULTS.countAssisted;

  const calc = useMemo(() => rows.map((r) => {
    const i = { salary_min: r.salary_min, salary_max: r.salary_max, n: r.n, C: r.C, A: r.A };
    const def = minimumSavings(i);
    const yours = minimumSavings(i, s);
    return { ...r, def: def.eligible ? def.value : null, yours: yours.eligible ? yours.value : null, reason: def.eligible ? null : def.reason, salary_used: yours.eligible ? yours.salary_used : null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [rows, s.salaryBasis, s.discount, s.countAssisted]);

  const eligible = calc.filter((r) => r.def !== null);
  // Worked example: the eligible role with the largest figure under the current settings.
  const ex = [...eligible].sort((x, y) => (y.yours ?? 0) - (x.yours ?? 0))[0] as (typeof eligible)[number] & { salary_used: number; yours: number } | undefined;
  const withSalary = calc.filter((r) => r.salary_min !== null);
  const totalDef = eligible.reduce((a, r) => a + (r.def ?? 0), 0);
  const totalYours = eligible.reduce((a, r) => a + (r.yours ?? 0), 0);
  const totalStrict = eligible.reduce((a, r) => { const v = minimumSavings({ salary_min: r.salary_min, salary_max: r.salary_max, n: r.n, C: r.C, A: r.A }, { ...SAVINGS_DEFAULTS, countAssisted: false }); return a + (v.eligible ? v.value : 0); }, 0);
  const salaryPool = eligible.reduce((a, r) => a + (r.salary_used ?? r.salary_min ?? 0), 0);
  const shown = custom ? totalYours : totalDef;

  const byCompany = useMemo(() => {
    const m = new Map<string, { company: string; slug: string; value: number; roles: number }>();
    for (const r of eligible) {
      const v = (custom ? r.yours : r.def) ?? 0;
      const e = m.get(r.slug) ?? { company: r.company, slug: r.slug, value: 0, roles: 0 };
      e.value += v; e.roles += 1; m.set(r.slug, e);
    }
    return [...m.values()].sort((a, b) => b.value - a.value).slice(0, 15);
  }, [eligible, custom]);

  const byFamily = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const r of eligible) m.set(r.role_family, [...(m.get(r.role_family) ?? []), (custom ? r.yours : r.def) ?? 0]);
    return [...m.entries()].map(([f, xs]) => ({ family: f, total: xs.reduce((a, b) => a + b, 0), median: median(xs) ?? 0, roles: xs.length })).sort((a, b) => b.total - a.total);
  }, [eligible, custom]);
  const maxFam = Math.max(1, ...byFamily.map((f) => f.total));

  return (
    <div className="space-y-14">
      {/* Headline + formula */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="card p-6 sm:p-8">
          <span className="t-mono">Dataset total, default assumptions</span>
          <div className="num mt-2 text-[52px] leading-none tracking-[-0.03em] text-ink-display sm:text-[64px]">{usd(totalDef)}</div>
          <p className="mt-3 text-[15px] text-ink/80">At least this much yearly salary is tied to duties Hyphenate&apos;s agents already handle, across {eligible.length} postings.</p>
          <div className="mt-4 rounded-lg border border-line bg-bg px-4 py-3">
            <span className="t-mono">Strict floor</span>
            <div className="num mt-1 text-[24px] leading-none tracking-[-0.02em] text-ink-display">{usd(totalStrict)}</div>
            <p className="mt-1.5 text-[13px] text-ink-muted">Counting only duties Hyphenate does end to end, leaving out the ones it prepares for a person to approve.</p>
          </div>
          {custom && (
            <div className="mt-5 rounded-lg border border-accent bg-accent-soft p-4">
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-accent-ink">Your assumptions</span>
              <div className="num mt-1 text-[32px] leading-none tracking-[-0.02em] text-accent-ink">{usd(totalYours)}</div>
            </div>
          )}
          <div className="mt-5 space-y-1 text-[13px] text-ink-muted">
            <p>Based on {withSalary.length} of {rows.length} postings that list a salary; {withSalary.length - eligible.length} thin {withSalary.length - eligible.length === 1 ? 'posting' : 'postings'} excluded.</p>
            <p>Gross value, not net savings: Hyphenate&apos;s price is unknown.</p>
            <p>A share of each role’s posted salary: the pay tied to duties Hyphenate could take on before the next hire. Not a count of people to cut.</p>
          </div>
        </div>

        <div className="card p-6 sm:p-8">
          <div className="flex items-baseline justify-between"><span className="t-mono">The formula</span><button onClick={() => u.reset(KEYS)} className="link text-[13px]">Reset to defaults</button></div>
          <p className="mt-3 text-[15px] font-medium">Minimum savings for one role =</p>
          <ol className="mt-2 divide-y divide-dashed divide-line-dashed rounded-lg border border-line bg-bg">
            {[
              { op: '', name: s.salaryBasis === 'midpoint' ? 'Salary (middle of posted range)' : 'Salary (lowest of posted range)', value: ex ? usd(ex.salary_used) : '–', desc: 'The yearly pay the job posting lists.' },
              { op: '×', name: 'Share of the role Hyphenate does', value: ex ? `${savingsShare(ex.C, ex.A, s.assistedWeight, s.countAssisted)} ÷ ${ex.n}` : '–', desc: s.countAssisted ? `Duties Hyphenate does end to end, plus a quarter of each duty it prepares for a person to approve (a person still reviews those), divided by all the role's duties.` : "Duties Hyphenate does end to end, divided by all the role's duties. Duties it only prepares for approval are left out." },
              { op: '×', name: 'Safety discount', value: s.discount.toFixed(2), desc: 'Halves the result by default, to allow for review time and duties that take unequal time.' },
            ].map((t) => (
              <li key={t.name} className="grid grid-cols-[1.25rem_1fr_auto] items-start gap-2 px-3 py-2.5">
                <span className="font-mono text-[14px] text-ink-muted">{t.op}</span>
                <span><span className="text-[14px] font-medium">{t.name}</span><span className="block text-[12.5px] leading-snug text-ink-muted">{t.desc}</span></span>
                <span className="num whitespace-nowrap font-mono text-[13px] text-ink-display">{t.value}</span>
              </li>
            ))}
          </ol>
          {ex && (
            <p className="mt-3 text-[13px] leading-relaxed text-ink/80">
              Example: <Link href={`/postings/${ex.posting_id}`} className="link">{ex.title}</Link> at {ex.company}. {usd(ex.salary_used)} × {savingsShare(ex.C, ex.A, s.assistedWeight, s.countAssisted)}/{ex.n} × {s.discount.toFixed(2)} = <b className="font-medium text-ink">{usd(ex.yours)}</b> a year.
            </p>
          )}
          <div className="mt-5 space-y-5">
            <fieldset>
              <legend className="text-[14px]">Salary used</legend>
              <div className="mt-2 flex gap-2">
                {(['bottom', 'midpoint'] as const).map((b) => (
                  <button key={b} onClick={() => u.set({ basis: b === 'bottom' ? null : b })} className={`rounded-md border px-3 py-1.5 text-[13px] ${s.salaryBasis === b ? 'border-accent bg-surface-tint text-accent-ink' : 'border-line'}`}>{b === 'bottom' ? 'Bottom of range' : 'Midpoint'}</button>
                ))}
              </div>
            </fieldset>
            <label className="block">
              <span className="flex justify-between text-[14px]"><span>Safety discount</span><span className="num font-mono text-[12px] text-ink-muted">{s.discount.toFixed(2)}</span></span>
              <input type="range" min={SAVINGS_RANGES.discount.min} max={SAVINGS_RANGES.discount.max} step={SAVINGS_RANGES.discount.step} value={s.discount} onChange={(e) => u.set({ d: e.target.value })} className="mt-2 w-full" />
              <span className="text-[12.5px] text-ink-muted">Stands in for exception review and unequal duty time. Default 0.5.</span>
            </label>
            <label className="flex items-start gap-3 text-[14px]">
              <input type="checkbox" checked={s.countAssisted} onChange={(e) => u.set({ assisted: e.target.checked === SAVINGS_DEFAULTS.countAssisted ? null : e.target.checked ? 1 : 0 })} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]" />
              <span>
                Include work Hyphenate prepares for a person to approve
                <span className="mt-0.5 block text-[12.5px] leading-relaxed text-ink-muted">
                  Each of those duties counts as a quarter of a duty Hyphenate does end to end, since a person still has to review it. Untick to count only end-to-end work (the strict floor). On by default.
                </span>
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* With vs without */}
      <div>
        <h3 className="t-sub">Salary in these roles, with and without the covered work.</h3>
        <div className="hatch mt-5 space-y-3 rounded-[var(--radius-card)] border border-line p-4 sm:p-6">
          <div className="relative h-12 overflow-hidden rounded-md border border-line bg-white">
            <div className="flex h-full items-center justify-between gap-3 px-3 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted"><span>Salary across {eligible.length} postings</span><span className="num">{usd(salaryPool)}</span></div>
          </div>
          <div className="relative h-12">
            <div className="absolute inset-y-0 left-0 flex items-center rounded-md border border-accent bg-accent-soft px-3" style={{ width: `min(100%, max(${salaryPool ? ((shown / salaryPool) * 100).toFixed(1) : 0}%, 18rem))` }}>
              <span className="truncate whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.08em] text-accent-ink">Salary tied to Hyphenate’s work: {usd(shown)}</span>
            </div>
          </div>
          <div className="flex justify-between font-mono text-[11px] text-ink-muted"><span>0</span><span>{salaryPool ? `${((shown / salaryPool) * 100).toFixed(0)}% of salary` : ''}</span><span>{usd(salaryPool, { compact: true })}</span></div>
        </div>
      </div>

      {/* Per company */}
      <div id="companies">
        <h3 className="t-sub">Top companies by minimum savings.</h3>
        <div className="card mt-5 p-4 sm:p-6">
          <div style={{ height: Math.max(240, byCompany.length * 34) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCompany} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 8 }} barCategoryGap={6}>
                <CartesianGrid horizontal={false} stroke="#EBE2D8" />
                <XAxis type="number" tickFormatter={(v) => usd(v, { compact: true })} tick={{ fill: '#897D71', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="company" width={130} tick={{ fill: '#272320', fontSize: 13 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#F8F1EA' }} content={({ active, payload }) => active && payload?.length ? (
                  <div className="rounded-md border border-line bg-white px-3 py-2 text-[13px] shadow-sm">
                    <div className="font-medium">{payload[0].payload.company}</div>
                    <div className="num">{usd(payload[0].payload.value)} across {payload[0].payload.roles} {payload[0].payload.roles === 1 ? 'role' : 'roles'}</div>
                  </div>) : null} />
                <Bar dataKey="value" fill="#FF6716" radius={[0, 4, 4, 0]} maxBarSize={20} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
            {byCompany.map((c) => <li key={c.slug}><Link href={`/companies/${c.slug}#savings`} className="link">{c.company}</Link> <span className="num text-ink-muted">{usd(c.value)}</span></li>)}
          </ul>
        </div>
      </div>

      {/* By role family */}
      <div id="families">
        <h3 className="t-sub">Where the money sits, by role family.</h3>
        <div className="card mt-5 overflow-x-auto">
          <table className="w-full min-w-[560px] text-[14px]">
            <thead className="border-b border-line"><tr>{['Role family', 'Roles', 'Total', '', 'Median'].map((h, i) => <th key={i} className={`px-4 py-3 font-normal ${i === 0 || i === 3 ? 'text-left' : 'text-right'}`}><span className="t-mono">{h}</span></th>)}</tr></thead>
            <tbody>
              {byFamily.map((f) => (
                <tr key={f.family} className="border-t border-dashed border-line-dashed">
                  <td className="px-4 py-3">{ROLE_LABELS[f.family] ?? f.family}</td>
                  <td className="num px-4 py-3 text-right">{f.roles}</td>
                  <td className="num px-4 py-3 text-right">{usd(f.total)}</td>
                  <td className="w-[35%] px-4 py-3"><div className="h-2 rounded-r-[4px] bg-accent" style={{ width: `${(f.total / maxFam) * 100}%` }} /></td>
                  <td className="num px-4 py-3 text-right">{usd(f.median)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Every role */}
      <div id="roles">
        <h3 className="t-sub">Every role, with its breakdown.</h3>
        <div className="card mt-5 overflow-x-auto">
          <table className="w-full min-w-[900px] text-[14px]">
            <thead className="border-b border-line"><tr>{['Role', 'Company', 'Role breakdown', 'Salary min', 'Savings (default)', custom ? 'Savings (yours)' : ''].map((h, i) => <th key={i} className={`whitespace-nowrap px-4 py-3 font-normal ${i < 3 ? 'text-left' : 'text-right'}`}><span className="t-mono">{h}</span></th>)}</tr></thead>
            <tbody>
              {[...calc].sort((a, b) => (b.def ?? -1) - (a.def ?? -1)).map((r) => (
                <tr key={r.posting_id} className="border-t border-dashed border-line-dashed">
                  <td className="px-4 py-2.5">{r.title}</td>
                  <td className="px-4 py-2.5"><Link href={`/companies/${r.slug}`} className="hover:text-brand">{r.company}</Link></td>
                  <td className="whitespace-nowrap px-4 py-2.5"><Link href={`/postings/${r.posting_id}`} className="link">Role breakdown</Link></td>
                  <td className="num px-4 py-2.5 text-right">{r.salary_min !== null ? usd(r.salary_min) : '–'}</td>
                  <td className="num px-4 py-2.5 text-right">{r.def !== null ? usd(r.def) : <span className="text-[13px] text-ink-muted">{r.reason === 'no_salary' ? 'No salary posted' : r.reason === 'thin_posting' ? 'Thin posting' : 'No duties'}</span>}</td>
                  <td className="num px-4 py-2.5 text-right text-accent-ink">{custom && r.yours !== null ? usd(r.yours) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
