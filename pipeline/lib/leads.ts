import { leadScore, timingScore } from '../../lib/scoring';
import type { CompanyBase } from '../stages/score';
import type { StoredTrigger } from '../stages/news';

export type CompanyLead = CompanyBase & {
  triggers: StoredTrigger[];
  timing: number;
  top_trigger: (StoredTrigger & { weight: number; age_multiplier: number; score: number }) | null;
  news_searched: boolean;
  lead_score: number;
  lead_parts: { pain: number; fit: number; timing: number };
  rank: number | null;
};

export function computeLeads(companies: CompanyBase[], news: { companies: string[]; triggers: Record<string, StoredTrigger[]> } | null, asOf: string): CompanyLead[] {
  const rows = companies.map((c) => {
    const triggers = news?.triggers[c.domain] ?? [];
    const t = timingScore(triggers, asOf);
    const ls = leadScore(c.pain, c.fit, t.timing);
    return {
      ...c, triggers, timing: t.timing, top_trigger: t.top as CompanyLead['top_trigger'],
      news_searched: Boolean(news?.companies.includes(c.domain)), lead_score: ls.score, lead_parts: ls.parts, rank: null as number | null,
    };
  });
  rows.sort((a, b) => b.lead_score - a.lead_score || a.company.localeCompare(b.company));
  let r = 0;
  for (const row of rows) if (!row.excluded) row.rank = ++r;
  return rows;
}
