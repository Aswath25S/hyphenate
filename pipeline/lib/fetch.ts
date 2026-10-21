/**
 * Polite fetcher: one request per second per host, an honest user agent,
 * and robots.txt respected for HTML pages.
 */
export const USER_AGENT =
  'BeforeTheNextHire/0.1 (independent research prototype; public job-board APIs and RSS only)';

const lastHit = new Map<string, number>();
const robotsCache = new Map<string, string[]>(); // host -> disallowed path prefixes for *
const MIN_GAP_MS = 1000;

async function waitForHost(host: string) {
  const now = Date.now();
  const last = lastHit.get(host) ?? 0;
  const wait = last + MIN_GAP_MS - now;
  lastHit.set(host, Math.max(now, last + MIN_GAP_MS));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

export class FetchError extends Error {
  constructor(public url: string, public status: number, msg: string) {
    super(msg);
  }
}

async function rawGet(url: string, accept: string, timeoutMs = 20000): Promise<Response> {
  assertAllowedHost(url);
  const u = new URL(url);
  await waitForHost(u.host);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: accept }, signal: ctrl.signal, redirect: 'follow' });
  } finally {
    clearTimeout(t);
  }
}

export async function getJson<T = unknown>(url: string): Promise<T> {
  const res = await rawGet(url, 'application/json');
  if (!res.ok) throw new FetchError(url, res.status, `GET ${url} → ${res.status}`);
  return (await res.json()) as T;
}

/** For RSS/XML feeds. */
export async function getXml(url: string): Promise<string> {
  const res = await rawGet(url, 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.5');
  if (!res.ok) throw new FetchError(url, res.status, `GET ${url} → ${res.status}`);
  return await res.text();
}

async function disallowed(u: URL): Promise<boolean> {
  let rules = robotsCache.get(u.host);
  if (!rules) {
    rules = [];
    try {
      const res = await rawGet(`${u.protocol}//${u.host}/robots.txt`, 'text/plain');
      if (res.ok) rules = parseRobots(await res.text());
    } catch {
      /* unreachable robots.txt: treat as allow-all */
    }
    robotsCache.set(u.host, rules);
  }
  return rules.some((p) => p !== '' && u.pathname.startsWith(p));
}

/** Disallow rules that apply to all agents (User-agent: *). */
export function parseRobots(txt: string): string[] {
  const out: string[] = [];
  let applies = false;
  let lastWasAgent = false;
  for (const line of txt.split(/\r?\n/)) {
    const l = line.replace(/#.*/, '').trim();
    if (!l) continue;
    const [k, ...rest] = l.split(':');
    const key = k.trim().toLowerCase();
    const val = rest.join(':').trim();
    if (key === 'user-agent') {
      if (!lastWasAgent) applies = false;
      if (val === '*' || USER_AGENT.toLowerCase().startsWith(val.toLowerCase())) applies = true;
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (applies && key === 'disallow') out.push(val);
    }
  }
  return out;
}

/** HTML pages only: checks robots.txt first and refuses disallowed paths. */
export async function getHtml(url: string): Promise<string> {
  const u = new URL(url);
  if (await disallowed(u)) throw new FetchError(url, 0, `robots.txt disallows ${url}`);
  const res = await rawGet(url, 'text/html');
  if (!res.ok) throw new FetchError(url, res.status, `GET ${url} → ${res.status}`);
  return await res.text();
}

const BANNED_HOSTS = /(^|\.)(linkedin\.com|indeed\.com|glassdoor\.com)$/i;
export function assertAllowedHost(url: string) {
  const host = new URL(url).hostname;
  if (BANNED_HOSTS.test(host)) throw new Error(`Refusing to fetch ${host}: LinkedIn, Indeed and Glassdoor are never scraped.`);
}
