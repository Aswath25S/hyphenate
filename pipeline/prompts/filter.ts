/** Claude check for titles the rules cannot place. */
import { z } from 'zod';

export const titleCheckSchema = z.object({
  items: z.array(z.object({ id: z.string(), keep: z.boolean(), reason: z.string() })),
});
export const TITLE_TOOL = { name: 'record_title_decisions', description: 'Record keep/drop for each job title.' };

export const TITLE_SYSTEM = `You decide whether job postings belong to a corporate finance or CFO-office team. Call record_title_decisions exactly once.

Keep: accounts receivable, billing, collections, cash application, credit; accounts payable, procurement accounting, vendor management; staff, senior, GL, revenue, technical and corporate accountants; close managers, accounting managers, assistant controllers, controllers; treasury; financial reporting; FP&A analysts; payroll; tax accountants. Keep finance-operations generalists ("Finance Manager", "Head of Finance") when the description lists hands-on accounting duties.
Drop: internships; CFO and VP titles with no listed hands-on duties; engineering, data science, sales, revenue operations (sales ops), customer-facing billing support in healthcare (medical billing), fraud/financial-crimes/risk/compliance analysts, investment, banking-product and lending roles.`;

export function titleUser(items: { id: string; title: string; snippet: string }[]): string {
  return `<postings>\n${items.map((i) => `<p id="${i.id}">\nTitle: ${i.title}\nStart of description: ${i.snippet}\n</p>`).join('\n')}\n</postings>\n\nCall record_title_decisions once with one decision per id.`;
}
