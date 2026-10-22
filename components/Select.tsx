'use client';
import { useEffect, useId, useRef, useState } from 'react';

/**
 * Dropdown that always opens below its button (native selects on macOS open
 * on top of the chosen option). Keyboard: arrows, Enter, Escape, Home/End.
 */
export function Select({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: [string, string][]; // [value, label]; '' = All
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  const all: [string, string][] = [['', 'All'], ...options];
  const current = all.find(([v]) => v === value)?.[1] ?? 'All';

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const openList = () => { setActive(Math.max(0, all.findIndex(([v]) => v === value))); setOpen(true); };
  const choose = (i: number) => { onChange(all[i][0]); setOpen(false); };
  const onKey = (e: React.KeyboardEvent) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openList(); return; }
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(all.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(all.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(active); }
    else if (e.key === 'Tab') setOpen(false);
  };

  return (
    <div ref={root} className="relative flex min-w-0 flex-col gap-1">
      <span className="t-mono">{label}</span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${label}: ${current}`}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKey}
        className={`flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-md border bg-surface px-3 py-2 text-left text-[14px] transition-colors ${open ? 'border-accent' : 'border-line hover:border-ink-muted'} ${value ? 'text-ink' : 'text-ink/80'}`}
      >
        <span className="truncate">{current}</span>
        <svg aria-hidden viewBox="0 0 16 16" className={`h-3.5 w-3.5 shrink-0 text-ink-muted transition-transform ${open ? 'rotate-180' : ''}`}><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && (
        <ul id={listId} role="listbox" aria-label={label}
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-md border border-line bg-surface p-1 shadow-[0_12px_32px_rgba(120,60,20,0.14)]">
          {all.map(([v, l], i) => {
            const selected = v === value;
            return (
              <li key={v || 'all'} role="option" aria-selected={selected}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => { e.preventDefault(); choose(i); }}
                className={`flex cursor-pointer items-center justify-between gap-2 rounded px-2.5 py-2 text-[14px] ${i === active ? 'bg-surface-tint' : ''} ${selected ? 'font-medium text-accent-ink' : 'text-ink'}`}>
                <span className="truncate">{l}</span>
                {selected && <svg aria-hidden viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
