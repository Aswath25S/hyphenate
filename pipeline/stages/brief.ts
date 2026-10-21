/** Stage 8: the LLM writes a short brief per top company from structured data only. */
import path from 'node:path';
import fs from 'node:fs';
import { BRIEFS } from '../../config/scoring';
import { readJson, writeJson } from '../lib/io';
import { P } from '../lib/paths';
import { callLlm, hasCredentials } from '../lib/llm';
import { computeLeads, type CompanyLead } from '../lib/leads';
import { BRIEF_SYSTEM, BRIEF_TOOL, briefSchema, briefUser, factCheckBrief } from '../prompts/brief';
import { recordStage } from '../lib/stats';
import { PRODUCT_ORDER, ROLE_LABELS, TRIGGER_LABELS, pct, shortDate, usd } from '../../lib/format';
import type { BriefOutput } from '../../lib/schemas';
import type { CompanyBase, PostingScore } from './score';
import type { GapTheme } from './gaps';

const ALLOWED = [
  ...PRODUCT_ORDER, 'AR', 'AP', 'GL', 'FP&A', 'CFO', 'ERP', 'ASC', 'Hyphenate', "Hyphenate's", 'No', 'None', 'Lead', 'Why',
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December',
  ...Object.values(TRIGGER_LABELS), ...Object.values(ROLE_LABELS), 'Order', 'Reporting', 'Treasury', 'Procure',
];

export function briefData(c: CompanyLead, postings: PostingScore[], themes: GapTheme[]) {
  const roles = postings.filter((p) => c.posting_ids.includes(p.posting_id)).sort((a, b) => b.overlap - a.overlap);
  const topGaps = themes
    .filter((t) => t.bucket === 'possible_gap' && t.company_domains.includes(c.domain))
    .slice(0, 3)
    .map((t) => t.name);
  const lp = c.lead_product ? c.product_split[c.lead_product] : null;
  return {
    company: c.company,
    open_finance_roles: c.open_roles,
    roles: roles.map((r) => ({ title: r.title, role_family: ROLE_LABELS[r.role_family] ?? r.role_family, overlap: pct(r.overlap), posting_id: r.posting_id })),
    average_overlap: pct(c.avg_overlap),
    erp: c.erp.length ? c.erp : ['not stated'],
    lead_product: c.lead_product ?? 'none',
    lead_product_duties: lp ? { covered: lp.covered, assisted: lp.assisted } : null,
    strongest_trigger: c.top_trigger
      ? { type: TRIGGER_LABELS[c.top_trigger.trigger_type] ?? c.top_trigger.trigger_type, date: shortDate(c.top_trigger.event_date), headline: c.top_trigger.headline, summary: c.top_trigger.summary }
      : null,
    minimum_savings: c.savings_roles ? `at least ${usd(c.savings_total)} a year across ${c.savings_roles} ${c.savings_roles === 1 ? 'role' : 'roles'}` : null,
    top_gap_themes: topGaps,
    tools_named_in_postings: c.tools,
  };
}

export async function brief(asOf = new Date()) {
  if (!hasCredentials()) throw new Error('brief needs OPENAI_API_KEY.');
  const asOfStr = asOf.toISOString().slice(0, 10);
  const companies = readJson<CompanyBase[]>(path.join(P.processed, 'scored_companies.json'));
  const postings = readJson<PostingScore[]>(path.join(P.processed, 'scored_postings.json'));
  const newsFile = path.join(P.processed, 'news.json');
  const news = fs.existsSync(newsFile) ? readJson<{ companies: string[]; triggers: Record<string, never[]> }>(newsFile) : null;
  const gapsFile = path.join(P.processed, 'gaps.json');
  const themes = fs.existsSync(gapsFile) ? readJson<{ themes: GapTheme[] }>(gapsFile).themes : [];
  const leads = computeLeads(companies, news, asOfStr).filter((c) => c.rank !== null).slice(0, BRIEFS.topCompanies);
  const out: Record<string, { brief: BriefOutput; data: ReturnType<typeof briefData>; attempts: number }> = {};
  const dropped: { company: string; problems: string[] }[] = [];

  for (const c of leads) {
    const data = briefData(c, postings, themes);
    let problems: string[] = [];
    let attempts = 0;
    for (; attempts < 2; attempts++) {
      const extra = attempts === 0 ? '' : `\n\nA previous draft used facts not in the data: ${problems.join(', ')}. Use only facts in the data.`;
      const res = await callLlm({
        stage: 'brief', system: BRIEF_SYSTEM, user: briefUser(data) + extra,
        formatName: BRIEF_TOOL.name, formatDescription: BRIEF_TOOL.description, schema: briefSchema, maxTokens: 8000,
      });
      if (!res.ok) { problems = [res.error]; continue; }
      problems = factCheckBrief(res.data, data, ALLOWED);
      if (!problems.length) { out[c.domain] = { brief: res.data, data, attempts: attempts + 1 }; break; }
    }
    if (!out[c.domain]) { dropped.push({ company: c.company, problems }); console.log(`  ✗ brief dropped for ${c.company}: ${problems.join(', ')}`); }
  }
  writeJson(path.join(P.processed, 'briefs.json'), { as_of: asOfStr, briefs: out, dropped });
  recordStage({ stage: 'brief', in: leads.length, out: Object.keys(out).length, failed: dropped.length, notes: ['every kept brief passed the fact check'] });
}
