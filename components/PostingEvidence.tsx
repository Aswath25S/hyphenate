'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { DutyView, PostingDetail } from '@/lib/app-types';
import { ROLE_LABELS, pct, savingsShare, shortDate, usd } from '@/lib/format';
import { SAVINGS_DEFAULTS } from '@/config/scoring';
import { LabelChip, Mono } from './ui';

type Seg = { text: string; duty: number | null };

/** Split the posting into runs, each owned by at most one duty (scored duties win overlaps). */
function segments(text: string, duties: DutyView[]): Seg[] {
  const owner = new Int32Array(text.length).fill(-1);
  const order = duties.map((d, i) => ({ d, i })).sort((a, b) => Number(b.d.scored) - Number(a.d.scored));
  for (const { d, i } of order) {
    if (!d.span) continue;
    for (let c = d.span.start; c < d.span.end && c < text.length; c++) if (owner[c] === -1) owner[c] = i;
  }
  const out: Seg[] = [];
  let start = 0;
  for (let c = 1; c <= text.length; c++) {
    if (c === text.length || owner[c] !== owner[start]) {
      out.push({ text: text.slice(start, c), duty: owner[start] === -1 ? null : owner[start] });
      start = c;
    }
  }
  return out;
}

function hlClass(d: DutyView): string {
  if (!d.scored) return d.is_requirement ? 'hl hl-requirement' : 'hl hl-boilerplate';
  return `hl hl-${d.label ?? 'unclear'}`;
}

export function PostingEvidence({ p }: { p: PostingDetail }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const segs = useMemo(() => segments(p.text, p.duties), [p.text, p.duties]);
  const scored = p.duties.map((d, i) => ({ d, i })).filter((x) => x.d.scored);
  const other = p.duties.map((d, i) => ({ d, i })).filter((x) => !x.d.scored);
  const active = hover ?? selected;
  const ad = active !== null ? p.duties[active] : null;
  // Phones: the side panel sits below the posting, so a tapped duty opens a bottom sheet instead.
  const [sheet, setSheet] = useState<number | null>(null);
  const narrow = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches;
  const pick = (i: number) => { setSelected(i); if (narrow()) setSheet(i); };
  const focus = (i: number) => {
    pick(i);
    document.getElementById(`span-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const [lastSheet, setLastSheet] = useState<number | null>(null);
  if (sheet !== null && sheet !== lastSheet) setLastSheet(sheet); // keep content while the sheet slides away
  const sd = lastSheet !== null ? p.duties[lastSheet] : null;

  return (
    <div className="space-y-8">
      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="card p-5">
          <div className="num text-[44px] leading-none tracking-[-0.03em] text-ink-display">{p.n ? pct(p.overlap) : '–'}</div>
          <div className="t-mono mt-2">Overlap</div>
          <div className="mt-2 text-[13px] text-ink-muted">{p.C} done end to end + {p.A} prepared for approval, of {p.n} duties</div>
        </div>
        <div className="card p-5">
          <div className="num text-[44px] leading-none tracking-[-0.03em] text-ink-display">{p.n ? pct(p.covered_share) : '–'}</div>
          <div className="t-mono mt-2">Done end to end</div>
          <div className="mt-2 text-[13px] text-ink-muted">Duties Hyphenate does end to end</div>
        </div>
        <div className="card p-5">
          <div className="num text-[30px] leading-tight tracking-[-0.02em] text-ink-display">{p.salary_min !== null ? `${usd(p.salary_min)}${p.salary_max ? `–${usd(p.salary_max)}` : ''}` : 'No salary posted'}</div>
          <div className="t-mono mt-2">Salary (yearly){p.salary_varies ? ' · varies by location' : ''}</div>
          {p.salary_raw?.raw_text && <div className="mt-2 line-clamp-3 text-[12.5px] text-ink-muted">&ldquo;{p.salary_raw.raw_text}&rdquo;</div>}
        </div>
        <div className="card p-5">
          <div className="num text-[30px] leading-tight tracking-[-0.02em] text-ink-display">{p.savings !== null ? usd(p.savings) : '–'}</div>
          <div className="t-mono mt-2">Minimum savings a year</div>
          <div className="mt-2 text-[12.5px] text-ink-muted">
            {p.savings !== null
              ? <>{usd(p.salary_min)} × {savingsShare(p.C, p.A, SAVINGS_DEFAULTS.assistedWeight, SAVINGS_DEFAULTS.countAssisted)}/{p.n} × {SAVINGS_DEFAULTS.discount}. Duties Hyphenate prepares count a quarter.</>
              : p.savings_reason === 'thin_posting' ? 'Thin posting (fewer than 4 scored duties): excluded.' : p.savings_reason === 'no_salary' ? 'No salary posted, so no figure.' : 'No scored duties.'}
          </div>
        </div>
      </div>

      {/* One bar across all of the role's duties, split by what Hyphenate does with each. */}
      {p.n > 0 && (() => {
        const rest = p.n - p.C - p.A;
        const parts = [
          { key: 'covered', count: p.C, label: 'done end to end', bar: 'bg-success text-white', dot: 'bg-success' },
          { key: 'assisted', count: p.A, label: 'prepared for a person to approve', bar: 'bg-accent text-white', dot: 'bg-accent' },
          { key: 'rest', count: rest, label: 'not on Hyphenate’s site', bar: 'bg-bg text-ink-muted', dot: 'bg-bg ring-1 ring-line' },
        ];
        return (
          <div className="card p-5 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="t-card">What Hyphenate can do in this role</p>
              <Mono>{p.n} duties in total</Mono>
            </div>
            <div className="mt-4 flex h-11 gap-[3px] overflow-hidden rounded-md ring-1 ring-line" role="img"
              aria-label={`${p.C} of ${p.n} duties done end to end, ${p.A} prepared for approval, ${rest} not on Hyphenate's site`}>
              {parts.filter((x) => x.count > 0).map((x) => (
                <div key={x.key} className={`flex min-w-[2.25rem] items-center justify-center font-mono text-[13px] font-medium ${x.bar}`} style={{ flexGrow: x.count, flexBasis: 0 }}>
                  {x.count}
                </div>
              ))}
            </div>
            <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {parts.map((x) => (
                <li key={x.key} className="flex items-start gap-2.5">
                  <span className={`mt-1 h-3 w-3 shrink-0 rounded-sm ${x.dot}`} />
                  <span className="text-[14px] leading-snug">
                    <b className="num font-medium text-ink-display">{x.count} of {p.n}</b> {x.label}
                    <span className="block text-[12.5px] text-ink-muted">{x.key === 'covered' ? 'Green highlight in the posting' : x.key === 'assisted' ? 'Orange highlight in the posting' : 'Dotted underline in the posting'}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })()}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Original text */}
        <div className="card min-w-0 p-5 sm:p-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <Mono>Original posting<span className="lg:hidden"> · tap a highlight</span></Mono>
            <a href={p.source_url} target="_blank" rel="noreferrer" className="link text-[13px]">View on {p.ats === 'greenhouse' ? 'Greenhouse' : p.ats === 'lever' ? 'Lever' : p.ats === 'ashby' ? 'Ashby' : 'source'} ↗</a>
          </div>
          <div className="whitespace-pre-wrap break-words text-[15px] leading-[1.75] text-ink/90">
            {segs.map((s, k) => s.duty === null ? <span key={k}>{s.text}</span> : (
              <span key={k} id={`span-${s.duty}`} className={`${hlClass(p.duties[s.duty])} ${active === s.duty ? 'hl-active' : ''}`}
                onMouseEnter={() => setHover(s.duty)} onMouseLeave={() => setHover(null)} onClick={() => pick(s.duty!)}
                title={p.duties[s.duty].scored ? `${p.duties[s.duty].label}${p.duties[s.duty].capability ? ` · ${p.duties[s.duty].capability}` : ''}` : undefined}>
                {s.text}
              </span>
            ))}
          </div>
          {p.extra_salary_lines?.length > 0 && (
            <div className="mt-6 border-t border-line pt-4 text-[13px] text-ink-muted">
              <Mono>Pay on other location postings of this role</Mono>
              <ul className="mt-2 space-y-1">{p.extra_salary_lines.map((s, i) => <li key={i}>{s.location}: {s.line}</li>)}</ul>
            </div>
          )}
        </div>

        {/* Side panel */}
        <aside className="space-y-4 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto">
          <div className="rounded-[var(--radius-card)] border border-line bg-surface-tint px-5 py-3">
            <Mono>Role</Mono>
            <p className="text-[15px] font-medium leading-snug">{p.title}</p>
            <Mono className="mt-2 block">Company</Mono>
            <p className="text-[15px] leading-snug">{!p.slug ? p.company : <Link href={`/companies/${p.slug}`} className="link">{p.company}</Link>}</p>
          </div>
          <div className="card p-5 lg:min-h-[300px]">
            {ad ? <DutyDetail d={ad} /> : <p className="text-[14px] text-ink-muted">Hover over a highlight in the posting, or click a duty in the list below, to see its label, capability and rationale.</p>}
          </div>

          <div className="card-flat p-2">
            <div className="px-3 pb-1 pt-2"><Mono>{scored.length} scored duties</Mono></div>
            <ul>
              {scored.map(({ d, i }) => (
                <li key={d.duty_id}>
                  <button onClick={() => focus(i)}
                    className={`flex w-full items-start gap-2 rounded-md border-l-[3px] px-3 py-2 text-left text-[13.5px] transition-colors ${selected === i ? 'border-accent bg-surface-tint text-accent-ink' : 'border-transparent hover:bg-bg'}`}>
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${d.label === 'covered' ? 'bg-success' : d.label === 'assisted' ? 'bg-accent' : 'border border-ink-muted'}`} />
                    <span className="min-w-0 flex-1">{d.text}{!d.span && <span className="ml-1 text-[11px] text-ink-muted">(span not found)</span>}</span>
                  </button>
                </li>
              ))}
            </ul>
            {other.length > 0 && (
              <details className="px-3 pb-3 pt-1">
                <summary className="t-mono cursor-pointer py-1">{other.length} requirements and boilerplate lines (not scored)</summary>
                <ul className="mt-1 space-y-1">{other.map(({ d, i }) => <li key={d.duty_id}><button onClick={() => focus(i)} className="text-left text-[13px] text-ink-muted hover:text-ink">{d.text}</button></li>)}</ul>
              </details>
            )}
          </div>

          <div className="card-flat space-y-3 p-5 text-[13.5px]">
            <Mono>Extracted fields</Mono>
            <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5">
              <dt className="text-ink-muted">Role family</dt><dd>{ROLE_LABELS[p.role_family] ?? p.role_family} · {p.seniority}</dd>
              <dt className="text-ink-muted">Locations</dt><dd>{p.locations.join('; ') || '–'} · {p.remote}</dd>
              <dt className="text-ink-muted">ERP</dt><dd>{p.erp.join(', ') || 'Not stated'}</dd>
              <dt className="text-ink-muted">Tools</dt><dd>{p.tools.join(', ') || '–'}</dd>
              <dt className="text-ink-muted">Complexity</dt><dd>{Object.entries(p.complexity ?? {}).filter(([k, v]) => v === true && k !== 'entity_count').map(([k]) => k.replace(/_/g, ' ')).join(', ') || 'None stated'}{p.complexity?.entity_count ? ` · ${p.complexity.entity_count} entities` : ''}</dd>
              <dt className="text-ink-muted">Lead product</dt><dd>{p.lead_product ?? '–'}</dd>
              <><dt className="text-ink-muted">Posted</dt><dd>{shortDate(p.posted_at)}</dd><dt className="text-ink-muted">Fetched</dt><dd>{shortDate(p.fetched_at)}</dd></>
            </dl>
            {p.pain_phrases?.length > 0 && <div><Mono>Pain phrases</Mono><ul className="mt-1 flex flex-wrap gap-1.5">{p.pain_phrases.map((x) => <li key={x} className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[12.5px] text-accent-ink">{x}</li>)}</ul></div>}
          </div>
          {p.thin && <p className="text-[13px] text-ink-muted">Thin posting: fewer than 4 scored duties. It is scored but excluded from savings.</p>}
        </aside>
      </div>

      {/* Bottom sheet for phones */}
      <div role="dialog" aria-label="Duty details" aria-hidden={sheet === null} inert={sheet === null}
        className={`fixed inset-x-0 bottom-0 z-50 max-h-[62vh] overflow-y-auto rounded-t-2xl border-t border-line bg-surface px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_40px_rgba(120,60,20,0.18)] transition-transform duration-300 ease-out motion-reduce:transition-none lg:hidden ${sheet !== null ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="sticky top-0 -mx-5 mb-2 flex items-center justify-between bg-surface px-5 pb-2">
          <span className="mx-auto h-1 w-10 rounded-full bg-line" aria-hidden />
        </div>
        <button onClick={() => setSheet(null)} className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-md border border-line text-ink-muted" aria-label="Close duty details">
          <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4"><path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </button>
        <div className="pr-10">{sd && <DutyDetail d={sd} />}</div>
      </div>
    </div>
  );
}

function DutyDetail({ d }: { d: DutyView }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2"><LabelChip label={d.scored ? d.label : null} />{d.confidence !== null && <Mono>Confidence {d.confidence.toFixed(2)}</Mono>}</div>
      <p className="t-card">{d.text}</p>
      {d.scored ? (
        <>
          {d.capability && <div><Mono>Capability</Mono><p className="mt-1 text-[14px]"><span className="font-mono text-[12px] text-ink-muted">{d.capability_id}</span><br />{d.product}: {d.capability}</p></div>}
          {d.rationale && <div><Mono>Rationale</Mono><p className="mt-1 text-[14px] text-ink/85">{d.rationale}</p></div>}
          {d.adjusted && <p className="text-[12.5px] text-ink-muted">Model said <b className="font-medium">{d.model_label}</b>; adjusted by rule: {d.adjusted}.</p>}
          {d.gap_theme && <p className="text-[13px]">Gap theme: <Link href={`/gaps#${d.gap_theme.theme_id}`} className="link">{d.gap_theme.name}</Link></p>}
        </>
      ) : <p className="text-[13px] text-ink-muted">{d.is_requirement ? 'A qualification, not a task. Excluded from scoring.' : 'Boilerplate. Excluded from scoring.'}</p>}
      <div><Mono>Source span</Mono><p className="mt-1 text-[13px] italic text-ink/75">&ldquo;{d.source_span}&rdquo;</p></div>
    </div>
  );
}
