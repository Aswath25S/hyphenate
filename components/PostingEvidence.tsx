'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { DutyView, PostingDetail } from '@/lib/app-types';
import { ROLE_LABELS, pct, shortDate, usd } from '@/lib/format';
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

export function PostingEvidence({ p, live = false }: { p: PostingDetail; live?: boolean }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const segs = useMemo(() => segments(p.text, p.duties), [p.text, p.duties]);
  const scored = p.duties.map((d, i) => ({ d, i })).filter((x) => x.d.scored);
  const other = p.duties.map((d, i) => ({ d, i })).filter((x) => !x.d.scored);
  const active = hover ?? selected;
  const ad = active !== null ? p.duties[active] : null;
  const focus = (i: number) => {
    setSelected(i);
    document.getElementById(`span-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="space-y-8">
      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="card p-5">
          <div className="num text-[44px] leading-none tracking-[-0.03em] text-ink-display">{p.n ? pct(p.overlap) : '–'}</div>
          <div className="t-mono mt-2">Overlap</div>
          <div className="mt-2 text-[13px] text-ink-muted">{p.C} covered + {p.A} assisted of {p.n} scored duties</div>
        </div>
        <div className="card p-5">
          <div className="num text-[44px] leading-none tracking-[-0.03em] text-ink-display">{p.n ? pct(p.covered_share) : '–'}</div>
          <div className="t-mono mt-2">Covered share</div>
          <div className="mt-2 text-[13px] text-ink-muted">Fully covered duties only; used for savings</div>
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
              ? <>{usd(p.salary_min)} × {p.C}/{p.n} × 0.5. Work Hyphenate could absorb before the next hire.</>
              : p.savings_reason === 'thin_posting' ? 'Thin posting (fewer than 4 scored duties): excluded.' : p.savings_reason === 'no_salary' ? 'No salary posted, so no figure.' : 'No scored duties.'}
          </div>
        </div>
      </div>

      {/* Comparison bars */}
      {p.n > 0 && (
        <div className="hatch rounded-[var(--radius-card)] border border-line p-4 sm:p-5">
          <div className="space-y-2.5">
            <div className="relative h-10 overflow-hidden rounded-md border border-line bg-white">
              <div className="flex h-full items-center px-3 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">All scored duties: {p.n}</div>
            </div>
            <div className="relative h-10 rounded-md">
              <div className="absolute inset-y-0 left-0 flex items-center rounded-md border border-accent bg-accent-soft px-3" style={{ width: `min(100%, max(${(p.overlap * 100).toFixed(1)}%, 17.5rem))` }}>
                <span className="truncate whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.08em] text-accent-ink">Hyphenate covers: {p.C} of {p.n} duties<span className="hidden sm:inline">{p.A ? ` (+${p.A} assisted)` : ''}</span></span>
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-ink-muted">
            <span><span className="hl hl-covered px-1">covered</span> agent does it end to end</span>
            <span><span className="hl hl-assisted px-1">assisted</span> agent prepares, a person approves</span>
            <span><span className="hl hl-human">human / gap / unclear</span> not counted</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Original text */}
        <div className="card min-w-0 p-5 sm:p-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <Mono>Original posting</Mono>
            {!live && <a href={p.source_url} target="_blank" rel="noreferrer" className="link text-[13px]">View on {p.ats === 'greenhouse' ? 'Greenhouse' : p.ats === 'lever' ? 'Lever' : p.ats === 'ashby' ? 'Ashby' : 'source'} ↗</a>}
          </div>
          <div className="whitespace-pre-wrap break-words text-[15px] leading-[1.75] text-ink/90">
            {segs.map((s, k) => s.duty === null ? <span key={k}>{s.text}</span> : (
              <span key={k} id={`span-${s.duty}`} className={`${hlClass(p.duties[s.duty])} ${active === s.duty ? 'hl-active' : ''}`}
                onMouseEnter={() => setHover(s.duty)} onMouseLeave={() => setHover(null)} onClick={() => setSelected(s.duty)}
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
          <div className="card p-5 lg:min-h-[300px]">
            {ad ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2"><LabelChip label={ad.scored ? ad.label : null} />{ad.confidence !== null && <Mono>Confidence {ad.confidence.toFixed(2)}</Mono>}</div>
                <p className="t-card">{ad.text}</p>
                {ad.scored ? (
                  <>
                    {ad.capability && <div><Mono>Capability</Mono><p className="mt-1 text-[14px]"><span className="font-mono text-[12px] text-ink-muted">{ad.capability_id}</span><br />{ad.product}: {ad.capability}</p></div>}
                    {ad.rationale && <div><Mono>Rationale</Mono><p className="mt-1 text-[14px] text-ink/85">{ad.rationale}</p></div>}
                    {ad.adjusted && <p className="text-[12.5px] text-ink-muted">Model said <b className="font-medium">{ad.model_label}</b>; adjusted by rule: {ad.adjusted}.</p>}
                    {ad.gap_theme && <p className="text-[13px]">Gap theme: <Link href={`/gaps#${ad.gap_theme.theme_id}`} className="link">{ad.gap_theme.name}</Link></p>}
                  </>
                ) : <p className="text-[13px] text-ink-muted">{ad.is_requirement ? 'A qualification, not a task. Excluded from scoring.' : 'Boilerplate. Excluded from scoring.'}</p>}
                <div><Mono>Source span</Mono><p className="mt-1 text-[13px] italic text-ink/75">&ldquo;{ad.source_span}&rdquo;</p></div>
              </div>
            ) : <p className="text-[14px] text-ink-muted">Hover over a highlight in the posting, or click a duty in the list below, to see its label, capability and rationale.</p>}
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
              {!live && <><dt className="text-ink-muted">Posted</dt><dd>{shortDate(p.posted_at)}</dd><dt className="text-ink-muted">Fetched</dt><dd>{shortDate(p.fetched_at)}</dd></>}
            </dl>
            {p.pain_phrases?.length > 0 && <div><Mono>Pain phrases</Mono><ul className="mt-1 flex flex-wrap gap-1.5">{p.pain_phrases.map((x) => <li key={x} className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[12.5px] text-accent-ink">{x}</li>)}</ul></div>}
          </div>
          {p.thin && <p className="text-[13px] text-ink-muted">Thin posting: fewer than 4 scored duties. It is scored but excluded from savings.</p>}
        </aside>
      </div>
    </div>
  );
}
