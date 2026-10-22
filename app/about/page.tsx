import type { Metadata } from 'next';
import Link from 'next/link';
import { Mono, PageHero, Section } from '@/components/ui';
import { getMeta } from '@/lib/data';
import { AUTHOR_EMAIL, AUTHOR_GITHUB, AUTHOR_LINKEDIN, AUTHOR_NAME, AUTHOR_WEBSITE, PRODUCT_NAME, ROLE_APPLIED_FOR, ROLE_URL } from '@/config/site';

export const metadata: Metadata = { title: 'About' };

const strip = (u: string) => u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

export default function AboutPage() {
  const h = getMeta()?.headlines;
  const contacts = [
    AUTHOR_EMAIL && { label: 'Email', value: AUTHOR_EMAIL, href: `mailto:${AUTHOR_EMAIL}` },
    AUTHOR_LINKEDIN && { label: 'LinkedIn', value: strip(AUTHOR_LINKEDIN), href: AUTHOR_LINKEDIN },
    AUTHOR_GITHUB && { label: 'GitHub', value: strip(AUTHOR_GITHUB), href: AUTHOR_GITHUB },
    AUTHOR_WEBSITE && { label: 'Website', value: strip(AUTHOR_WEBSITE), href: AUTHOR_WEBSITE },
  ].filter(Boolean) as { label: string; value: string; href: string }[];

  return (
    <div className="theme-inverted">
      <PageHero
        eyebrow="About"
        title={<>I&apos;m {AUTHOR_NAME}, and I&apos;d like to join Hyphenate as a {ROLE_APPLIED_FOR}.</>}
        sub={<>{PRODUCT_NAME} is the demo I built for that application. Instead of only saying how I would help, I tried to do a slice of the job.</>}
      >
        <div className="flex flex-wrap gap-3 pt-2">
          <a href={ROLE_URL} target="_blank" rel="noreferrer" className="btn-primary">View the role ↗</a>
          {AUTHOR_EMAIL && <a href={`mailto:${AUTHOR_EMAIL}`} className="btn-secondary">Email me</a>}
        </div>
      </PageHero>

      <Section eyebrow="Why I built it" title="A finance job posting is a buying signal.">
        <div className="max-w-[760px] space-y-4 text-[17px] leading-relaxed text-ink/90">
          <p>A company hiring an accounts payable clerk or a staff accountant is about to spend money on work Hyphenate&apos;s agents already do.</p>
          <p>
            I read {h ? `${h.postings} open finance roles from ${h.companies} US companies` : 'open finance roles'}, duty by duty, and matched each duty against Hyphenate&apos;s public product pages.
            The result is a ranked lead list for sales, a gap list for product, and the salary tied to work Hyphenate could take on. <Link href="/method" className="link">How it works</Link>.
          </p>
        </div>
      </Section>

      <Section eyebrow="Contact" title="I would love to talk about the role.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {contacts.map((c) => (
            <a key={c.label} href={c.href} target={c.href.startsWith('mailto:') ? undefined : '_blank'} rel="noreferrer" className="card block p-5 transition-transform hover:-translate-y-0.5">
              <Mono>{c.label}</Mono>
              <p className="mt-2 break-all text-[17px] text-ink-display">{c.value}</p>
            </a>
          ))}
        </div>
        <p className="mt-6 max-w-[720px] text-[14px] text-ink-muted">Independent prototype, not affiliated with or endorsed by Hyphenate.</p>
      </Section>
    </div>
  );
}
