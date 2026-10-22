/** HTML → readable plain text that keeps list structure (one bullet per line). */
export function htmlToText(html: string): string {
  let s = decodeEntities(html); // Greenhouse double-encodes its HTML
  s = s
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '\n• ')
    .replace(/<\s*\/\s*li\s*>/gi, '')
    .replace(/<\s*\/\s*(p|div|h[1-6]|ul|ol|tr|section)\s*>/gi, '\n')
    .replace(/<\s*(p|div|h[1-6]|ul|ol|tr|section)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  s = decodeEntities(s);
  return s
    .split('\n')
    .map((l) => l.replace(/[ \t ]+/g, ' ').trim())
    .filter((l, i, arr) => l !== '' || (arr[i - 1] ?? '') !== '')
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/&ndash;/g, '–').replace(/&mdash;/g, '—').replace(/&rsquo;|&lsquo;/g, "'")
    .replace(/&rdquo;|&ldquo;/g, '"').replace(/&hellip;/g, '…').replace(/&bull;/g, '•')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&');
}

export function normaliseTitle(t: string): string {
  return t
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/\b(remote|hybrid|onsite|on-site|us|usa|united states)\b/g, ' ')
    .replace(/[-–—|,/].*$/, (m) => (m.length > 30 ? '' : m)) // drop long location suffixes
    .replace(/[^a-z0-9& ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function shingles(s: string, k = 5): Set<string> {
  const words = s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + k <= words.length; i++) out.add(words.slice(i, i + k).join(' '));
  if (!out.size && words.length) out.add(words.join(' '));
  return out;
}

/** Jaccard similarity on 5-word shingles, 0..1. */
export function textSimilarity(a: string, b: string): number {
  const A = shingles(a);
  const B = shingles(b);
  if (!A.size && !B.size) return 1;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

export function slugify(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Collapse whitespace for span matching. */
export function squash(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** Find a verbatim span in text, tolerant to whitespace and bullet differences. */
export function locateSpan(text: string, span: string): { start: number; end: number } | null {
  const direct = text.indexOf(span);
  if (direct >= 0) return { start: direct, end: direct + span.length };
  const strip = (s: string) => s.replace(/^[•\-*\s]+/, '');
  const target = squash(strip(span)).toLowerCase();
  if (!target) return null;
  // Build a whitespace-squashed copy with an index map back to the original.
  const map: number[] = [];
  let flat = '';
  let prevSpace = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (/\s/.test(c)) {
      if (!prevSpace && flat.length) { flat += ' '; map.push(i); }
      prevSpace = true;
    } else {
      flat += c.toLowerCase();
      map.push(i);
      prevSpace = false;
    }
  }
  const at = flat.indexOf(target);
  if (at < 0) return null;
  return { start: map[at], end: map[at + target.length - 1] + 1 };
}

/**
 * True when two titles share a base and differ only by a trailing site/location
 * suffix, e.g. "Plant Controller, Cape" vs "Plant Controller, Stennis". Those are
 * separate openings even when the descriptions are identical.
 */
export function isSiteVariant(a: string, b: string): boolean {
  const split = (t: string) => {
    const m = t.match(/^(.*?)(?:\s*[,|]\s*|\s+[-–—]\s+)([^,|]+)$/);
    return m ? { base: m[1].trim().toLowerCase(), suffix: m[2].trim().toLowerCase() } : null;
  };
  const x = split(a);
  const y = split(b);
  return Boolean(x && y && x.base === y.base && x.suffix !== y.suffix);
}
