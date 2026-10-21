/** Live demo: extract → match → score one pasted posting, in memory only. */
import 'server-only';
import { extractOne, buildPosting } from '../pipeline/stages/extract';
import { matchOne } from '../pipeline/stages/match';
import { loadCoverage, coverageIndex } from '../pipeline/lib/coverage';
import { locateSpan } from '../pipeline/lib/text';
import { computeOverlap, leadProduct, minimumSavings, normaliseSalary, productSplit } from './scoring';
import type { FilteredPosting } from '../pipeline/lib/types';
import type { PostingDetail } from './app-types';

export type Step = 'reading' | 'splitting' | 'matching' | 'pricing';

export async function analyzePosting(text: string, company: string, title: string, onStep: (s: Step) => void): Promise<PostingDetail> {
  onStep('reading');
  const now = new Date().toISOString();
  const input: FilteredPosting = {
    raw_id: 'live', company: company || 'Pasted posting', domain: '', ats: 'manual', board_token: 'live', source_job_id: 'live',
    title: title || 'Pasted posting', locations: [], text, structured_salary: null, workplace: null, posted_at: null, updated_at: null,
    source_url: '', api_url: '', fetched_at: now, posting_id: 'live000000000000', merged_raw_ids: [], extra_salary_lines: [],
    date_basis: 'unknown', title_decision: 'rule',
  };
  onStep('splitting');
  const ex = await extractOne(input, { ephemeral: true, stage: 'live', effort: 'low' });
  if (!ex.ok) throw new Error('The posting could not be read. Try a longer excerpt that includes the responsibilities.');
  if (ex.data.non_usd_salary) throw new Error('This posting lists pay in a currency other than US dollars, so it is out of scope.');
  const posting = buildPosting(input, ex.data);
  if (!title) posting.title = ex.data.title;

  onStep('matching');
  const coverage = loadCoverage();
  const m = await matchOne(posting, coverage, { ephemeral: true, stage: 'live', effort: 'low' });
  if (!m.ok) throw new Error('The duties could not be matched to the coverage map. Please try again.');

  onStep('pricing');
  const { product } = coverageIndex(coverage);
  const capById = new Map(coverage.capabilities.map((c) => [c.id, c]));
  const ov = computeOverlap(m.labels);
  const split = productSplit(m.labels, product);
  const salary = normaliseSalary(posting.salary);
  const sav = minimumSavings({ salary_min: salary.min, salary_max: salary.max, n: ov.n, C: ov.C, A: ov.A });
  const labelById = new Map(m.labels.map((l) => [l.duty_id, l]));
  return {
    posting_id: 'live', company: posting.company, slug: '', domain: '', title: posting.title, role_family: posting.role_family,
    seniority: posting.seniority, n: ov.n, C: ov.C, A: ov.A, covered_share: ov.covered_share, overlap: ov.overlap,
    weighted_overlap: ov.weighted_overlap, thin: ov.thin, salary_min: salary.min, salary_max: salary.max,
    salary_varies: salary.varies_by_location, salary_source: posting.salary_source,
    savings: sav.eligible ? sav.value : null, savings_reason: sav.eligible ? null : sav.reason,
    lead_product: leadProduct(split), product_split: split, erp: posting.erp, tools: posting.tools, posted_at: null,
    source_url: '', locations: posting.locations, remote: posting.remote, excluded: null,
    text, extra_salary_lines: [], salary_raw: posting.salary, complexity: posting.complexity, pain_phrases: posting.pain_phrases,
    fetched_at: now, ats: 'manual',
    duties: posting.duties.map((d) => {
      const l = labelById.get(d.duty_id);
      const cap = l?.capability_id ? capById.get(l.capability_id) : undefined;
      return {
        ...d, scored: !d.is_boilerplate && !d.is_requirement, span: locateSpan(text, d.source_span),
        label: l?.label ?? null, model_label: l?.model_label ?? null, adjusted: l?.adjusted ?? null,
        capability_id: l?.capability_id ?? null, capability: cap?.capability ?? null, product: cap?.product ?? null,
        confidence: l?.confidence ?? null, rationale: l?.rationale ?? null, gap_theme: null,
      };
    }),
  };
}
