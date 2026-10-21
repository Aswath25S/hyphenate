import Link from 'next/link';
import type { ReactNode } from 'react';

export function Container({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[var(--container)] px-4 sm:px-8 ${className}`}>{children}</div>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="pill">{children}</span>;
}

export function Mono({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`t-mono ${className}`}>{children}</span>;
}

/** Page opener: eyebrow pill + a headline that states a finding. */
export function PageHero({ eyebrow, title, sub, meta, children }: { eyebrow: string; title: ReactNode; sub?: ReactNode; meta?: ReactNode; children?: ReactNode }) {
  return (
    <section className="relative overflow-hidden border-b border-line">
      <div aria-hidden className="hero-lines pointer-events-none absolute inset-0" />
      <div aria-hidden className="pointer-events-none absolute right-[12%] top-[22%] hidden h-px w-10 bg-accent/60 lg:block" />
      <Container className="relative pb-14 pt-16 sm:pb-20 sm:pt-24">
        <div className="max-w-[1100px] space-y-6">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="t-hero">{title}</h1>
          {sub && <p className="max-w-[720px] text-[17px] leading-relaxed text-ink/80">{sub}</p>}
          {meta && <div className="t-mono">{meta}</div>}
          {children}
        </div>
      </Container>
    </section>
  );
}

export function StatBlock({ value, label, href, note }: { value: ReactNode; label: string; href?: string; note?: ReactNode }) {
  const body = (
    <>
      <div className="num text-[40px] leading-none tracking-[-0.03em] text-ink-display [overflow-wrap:anywhere] sm:text-[56px]">{value}</div>
      <div className="t-mono mt-3">{label}</div>
      {note && <div className="mt-2 text-[13px] text-ink-muted">{note}</div>}
    </>
  );
  return href ? (
    <Link href={href} className="card group block min-w-0 p-5 sm:p-6 transition-transform hover:-translate-y-0.5">{body}</Link>
  ) : (
    <div className="card min-w-0 p-5 sm:p-6">{body}</div>
  );
}

export function Section({ eyebrow, title, children, action, id }: { eyebrow?: string; title?: ReactNode; children: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <section id={id} className="border-b border-line py-16 sm:py-24">
      <Container>
        {(eyebrow || title) && (
          <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-[900px] space-y-4">
              {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
              {title && <h2 className="t-section">{title}</h2>}
            </div>
            {action}
          </div>
        )}
        {children}
      </Container>
    </section>
  );
}

export function EmptyState({ title = 'No pipeline data yet.', children }: { title?: string; children?: ReactNode }) {
  return (
    <div className="hatch rounded-[var(--radius-section)] border border-line p-8 sm:p-12">
      <div className="card max-w-[640px] p-6 sm:p-8">
        <p className="t-sub">{title}</p>
        <div className="mt-3 space-y-2 text-ink/80">
          {children ?? (
            <>
              <p>The dashboard reads files the pipeline writes to <code className="font-mono text-[14px]">data/app/</code>.</p>
              <pre className="mt-3 overflow-x-auto rounded-lg bg-bg p-3 font-mono text-[13px]">npm run pipeline</pre>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function StatusChip({ children, tone = 'muted', live = false }: { children: ReactNode; tone?: 'muted' | 'accent' | 'success'; live?: boolean }) {
  const dot = tone === 'accent' ? 'bg-accent' : tone === 'success' ? 'bg-success' : 'bg-ink-muted';
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-ink">
      <span className={`h-1.5 w-1.5 rounded-full ${dot} ${live ? 'dot-live' : ''}`} />
      {children}
    </span>
  );
}

export function LabelChip({ label }: { label: string | null }) {
  const map: Record<string, { cls: string; text: string }> = {
    covered: { cls: 'bg-success-soft text-success-ink border-success/30', text: 'Hyphenate does it' },
    assisted: { cls: 'bg-accent-soft text-accent-ink border-accent/30', text: 'Hyphenate prepares' },
    human: { cls: 'bg-bg text-ink-muted border-line', text: 'Needs a person' },
    gap_candidate: { cls: 'bg-bg text-ink-muted border-line border-dashed', text: 'Possible gap' },
    unclear: { cls: 'bg-bg text-ink-muted border-line italic', text: 'Too vague' },
  };
  const m = label ? map[label] : null;
  if (!m) return <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">Not scored</span>;
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.08em] ${m.cls}`}>{m.text}</span>;
}

/** Thin horizontal bar: covered (green) + assisted (orange) shares. */
export function OverlapBar({ covered, assisted, className = '' }: { covered: number; assisted: number; className?: string }) {
  return (
    <div className={`flex h-2 w-full overflow-hidden rounded-full bg-bg ring-1 ring-line ${className}`} aria-hidden>
      <div className="bg-success" style={{ width: `${covered * 100}%` }} />
      <div className="bg-accent/70" style={{ width: `${assisted * 100}%` }} />
    </div>
  );
}

/** Explains the green / orange colours used in every overlap bar. */
export function OverlapLegend({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px] text-ink/80 ${className}`}>
      <span className="inline-flex items-center gap-2"><span className="h-2.5 w-5 rounded-sm bg-success" />Hyphenate does it end to end</span>
      <span className="inline-flex items-center gap-2"><span className="h-2.5 w-5 rounded-sm bg-accent/70" />Hyphenate prepares it, a person approves</span>
      <span className="inline-flex items-center gap-2"><span className="h-2.5 w-5 rounded-sm bg-bg ring-1 ring-line" />Not on Hyphenate&apos;s site</span>
    </div>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="text-[13px] leading-relaxed text-ink-muted">{children}</p>;
}
