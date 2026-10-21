import type { Metadata } from 'next';
import Link from 'next/link';
import { Container, Mono, PageHero, Section } from '@/components/ui';
import { getMeta } from '@/lib/data';
import { AUTHOR_EMAIL, AUTHOR_GITHUB, AUTHOR_LINKEDIN, AUTHOR_NAME, PRODUCT_NAME, ROLE_APPLIED_FOR } from '@/config/site';

export const metadata: Metadata = { title: 'About' };

export default function AboutPage() {
  const h = getMeta()?.headlines;
  const contacts = [
    AUTHOR_EMAIL && { label: 'Email', value: AUTHOR_EMAIL, href: `mailto:${AUTHOR_EMAIL}` },
    AUTHOR_LINKEDIN && { label: 'LinkedIn', value: AUTHOR_LINKEDIN.replace(/^https?:\/\/(www\.)?/, ''), href: AUTHOR_LINKEDIN },
    AUTHOR_GITHUB && { label: 'GitHub', value: AUTHOR_GITHUB.replace(/^https?:\/\/(www\.)?/, ''), href: AUTHOR_GITHUB },
  ].filter(Boolean) as { label: string; value: string; href: string }[];

  return (
    <>
      <PageHero
        eyebrow="About"
        title={<>Built by {AUTHOR_NAME} to find Hyphenate&apos;s next customers.</>}
        sub={<>{PRODUCT_NAME} is an independent project I made while applying for the {ROLE_APPLIED_FOR} role at Hyphenate. Instead of telling you how I would help, I tried to do a slice of the job.</>}
      />

      <Section eyebrow="Why I built it" title="Job postings are a buying signal hiding in plain sight.">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-4 text-[17px] leading-relaxed text-ink/85">
            <p>When a company posts a job for an accounts payable clerk or a staff accountant, it is announcing that it is about to spend money on work Hyphenate&apos;s agents already do. Company news, such as a funding round or a new CFO, explains why now.</p>
            <p>I wanted to know how often that is true, which companies it is true for, and what those postings ask for that Hyphenate does not yet advertise. So I read {h ? `${h.postings} open finance postings from ${h.companies} US companies` : 'open finance job postings'}, duty by duty, and matched every duty against Hyphenate&apos;s public product pages.</p>
            <p>The result is a ranked lead list for sales, a gap report for product, and a conservative estimate of the salary tied to work Hyphenate could take on. Every number links back to the posting text that produced it, so you can check my work.</p>
          </div>
          <div className="card space-y-4 p-6">
            <Mono>What went into it</Mono>
            <ul className="space-y-3 text-[15px] leading-relaxed">
              <li><b className="font-medium">Data pipeline.</b> Nine stages that collect public job-board postings, filter them, split duties with an LLM, and score them in plain code.</li>
              <li><b className="font-medium">Coverage map.</b> 30 capabilities read from hyphenate.ai, each with near misses so the model does not over-claim.</li>
              <li><b className="font-medium">Honesty rules.</b> No salary means no figure, gaps are &ldquo;not on the public site&rdquo; rather than &ldquo;cannot do&rdquo;, and every assumption is adjustable.</li>
              <li><b className="font-medium">Checks.</b> Hand-labelled test postings, schema validation on every model answer, and a fact check on every written brief.</li>
            </ul>
            <Link href="/method" className="link inline-block text-[14px]">Read the full method</Link>
          </div>
        </div>
      </Section>

      <Section eyebrow="Contact" title="I would love to talk.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {contacts.map((c) => (
            <a key={c.label} href={c.href} target={c.href.startsWith('mailto:') ? undefined : '_blank'} rel="noreferrer" className="card block p-5 transition-transform hover:-translate-y-0.5">
              <Mono>{c.label}</Mono>
              <p className="mt-2 break-all text-[17px] text-ink-display">{c.value}</p>
            </a>
          ))}
        </div>
        <p className="mt-6 max-w-[720px] text-[14px] text-ink-muted">This is an independent prototype. It is not affiliated with or endorsed by Hyphenate, and the coverage map is my reading of hyphenate.ai, to be validated with the team.</p>
      </Section>
    </>
  );
}
