import Link from 'next/link';

/** Own wordmark, set in the display face. Not Hyphenate's mark. */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex items-baseline gap-2 text-ink-display ${className}`} aria-label="Before the Next Hire, home">
      <span aria-hidden className="inline-block h-[10px] w-[10px] translate-y-[-1px] rounded-[2px] bg-accent" />
      <span className="text-[17px] tracking-[-0.02em] whitespace-nowrap">Before the Next Hire</span>
    </Link>
  );
}
