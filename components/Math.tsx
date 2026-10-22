import type { ReactNode } from 'react';

/** Stacked fraction, written in words. */
export function Frac({ num, den }: { num: ReactNode; den: ReactNode }) {
  return (
    <span className="mx-1 inline-flex flex-col items-center align-middle text-[0.86em] leading-snug">
      <span className="px-1.5 pb-0.5">{num}</span>
      <span className="w-full border-t border-current px-1.5 pt-0.5">{den}</span>
    </span>
  );
}

/** A formula card: what it means in a sentence, the formula in words, then a short note. */
export function Formula({ title, desc, children, note }: { title: string; desc: ReactNode; children: ReactNode; note?: ReactNode }) {
  return (
    <div className="card flex flex-col p-5 sm:p-6">
      <p className="t-card">{title}</p>
      <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink/80">{desc}</p>
      <div className="my-4 overflow-x-auto rounded-lg bg-bg px-4 py-4 text-center text-[16px] leading-loose text-ink-display">{children}</div>
      {note && <div className="mt-auto text-[13.5px] leading-relaxed text-ink-muted">{note}</div>}
    </div>
  );
}
