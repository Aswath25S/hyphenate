'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

/**
 * "← Back" that restores the previous view (filters, sort, scroll) when the
 * visitor came from `href`, and otherwise just links to it.
 */
export function BackLink({ href, label }: { href: string; label: string }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      onClick={(e) => {
        try {
          const ref = document.referrer ? new URL(document.referrer) : null;
          if (ref && ref.origin === location.origin && ref.pathname === href && window.history.length > 1) {
            e.preventDefault();
            router.back();
          }
        } catch { /* fall through to the plain link */ }
      }}
      className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-3 py-1.5 text-[13.5px] text-ink hover:border-brand hover:text-brand"
    >
      <span aria-hidden>←</span> {label}
    </Link>
  );
}
