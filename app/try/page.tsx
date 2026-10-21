import type { Metadata } from 'next';
import fs from 'node:fs';
import path from 'node:path';
import { Container, PageHero } from '@/components/ui';
import { TryView, type Sample } from '@/components/TryView';

export const metadata: Metadata = { title: 'Try it live' };
export const dynamic = 'force-dynamic';

function samples(): Sample[] {
  const pick = [['amplitude-billing-collections', 'AR analyst'], ['liquid-death-accounting-clerk', 'AP clerk']];
  return pick.flatMap(([file, label]) => {
    const p = path.join(process.cwd(), 'tests', 'fixtures', `${file}.json`);
    if (!fs.existsSync(p)) return [];
    const fx = JSON.parse(fs.readFileSync(p, 'utf8'));
    return [{ label, company: fx.input.company, title: fx.input.title, text: fx.input.text.slice(0, 20000) }];
  });
}

export default function TryPage() {
  const enabled = (process.env.LIVE_DEMO_ENABLED ?? 'true') !== 'false' && Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  return (
    <>
      <PageHero eyebrow="Try it live" title="Paste any finance job posting. See it split, matched and priced." sub="The same engine that built this dashboard runs on your posting: Claude splits it into single duties, labels each against Hyphenate's public capabilities, and code prices the covered work." />
      <section className="hatch border-b border-line py-10 sm:py-14"><Container><TryView samples={samples()} enabled={enabled} /></Container></section>
    </>
  );
}
