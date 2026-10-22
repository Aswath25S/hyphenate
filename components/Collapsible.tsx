'use client';
import { useState, type ReactNode } from 'react';

/** Section that opens and closes with a smooth height transition. */
export function Collapsible({ title, subtitle, children }: { title: ReactNode; subtitle?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="group flex w-full items-start justify-between gap-4 text-left">
        <span>
          <span className="t-sub">{title}</span>
          {subtitle && <span className="mt-1 block text-[14px] text-ink-muted">{subtitle}</span>}
        </span>
        <span className="mt-1.5 inline-flex shrink-0 items-center gap-2 rounded-md border border-line px-3 py-1.5 text-[13px] text-ink-muted transition-colors group-hover:border-brand group-hover:text-brand">
          {open ? 'Hide' : 'Show'}
          <svg aria-hidden viewBox="0 0 16 16" className={`h-3.5 w-3.5 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      </button>
      <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="min-h-0 overflow-hidden">
          <div className="pt-4" inert={!open}>{children}</div>
        </div>
      </div>
    </div>
  );
}
