'use client';
import { useRef, useState } from 'react';
import type { PostingDetail } from '@/lib/app-types';
import { LIVE_DEMO } from '@/config/scoring';
import { PostingEvidence } from './PostingEvidence';
import { StatusChip } from './ui';

const STEPS = [
  { key: 'reading', label: 'Reading posting' },
  { key: 'splitting', label: 'Splitting duties' },
  { key: 'matching', label: 'Matching to products' },
  { key: 'pricing', label: 'Pricing' },
] as const;

export type Sample = { label: string; company: string; title: string; text: string };

export function TryView({ samples, enabled }: { samples: Sample[]; enabled: boolean }) {
  const [text, setText] = useState('');
  const [company, setCompany] = useState('');
  const [title, setTitle] = useState('');
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PostingDetail | null>(null);
  const [ms, setMs] = useState<number | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const busy = step !== null;
  const stepIdx = STEPS.findIndex((s) => s.key === step);

  async function run() {
    setError(null); setResult(null); setMs(null); setStep('reading');
    try {
      const res = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, company, title }) });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Request failed (${res.status}).`);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.step) setStep(ev.step);
          if (ev.error) throw new Error(ev.error);
          if (ev.result) { setResult(ev.result); setMs(ev.ms); setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 50); }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setStep(null);
    }
  }

  return (
    <div className="space-y-10">
      <div className="card p-5 sm:p-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 font-mono text-[12px] text-accent">
            {STEPS.map((s, i) => (
              <span key={s.key} className="flex items-center gap-3">
                <span className={i <= stepIdx || result ? 'text-accent' : 'text-ink-muted'}>{String(i + 1).padStart(2, '0')}</span>
                {i < STEPS.length - 1 && <span className={`h-px w-6 sm:w-10 ${i < stepIdx || result ? 'bg-accent' : 'bg-line'}`} />}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {samples.map((s) => (
              <button key={s.label} disabled={busy} onClick={() => { setText(s.text); setCompany(s.company); setTitle(s.title); setResult(null); setError(null); }} className="btn-secondary !py-1.5 !text-[13px]">Try an example: {s.label}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block"><span className="t-mono">Company (optional)</span>
            <input value={company} onChange={(e) => setCompany(e.target.value)} maxLength={120} className="mt-1 w-full rounded-md border border-line bg-bg-raised px-3 py-2 text-[15px]" placeholder="Acme" /></label>
          <label className="block"><span className="t-mono">Title (optional)</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className="mt-1 w-full rounded-md border border-line bg-bg-raised px-3 py-2 text-[15px]" placeholder="Accounts Receivable Specialist" /></label>
        </div>
        <label className="mt-3 block">
          <span className="flex justify-between"><span className="t-mono">Job posting</span><span className={`num font-mono text-[11px] ${text.length > LIVE_DEMO.maxChars ? 'text-brand' : 'text-ink-muted'}`}>{text.length.toLocaleString()} / {LIVE_DEMO.maxChars.toLocaleString()}</span></span>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={12} className="mt-1 w-full resize-y rounded-md border border-line bg-bg-raised px-3 py-3 font-mono text-[13px] leading-relaxed" placeholder="Paste any finance job posting: the responsibilities, requirements and pay." />
        </label>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button onClick={run} disabled={!enabled || busy || text.trim().length < 200 || text.length > LIVE_DEMO.maxChars} className="btn-primary">{busy ? 'Analysing…' : 'Analyse posting'}</button>
          {busy && STEPS.map((s, i) => <StatusChip key={s.key} tone={i < stepIdx ? 'success' : i === stepIdx ? 'accent' : 'muted'} live={i === stepIdx}>{s.label}</StatusChip>)}
          {!busy && ms !== null && <StatusChip tone="success">Done in {(ms / 1000).toFixed(1)}s</StatusChip>}
        </div>
        {!enabled && <p className="mt-3 text-[14px] text-brand">The live demo is not configured on this server.</p>}
        {error && <p role="alert" className="mt-3 rounded-md border border-brand/30 bg-surface-tint px-3 py-2 text-[14px] text-brand">{error}</p>}
        <p className="mt-4 text-[12.5px] text-ink-muted">Pasted text is sent to Claude for this one analysis and is never stored or logged. Limit: {LIVE_DEMO.perIpPerHour} analyses an hour.</p>
      </div>
      {result && (
        <div ref={resultRef} className="scroll-mt-24 space-y-6">
          <h2 className="t-section">{result.n === 0 ? 'No scorable duties found.' : `${result.C + result.A} of ${result.n} duties are work Hyphenate's agents advertise.`}</h2>
          <PostingEvidence p={result} live />
        </div>
      )}
    </div>
  );
}
