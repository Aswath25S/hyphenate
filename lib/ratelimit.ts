/**
 * In-memory limits for the live demo: a daily cap and a per-IP hourly cap.
 * Counters reset when the server restarts (and are per instance on serverless).
 * IPs are kept in memory only, as one-way hashes, never written to disk.
 */
import crypto from 'node:crypto';

const hits = new Map<string, number[]>();
let day = '';
let dayCount = 0;

export function checkLimits(ip: string, perHour: number, perDay: number): { ok: true } | { ok: false; reason: string } {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== day) { day = today; dayCount = 0; }
  if (dayCount >= perDay) return { ok: false, reason: 'The live demo has reached its daily limit. Please try again tomorrow.' };
  const key = crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= perHour) return { ok: false, reason: `You have used the live demo ${perHour} times in the last hour. Please try again later.` };
  recent.push(now);
  hits.set(key, recent);
  dayCount++;
  return { ok: true };
}

/** For tests. */
export function resetLimits() { hits.clear(); day = ''; dayCount = 0; }
