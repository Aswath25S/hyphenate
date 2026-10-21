import { XMLParser } from 'fast-xml-parser';
import { decodeEntities } from './text';

export type FeedItem = { title: string; link: string; published: string | null; source: string; snippet: string };

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

export function parseFeed(xml: string): FeedItem[] {
  const doc = parser.parse(xml);
  const rssItems = doc?.rss?.channel?.item;
  const atomItems = doc?.feed?.entry;
  const items = [rssItems, atomItems].flat().filter(Boolean) as Record<string, unknown>[];
  return items.map((it) => {
    const text = (v: unknown): string => (typeof v === 'string' ? v : v && typeof v === 'object' && '#text' in v ? String((v as Record<string, unknown>)['#text']) : '');
    const linkRaw = it.link as unknown;
    const link = typeof linkRaw === 'string' ? linkRaw : (linkRaw as Record<string, string>)?.['@_href'] ?? '';
    const pub = text(it.pubDate) || text(it.published) || text(it.updated);
    const d = pub ? new Date(pub) : null;
    const desc = decodeEntities(text(it.description) || text(it.summary)).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return {
      title: decodeEntities(text(it.title)).trim(),
      link,
      published: d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : null,
      source: text(it.source) || '',
      snippet: desc.slice(0, 400),
    };
  });
}
