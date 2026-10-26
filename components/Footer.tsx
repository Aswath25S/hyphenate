import { AUTHOR_NAME, COVERAGE_AS_OF, ROLE_APPLIED_FOR } from '@/config/site';
import { shortDate } from '@/lib/format';
import { Wordmark } from './Wordmark';

export function Footer({ asOf }: { asOf?: string | null }) {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto flex max-w-[var(--container)] flex-col gap-6 px-4 py-10 sm:px-8 md:flex-row md:items-end md:justify-between">
        <div className="space-y-3">
          <Wordmark />
          <p className="max-w-[640px] text-[14px] leading-relaxed text-ink-muted">
            Independent prototype by {AUTHOR_NAME}, built to express my interest in the {ROLE_APPLIED_FOR} role at Hyphenate. Not affiliated with or endorsed by Hyphenate.
            Coverage based on hyphenate.ai as of {COVERAGE_AS_OF}.
          </p>
        </div>
        <p className="t-mono">{asOf ? `Data as of ${shortDate(asOf)}` : 'No pipeline data yet'}</p>
      </div>
    </footer>
  );
}
