import type { ReactNode } from 'react';

/** A variable, set in italic serif like a written formula. */
export function V({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <span className="font-serif italic">
      {children}
      {sub !== undefined && <sub className="not-italic text-[0.65em]">{sub}</sub>}
    </span>
  );
}

/** Stacked fraction. */
export function Frac({ num, den }: { num: ReactNode; den: ReactNode }) {
  return (
    <span className="mx-0.5 inline-flex flex-col items-center align-middle text-[0.92em] leading-tight">
      <span className="px-1">{num}</span>
      <span className="w-full border-t border-current px-1">{den}</span>
    </span>
  );
}

/** A displayed equation with an optional list of variable definitions. */
export function Formula({ title, children, where }: { title: string; children: ReactNode; where?: [ReactNode, ReactNode][] }) {
  return (
    <div className="card p-5 sm:p-6">
      <p className="t-mono">{title}</p>
      <div className="my-4 overflow-x-auto rounded-lg bg-bg px-4 py-4 text-center text-[19px] leading-loose text-ink-display">{children}</div>
      {where && (
        <dl className="space-y-1.5 text-[14px]">
          {where.map(([k, v], i) => (
            <div key={i} className="grid grid-cols-[4.5rem_1fr] gap-3">
              <dt className="text-right text-[16px] text-ink-display">{k}</dt>
              <dd className="text-ink/80">{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
