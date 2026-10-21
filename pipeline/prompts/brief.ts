/** Company brief: written from structured data only, then fact-checked in code. */
import { BriefOutputSchema } from '../../lib/schemas';

export const briefSchema = BriefOutputSchema;
export const BRIEF_TOOL = { name: 'record_brief', description: 'Record the company brief fields.' };

export const BRIEF_SYSTEM = `You write short sales-research briefs from structured data about one company's open finance job postings. Use only facts in the <data> block. Every number and every proper name you write must appear in the data exactly as given (percentages as given, dollar figures as given). Call record_brief exactly once.

Fields:
- headline: one sentence naming the company and the most telling open role, e.g. "Acme is hiring its third AR specialist to match payments by hand."
- why_them: one or two sentences on overlap, open roles and ERP.
- why_now: one sentence on the strongest trigger event, or "No recent trigger event found." if none.
- lead_with: the lead product name and a few words on why.
- minimum_savings: one sentence using the given minimum savings figure and role count, phrased as work that could be absorbed before the next hire; or "No salary posted, so no figure." if none.
- may_not_cover: one sentence naming the top gap themes as "not on Hyphenate's public site", or "None found." if none.
- angle: one sentence, "before your next hire" framing.

Tone: short declarative sentences, sentence case, no hype, never about cutting people. Never claim the platform cannot do something.`;

export function briefUser(data: unknown): string {
  return `<data>\n${JSON.stringify(data, null, 2)}\n</data>\n\nCall record_brief once.`;
}

/**
 * Fact check: every number and capitalised name in the brief must appear in
 * the source data. Returns the offending tokens.
 */
export function factCheckBrief(brief: Record<string, string>, data: unknown, allowedWords: string[] = []): string[] {
  const src = JSON.stringify(data).toLowerCase();
  const srcNumbers = new Set((src.match(/\d[\d,.]*/g) ?? []).map((n) => n.replace(/[,]/g, '').replace(/\.$/, '')));
  const problems: string[] = [];
  const allow = new Set(['hyphenate', 'no', 'none', 'the', 'a', 'an', 'before', 'at', 'across', 'it', 'its', 'their', 'they', 'with', 'this', 'that', 'and', ...allowedWords.map((w) => w.toLowerCase())]);
  for (const text of Object.values(brief)) {
    for (const num of text.match(/\d[\d,.]*/g) ?? []) {
      const n = num.replace(/,/g, '').replace(/\.$/, '');
      if (!srcNumbers.has(n)) problems.push(num);
    }
    // Capitalised words not at sentence start: check they exist in the data.
    const words = text.match(/(?<![.!?]\s|^)\b[A-Z][a-zA-Z&.'-]{2,}\b/g) ?? [];
    for (const w of words) {
      const lw = w.toLowerCase().replace(/['.]s?$/, '');
      if (!allow.has(lw) && !src.includes(lw)) problems.push(w);
    }
  }
  return [...new Set(problems)];
}
