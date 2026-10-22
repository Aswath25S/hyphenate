'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Wordmark } from './Wordmark';

const LINKS = [
  { href: '/', label: 'Overview' },
  { href: '/leads', label: 'Leads' },
  { href: '/gaps', label: 'Gaps' },
  { href: '/savings', label: 'Roles & Savings' },
  { href: '/method', label: 'Method' },
  { href: '/about', label: 'About' },
];

export function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === '/' ? path === '/' : path.startsWith(href) || (href === '/leads' && path.startsWith('/companies')) || (href === '/savings' && path.startsWith('/postings')));
  return (
    <header className="sticky top-3 z-40 px-4 sm:px-6">
      <nav className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 rounded-[10px] border border-line bg-surface/95 px-4 py-2.5 shadow-[0_8px_30px_rgba(120,60,20,0.07)] backdrop-blur">
        <Wordmark />
        <ul className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className={`rounded-md px-3 py-1.5 text-[14px] transition-colors ${active(l.href) ? 'bg-surface-tint text-accent-ink' : 'text-ink hover:text-brand'}`} aria-current={active(l.href) ? 'page' : undefined}>
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2">
          <button className="rounded-md border border-line px-2.5 py-2 text-[13px] md:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Menu">
            {open ? 'Close' : 'Menu'}
          </button>
        </div>
      </nav>
      {open && (
        <ul className="mx-auto mt-2 max-w-[1180px] rounded-[10px] border border-line bg-surface p-2 shadow-[0_8px_30px_rgba(120,60,20,0.07)] md:hidden">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} onClick={() => setOpen(false)} className={`block rounded-md px-3 py-2 text-[15px] ${active(l.href) ? 'border-l-[3px] border-accent bg-surface-tint text-accent-ink' : ''}`}>{l.label}</Link>
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}
