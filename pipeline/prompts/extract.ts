/**
 * Extraction prompt + schema. One call per posting turns the description into
 * structured fields and single duties. The zod schema (lib/schemas.ts) is the
 * source of truth; the response JSON schema is generated from it.
 */
import { ExtractionOutputSchema, type ExtractionOutput } from '../../lib/schemas';

export const EXTRACT_PROMPT_VERSION = 'extract-v1';
export const extractSchema = ExtractionOutputSchema;
export const EXTRACT_TOOL = {
  name: 'record_posting',
  description: 'Record the structured fields and the list of single duties extracted from one job posting.',
};

const EXAMPLE_AR = `<example>
<posting>
Accounts Receivable Specialist — Denver, CO (Hybrid)
What you'll do:
• Apply customer payments daily and reconcile cash receipts to the bank
• Prepare and send invoices in NetSuite, including usage-based invoices
• Follow up on past-due accounts and partner with Sales on billing disputes
• Other duties as assigned
What you bring:
• 2+ years of AR experience; NetSuite required
• Comfort with high transaction volume
We value curiosity and kindness.
The base pay range for this role is $62,000 - $78,000 per year.
</posting>
Correct duties (responsibilities section only, one action each):
1. "Apply customer payments daily" — source_span "Apply customer payments daily"
2. "Reconcile cash receipts to the bank" — source_span "reconcile cash receipts to the bank"
3. "Prepare and send invoices in NetSuite, including usage-based invoices" — source_span "Prepare and send invoices in NetSuite, including usage-based invoices"
4. "Follow up on past-due accounts" — source_span "Follow up on past-due accounts"
5. "Partner with Sales on billing disputes" — source_span "partner with Sales on billing disputes"
6. "Other duties as assigned" — is_boilerplate true
7. "2+ years of AR experience" — is_requirement true
8. "NetSuite required" — is_requirement true
9. "Comfort with high transaction volume" — is_requirement true
10. "We value curiosity and kindness." — is_boilerplate true
Fields: role_family AR, seniority mid, remote hybrid, locations ["Denver, CO"], salary {min 62000, max 78000, period "year", currency "USD", raw_text "The base pay range for this role is $62,000 - $78,000 per year."}, erp ["NetSuite"], tools [], complexity {usage_based_billing true, high_volume true, multi_entity false, multi_currency false, entity_count null}, pain_phrases ["high transaction volume"].
</example>`;

const EXAMPLE_SR = `<example>
<posting>
Senior Accountant
About the role: You will own key parts of our month-end close across our 6 global entities.
Responsibilities
- Prepare monthly journal entries, accruals and balance sheet reconciliations
- Manage the fixed asset and prepaid schedules
- Perform intercompany reconciliations and multi-currency revaluation
- Prepare flux analysis and present results to the Controller
- Support the annual audit and special projects
Requirements: CPA preferred. 4+ years in public accounting or high-growth SaaS. Experience with Sage Intacct and FloQast.
Pay: $95,000 - $115,000 (San Francisco), $85,000 - $105,000 (Austin).
</posting>
Correct duties:
1. "Prepare monthly journal entries" 2. "Prepare monthly accruals" 3. "Prepare balance sheet reconciliations"
4. "Manage the fixed asset schedule" 5. "Manage the prepaid schedule" 6. "Perform intercompany reconciliations"
7. "Perform multi-currency revaluation" 8. "Prepare flux analysis" 9. "Present flux results to the Controller"
10. "Support the annual audit" 11. "Special projects" (is_boilerplate true)
Requirements (is_requirement true): "CPA preferred", "4+ years in public accounting or high-growth SaaS", "Experience with Sage Intacct and FloQast".
Fields: role_family GL, seniority senior, salary {min 85000, max 115000, period "year", currency "USD", raw_text "Pay: $95,000 - $115,000 (San Francisco), $85,000 - $105,000 (Austin)."}, erp ["Sage Intacct"], tools ["FloQast"], complexity {multi_entity true, multi_currency true, usage_based_billing false, high_volume false, entity_count 6}.
</example>`;

export const EXTRACT_SYSTEM = `You extract structured data from finance and accounting job postings for a research tool. Read the posting in the <posting> block and return the result as the record_posting JSON object.

Duty-splitting rules:
1. One action per duty. "Reconcile bank accounts and partner with sales on disputes" becomes two duties. Split lists of objects that share one verb when each object is a separate task (e.g. "journal entries, accruals and reconciliations" → three duties).
2. Keep the object and frequency: "Apply customer payments daily", not "Payments". Rewrite each duty as a short imperative sentence.
3. Only the responsibilities section (what the person will do) produces scored duties. Qualifications, skills, years of experience, education, certifications and software requirements become duties with is_requirement true.
4. Mark culture lines, company descriptions, benefits, "other duties as assigned" and "special projects" as is_boilerplate true.
5. Copy source_span verbatim from the posting: the exact contiguous characters the duty came from, without leading bullet symbols. Never paraphrase a source_span.
6. Never invent salary, ERP or tools. Unknown means null or an empty list.

Field rules:
- role_family: AR (receivables, billing, collections, cash application, credit), AP (payables, procurement accounting, vendor management), GL (staff, senior, general, corporate accountant), Revenue (revenue accountant, rev rec), Treasury, Reporting_FPA (financial reporting, FP&A), Close_Mgmt (close manager, accounting manager), Controller (controller, assistant controller), Payroll, Tax, Other.
- seniority: entry (0-2 years), mid, senior, manager, director_plus.
- salary: min and max as written (do not convert hourly to yearly; set period "hour" for hourly pay). If several ranges are listed (e.g. by location), set min to the lowest minimum and max to the highest maximum, and copy every salary sentence into raw_text verbatim. A single figure goes in min with max null. If pay is not in US dollars, set currency null and non_usd_salary true. If no pay is given, all salary fields are null.
- erp: only ERP systems (NetSuite, SAP, Sage Intacct, Microsoft Dynamics, Oracle, QuickBooks, Xero, Workday Financials, etc.). tools: other named software (Excel, BlackLine, FloQast, Bill.com, Salesforce, Stripe, etc.).
- complexity flags: true only when the posting says so (multiple entities or subsidiaries, foreign currency, usage- or consumption-based billing, high transaction volume). entity_count only when a number is stated.
- pain_phrases: up to 8 verbatim phrases that signal manual or growing workload (e.g. "manual reconciliations", "high volume of invoices", "scale our processes").
- locations: as listed; remote: onsite, hybrid, remote or unknown.

Two worked examples follow. They show the splitting standard; your output is the JSON object, not this format.

${EXAMPLE_AR}

${EXAMPLE_SR}`;

export function extractUser(p: { company: string; title: string; locations: string[]; text: string; salaryHint?: string | null }): string {
  return `Company: ${p.company}
Listed title: ${p.title}
Listed locations: ${p.locations.join('; ') || 'not listed'}${p.salaryHint ? `\nStructured pay data from the job board: ${p.salaryHint}` : ''}

<posting>
${p.text}
</posting>

Return the record_posting JSON object with the extraction.`;
}

/** Semantic checks beyond the schema; returns an error to trigger the one retry. */
export function checkExtraction(out: ExtractionOutput, text: string, locate: (t: string, s: string) => unknown): string | null {
  if (!out.duties.length) return 'duties is empty; every posting has at least one line to classify';
  const missing = out.duties.filter((d) => !locate(text, d.source_span));
  // Allow a little slack (bullets merged across lines), but most spans must be verbatim.
  if (missing.length > Math.max(1, Math.floor(out.duties.length * 0.15)))
    return `these source_span values are not verbatim substrings of the posting: ${missing.slice(0, 5).map((d) => JSON.stringify(d.source_span)).join(', ')}`;
  return null;
}
