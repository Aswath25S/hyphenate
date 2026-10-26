import type { Metadata, Viewport } from 'next';
import { ViewTransition } from 'react';
import { Analytics } from '@vercel/analytics/next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { getMeta } from '@/lib/data';
import { PRODUCT_NAME } from '@/config/site';

export const metadata: Metadata = {
  title: { default: PRODUCT_NAME, template: `%s · ${PRODUCT_NAME}` },
  description: 'Independent prototype: which finance job duties could an AI finance platform absorb before a company makes its next hire?',
};

export const viewport: Viewport = { themeColor: '#F9F7F1' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const meta = getMeta();
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen overflow-x-hidden">
        <div aria-hidden className="pointer-events-none fixed inset-y-0 left-1/2 z-0 hidden w-full max-w-[var(--container)] -translate-x-1/2 border-x border-line/70 xl:block" />
        {meta?.mode === 'fixture_preview' && (
          <div className="relative z-50 bg-ink-display px-4 py-2 text-center text-[13px] text-white">
            Fixture preview: built from 10 hand-labelled postings, not the full pipeline run. Numbers are illustrative.
          </div>
        )}
        {/* Route changes cross-fade, nav and footer included, so the About page's colour inversion fades. */}
        <ViewTransition>
          <div className="relative z-10 pt-3">
            <Nav />
            <main>{children}</main>
            <Footer asOf={meta?.as_of} />
          </div>
        </ViewTransition>
        {/* Visit counts in the Vercel dashboard; cookieless, no personal data. */}
        <Analytics />
      </body>
    </html>
  );
}
