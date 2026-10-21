import { z } from 'zod';

/* ---------- Extraction (mirrors pipeline/prompts/extract.ts) ---------- */

export const ROLE_FAMILIES = [
  'AR', 'AP', 'GL', 'Revenue', 'Treasury', 'Reporting_FPA', 'Close_Mgmt', 'Controller', 'Payroll', 'Tax', 'Other',
] as const;
export const SENIORITIES = ['entry', 'mid', 'senior', 'manager', 'director_plus'] as const;
export const REMOTE = ['onsite', 'hybrid', 'remote', 'unknown'] as const;

export const DutySchema = z.object({
  duty_id: z.string(),
  text: z.string().min(1),
  source_span: z.string().min(1),
  is_boilerplate: z.boolean(),
  is_requirement: z.boolean(),
});
export type Duty = z.infer<typeof DutySchema>;

export const SalarySchema = z.object({
  min: z.number().nonnegative().nullable(),
  max: z.number().nonnegative().nullable(),
  period: z.enum(['year', 'hour']).nullable(),
  currency: z.enum(['USD']).nullable(),
  raw_text: z.string().nullable(),
});
export type Salary = z.infer<typeof SalarySchema>;

/** What the model returns. Ids and provenance are filled in by code. */
export const ExtractionOutputSchema = z.object({
  title: z.string().min(1),
  role_family: z.enum(ROLE_FAMILIES),
  seniority: z.enum(SENIORITIES),
  locations: z.array(z.string()),
  remote: z.enum(REMOTE),
  salary: SalarySchema,
  non_usd_salary: z.boolean(),
  erp: z.array(z.string()),
  tools: z.array(z.string()),
  complexity: z.object({
    multi_entity: z.boolean(),
    multi_currency: z.boolean(),
    usage_based_billing: z.boolean(),
    high_volume: z.boolean(),
    entity_count: z.number().int().nullable(),
  }),
  pain_phrases: z.array(z.string()).max(8),
  duties: z.array(
    z.object({
      text: z.string().min(1),
      source_span: z.string().min(1),
      is_boilerplate: z.boolean(),
      is_requirement: z.boolean(),
    }),
  ),
});
export type ExtractionOutput = z.infer<typeof ExtractionOutputSchema>;

export const PostingSchema = ExtractionOutputSchema.omit({ duties: true, non_usd_salary: true }).extend({
  posting_id: z.string(),
  company: z.string(),
  domain: z.string(),
  duties: z.array(DutySchema),
  posted_at: z.string().nullable(),
  source_url: z.string(),
  fetched_at: z.string(),
});
export type Posting = z.infer<typeof PostingSchema>;

/* ---------- Matching ---------- */

export const LABELS = ['covered', 'assisted', 'human', 'gap_candidate', 'unclear'] as const;
export type Label = (typeof LABELS)[number];

export const DutyLabelSchema = z.object({
  duty_id: z.string(),
  label: z.enum(LABELS),
  capability_id: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1),
});
export type DutyLabel = z.infer<typeof DutyLabelSchema>;

export const MatchOutputSchema = z.object({ labels: z.array(DutyLabelSchema) });

/* ---------- News ---------- */

export const TRIGGER_TYPES = [
  'acquisition', 'new_finance_leader', 'erp_change', 'ipo_sox', 'funding',
  'international_expansion', 'usage_based_pricing', 'restructuring', 'none',
] as const;
export type TriggerType = (typeof TRIGGER_TYPES)[number];

export const NewsClassificationSchema = z.object({
  items: z.array(
    z.object({
      item_id: z.string(),
      trigger_type: z.enum(TRIGGER_TYPES),
      event_date: z.string().nullable(),
      summary: z.string(),
      confidence: z.number().min(0).max(1),
      company_named_in_headline: z.boolean(),
    }),
  ),
});

/* ---------- Gaps ---------- */

export const GAP_BUCKETS = ['human_work', 'possible_gap', 'unclear'] as const;
export type GapBucket = (typeof GAP_BUCKETS)[number];

export const NormaliseOutputSchema = z.object({
  items: z.array(z.object({ duty_id: z.string(), canonical: z.string().min(1) })),
});

export const ClusterOutputSchema = z.object({
  themes: z.array(
    z.object({
      theme_id: z.string(),
      name: z.string().min(1),
      description: z.string(),
      bucket: z.enum(GAP_BUCKETS),
      task_ids: z.array(z.number().int()),
    }),
  ),
});

/* ---------- Briefs ---------- */

export const BriefOutputSchema = z.object({
  headline: z.string().min(1),
  why_them: z.string().min(1),
  why_now: z.string(),
  lead_with: z.string().min(1),
  minimum_savings: z.string(),
  may_not_cover: z.string(),
  angle: z.string().min(1),
});
export type BriefOutput = z.infer<typeof BriefOutputSchema>;
