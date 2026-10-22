import { leadScore } from '../../lib/scoring';
import type { CompanyBase } from '../stages/score';

export type CompanyLead = CompanyBase & {
  lead_score: number;
  lead_parts: { pain: number; fit: number };
  rank: number | null;
};

export function computeLeads(companies: CompanyBase[]): CompanyLead[] {
  const rows = companies.map((c) => {
    const ls = leadScore(c.pain, c.fit);
    return { ...c, lead_score: ls.score, lead_parts: ls.parts, rank: null as number | null };
  });
  rows.sort((a, b) => b.lead_score - a.lead_score || a.company.localeCompare(b.company));
  let r = 0;
  for (const row of rows) if (!row.excluded) row.rank = ++r;
  return rows;
}
