/** Collapse news items that describe the same event (one story, many outlets). */
import { TRIGGER_DEDUPE_DAYS } from '../../config/scoring';
import { ageMultiplier, daysBetween } from '../../lib/scoring';
import type { StoredTrigger } from '../stages/news';

/**
 * Items of the same trigger type within TRIGGER_DEDUPE_DAYS of each other are one
 * event. The representative is the item that scores highest for timing (so lead
 * scores do not change), then the most confident; the rest become also_reported.
 */
export function dedupeTriggers(items: StoredTrigger[], asOf: string): StoredTrigger[] {
  const sorted = [...items].sort((a, b) => (a.event_date ?? '').localeCompare(b.event_date ?? ''));
  const groups: StoredTrigger[][] = [];
  for (const t of sorted) {
    const g = groups.find((grp) => grp[0].trigger_type === t.trigger_type && grp.some((x) =>
      x.event_date && t.event_date ? Math.abs(daysBetween(x.event_date, t.event_date)) <= TRIGGER_DEDUPE_DAYS : x.url === t.url));
    if (g) g.push(t); else groups.push([t]);
  }
  return groups.map((g) => {
    const seenUrls = new Set<string>();
    const unique = g.filter((x) => (seenUrls.has(x.url) ? false : (seenUrls.add(x.url), true)));
    const rep = [...unique].sort((a, b) =>
      ageMultiplier(b.event_date, asOf) - ageMultiplier(a.event_date, asOf) || b.confidence - a.confidence)[0];
    const others = unique.filter((x) => x !== rep).flatMap((x) => [
      { source: x.source, url: x.url, headline: x.headline, published: x.published },
      ...(x.also_reported ?? []),
    ]);
    return { ...rep, also_reported: [...(rep.also_reported ?? []), ...others] };
  }).sort((a, b) => (b.event_date ?? '').localeCompare(a.event_date ?? ''));
}
