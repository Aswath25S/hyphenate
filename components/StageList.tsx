'use client';
import { useState } from 'react';

export type Stage = { key: string; name: string; summary: string; details: string[] };

/** Pipeline stages as rows that expand smoothly to explain each step. */
export function StageList({ stages }: { stages: Stage[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <ol className="card overflow-hidden">
      {stages.map((s, i) => {
        const isOpen = open === s.key;
        return (
          <li key={s.key} className={`border-t border-dashed border-line-dashed first:border-t-0 ${isOpen ? 'bg-surface-tint' : ''}`}>
            <button
              onClick={() => setOpen(isOpen ? null : s.key)}
              aria-expanded={isOpen}
              className="grid w-full grid-cols-[2.5rem_1fr_2rem] items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-surface-tint sm:grid-cols-[2.5rem_11rem_1fr_2rem]"
            >
              <span className="pt-0.5 font-mono text-[12px] text-accent">{String(i + 1).padStart(2, '0')}</span>
              <span className="text-[15px] font-medium">{s.name}</span>
              <span className="col-start-2 text-[14px] text-ink/80 sm:col-start-auto">{s.summary}</span>
              <span className="col-start-3 row-start-1 flex justify-end text-ink-muted sm:col-start-auto sm:row-start-auto">
                <svg aria-hidden viewBox="0 0 16 16" className={`h-4 w-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}><path d="M3.5 6l4.5 4.5L12.5 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
            </button>
            <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
              <div className="min-h-0 overflow-hidden">
                <div className="space-y-2 px-5 pb-5 sm:pl-[calc(2.5rem+11rem+2.75rem)] sm:pr-16" inert={!isOpen}>
                  {s.details.map((d, j) => <p key={j} className="text-[14px] leading-relaxed text-ink/85">{d}</p>)}
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
