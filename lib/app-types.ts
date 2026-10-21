/** Shapes of the data/app/*.json files written by the publish stage. */
import type { CompanyLead } from '../pipeline/lib/leads';
import type { GapTheme } from '../pipeline/stages/gaps';
import type { BriefOutput, Label } from './schemas';
import type { ProductSplit } from './scoring';
import type { StageStat } from '../pipeline/lib/stats';
import type { CoverageMap } from '../pipeline/lib/coverage';

export type PostingRow = {
  posting_id: string; company: string; slug: string; domain: string; title: string; role_family: string; seniority: string;
  n: number; C: number; A: number; covered_share: number; overlap: number; weighted_overlap: number; thin: boolean;
  salary_min: number | null; salary_max: number | null; salary_varies: boolean; salary_source: string | null;
  savings: number | null; savings_reason: string | null; lead_product: string | null; product_split: ProductSplit;
  erp: string[]; tools: string[]; posted_at: string | null; source_url: string; locations: string[]; remote: string;
  excluded: string | null;
};

export type DutyView = {
  duty_id: string; text: string; source_span: string; is_boilerplate: boolean; is_requirement: boolean; scored: boolean;
  span: { start: number; end: number } | null;
  label: Label | null; model_label: Label | null; adjusted: string | null;
  capability_id: string | null; capability: string | null; product: string | null;
  confidence: number | null; rationale: string | null;
  gap_theme: { theme_id: string; name: string; bucket: string } | null;
};

export type PostingDetail = PostingRow & {
  text: string; extra_salary_lines: { location: string; line: string }[];
  salary_raw: { min: number | null; max: number | null; period: string | null; currency: string | null; raw_text: string | null };
  complexity: { multi_entity: boolean; multi_currency: boolean; usage_based_billing: boolean; high_volume: boolean; entity_count: number | null };
  pain_phrases: string[]; fetched_at: string; ats: string; duties: DutyView[];
};

export type CompanyRow = CompanyLead & {
  brief: BriefOutput | null;
  gap_themes: { theme_id: string; name: string; bucket: string; duties: number }[];
};

export type GapsFile = { themes: GapTheme[]; strong_overlap: number };

export type Meta = {
  as_of: string; generated_at: string; mode: 'pipeline' | 'fixture_preview'; model: string;
  headlines: {
    postings: number; companies: number; lead_companies: number; median_overlap: number | null; companies_with_covered_work: number;
    savings_total: number; savings_postings: number; salary_postings: number; thin_postings: number; strong_postings: number;
  };
  stage_stats: Record<string, StageStat>;
  cost_report: Record<string, { calls: number; cached: number; input_tokens: number; output_tokens: number; cost_usd: number; unpriced_calls?: number }>;
  spans: { found: number; total: number };
  news: { as_of: string | null; companies_searched: number };
  briefs: { count: number; dropped: number };
  coverage: CoverageMap;
  config: Record<string, unknown>;
  collection: { seeds: number | null; total_jobs: number | null; at: string | null };
};

export type { GapTheme };
