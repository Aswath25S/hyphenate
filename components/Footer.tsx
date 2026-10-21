import { AUTHOR_NAME, COVERAGE_AS_OF } from '@/config/site';
import { Wordmark } from './Wordmark';

export function Footer({ asOf }: { asOf?: string | null }) {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto flex max-w-[var(--container)] flex-col gap-6 px-4 py-10 sm:px-8 md:flex-row md:items-end md:justify-between">
        <div className="space-y-3">
          <Wordmark />
          <p className="max-w-[640px] text-[14px] leading-relaxed text-ink-muted">
            Independent prototype by {AUTHOR_NAME}, built to study Hyphenate&apos;s market. Not affiliated with or endorsed by Hyphenate.
            Coverage based on hyphenate.ai as of {COVERAGE_AS_OF}.
          </p>
        </div>
        <p className="t-mono">{asOf ? `Data as of ${asOf}` : 'No pipeline data yet'}</p>
      </div>
    </footer>
  );
}
