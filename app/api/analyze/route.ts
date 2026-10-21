import { analyzePosting } from '@/lib/live';
import { checkLimits } from '@/lib/ratelimit';
import { LIVE_DEMO } from '@/config/scoring';
import { hasCredentials } from '@/pipeline/lib/llm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST { text, company?, title? } → NDJSON stream of {step} events then {result} or {error}.
 * The pasted text is never stored, cached or logged.
 */
export async function POST(req: Request) {
  if ((process.env.LIVE_DEMO_ENABLED ?? 'true') === 'false') return Response.json({ error: 'The live demo is turned off.' }, { status: 503 });
  if (!hasCredentials()) return Response.json({ error: 'The live demo is not configured on this server (no API key).' }, { status: 503 });

  let body: { text?: unknown; company?: unknown; title?: unknown };
  try { body = await req.json(); } catch { return Response.json({ error: 'Send JSON: { text, company?, title? }.' }, { status: 400 }); }
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const company = typeof body.company === 'string' ? body.company.trim().slice(0, 120) : '';
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 200) : '';
  if (text.length < 200) return Response.json({ error: 'Paste the full posting, at least 200 characters.' }, { status: 400 });
  if (text.length > LIVE_DEMO.maxChars) return Response.json({ error: `Postings are limited to ${LIVE_DEMO.maxChars.toLocaleString()} characters.` }, { status: 400 });

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'local';
  const perDay = Number(process.env.LIVE_DEMO_DAILY_LIMIT ?? LIVE_DEMO.defaultDailyLimit);
  const limit = checkLimits(ip, LIVE_DEMO.perIpPerHour, perDay);
  if (!limit.ok) return Response.json({ error: limit.reason }, { status: 429 });

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + '\n'));
      const t0 = Date.now();
      try {
        const result = await analyzePosting(text, company, title, (step) => send({ step }));
        send({ result, ms: Date.now() - t0 });
      } catch (e) {
        // Error messages are ours; never echo the posting text.
        send({ error: e instanceof Error && e.message.length < 200 ? e.message : 'Something went wrong. Please try again.' });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' } });
}
