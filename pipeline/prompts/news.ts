/** News classification: headline + snippet → trigger type, date, summary, confidence. */
import { NewsClassificationSchema } from '../../lib/schemas';

export const newsSchema = NewsClassificationSchema;
export const NEWS_TOOL = { name: 'record_triggers', description: 'Record one classification per news item.' };

export const NEWS_SYSTEM = `You classify news items about one company into "trigger events" that change how its finance team works. Return the record_triggers JSON object with one entry per item_id. Use only the headline, source and snippet given; never use outside knowledge.

trigger_type:
- acquisition: the company acquires another company (not: is acquired, invests in, partners with).
- new_finance_leader: the company appoints a new CFO, VP Finance, Chief Accounting Officer or Controller.
- erp_change: the company implements or moves to a new ERP or finance system.
- ipo_sox: IPO filing, IPO, direct listing, or SOX readiness.
- funding: the company raises a priced equity round or significant growth debt.
- international_expansion: the company opens operations, entities or offices in a new country.
- usage_based_pricing: the company moves to usage- or consumption-based pricing.
- restructuring: layoffs or a restructuring at the company.
- none: anything else (product launches, awards, opinion pieces, other companies with similar names).

event_date: the date of the event as YYYY-MM-DD if stated or clearly the publication date, else the publication date given. summary: one plain sentence. confidence: 0 to 1. company_named_in_headline: true only if the company itself is named in the headline.`;

export function newsUser(company: string, domain: string, items: { item_id: string; title: string; source: string; published: string; snippet: string }[]): string {
  return `Company: ${company} (${domain})

<items>
${items.map((i) => `<item id="${i.item_id}">\nHeadline: ${i.title}\nSource: ${i.source}\nPublished: ${i.published}\nSnippet: ${i.snippet}\n</item>`).join('\n')}
</items>

Return the record_triggers JSON object with one entry per item id.`;
}
