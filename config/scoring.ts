/**
 * Every tunable number lives here. Components and stages import from this
 * file; nothing else hard-codes a weight, discount or threshold.
 */

// Timing (news triggers) was removed on 22 Oct 2026; pain and fit keep their 2:1 ratio.
export const LEAD_WEIGHTS = { pain: 2 / 3, fit: 1 / 3 };

export const PAIN = {
  overlapWeight: 0.8,
  rolesWeight: 0.2,
  rolesCap: 4,
};

export const FIT_WEIGHTS = { erp: 0.4, size: 0.3, complexity: 0.3 };

export const ERP_SCORES = {
  enterprise: 1.0, // NetSuite, SAP, Sage Intacct, Microsoft Dynamics, Oracle
  notStated: 0.5,
  smbOnly: 0.2, // QuickBooks or Xero only
  other: 0.5, // a named ERP not in either list
};

export const ENTERPRISE_ERPS = [
  'netsuite',
  'sap',
  'sage intacct',
  'intacct',
  'microsoft dynamics',
  'dynamics 365',
  'dynamics',
  'business central',
  'oracle',
  'workday financials',
];
export const SMB_ERPS = ['quickbooks', 'qbo', 'xero'];

/**
 * Employee-count brackets for the size part of fit: more employees, higher score.
 * A company is placed by the lower bound of its employee band (e.g. "201-500" → 201).
 */
export const SIZE_BRACKETS = [
  { label: '1–200', max: 200, score: 0.3 },
  { label: '201–500', max: 500, score: 0.5 },
  { label: '501–1,000', max: 1000, score: 0.65 },
  { label: '1,001–5,000', max: 5000, score: 0.85 },
  { label: '5,000+', max: Infinity, score: 1.0 },
];
export const SIZE_UNKNOWN_SCORE = 0.5;

export const COMPLEXITY_SCORES = { twoOrMore: 1.0, one: 0.5, none: 0.2 };

export const OVERLAP = {
  assistedWeight: 0.5, // weighted overlap = (C + 0.5A) / n
  thinPostingMinDuties: 4,
  unclearConfidenceBelow: 0.6,
  strongLeadOverlap: 0.6, // gap ranking: share of postings with overlap >= this
  salaryHeadlineMinOverlap: 0.2, // overview: total salary of roles with at least this overlap
};

export type SalaryBasis = 'bottom' | 'midpoint';

export const SAVINGS_DEFAULTS = {
  salaryBasis: 'bottom' as SalaryBasis,
  discount: 0.5,
  // Duties Hyphenate prepares for approval count at assistedWeight (user decision, 22 Oct 2026).
  countAssisted: true,
  assistedWeight: 0.25,
};

export const SAVINGS_RANGES = {
  discount: { min: 0.25, max: 1.0, step: 0.05 },
};

export const SALARY = { hoursPerYear: 2080 };

export const BRIEFS = { topCompanies: 15 };

export const GAPS = {
  normaliseBatchSize: 100,
  minThemeSize: 3,
  minThemes: 15,
  maxThemes: 40,
  maxExamplePhrases: 5,
};

export const FILTER = {
  maxAgeDays: 60,
  // Same company + same normalised title: one role when descriptions are this similar
  // (spec said 0.9; lowered so UK/US or multi-location copies of one role merge).
  dedupeSimilarity: 0.75,
  // Different titles: one role only when descriptions are near-verbatim, and the titles
  // do not differ only by a site suffix ("Plant Controller, Cape" vs "…, Stennis").
  dedupeNearIdentical: 0.95,
};

export const LLM = {
  defaultModel: 'gpt-5.5', // override with OPENAI_MODEL
  maxTokens: 16000, // max_completion_tokens; reasoning tokens count toward it
  // USD per million tokens, for the cost report. Fill in from your OpenAI pricing page;
  // models without an entry are logged with cost "price not set".
  pricePerMTok: {} as Record<string, { input: number; output: number }>,
};

/** Shape the UI uses for client-side recompute. */
export type ScoringSettings = {
  lead: typeof LEAD_WEIGHTS;
  savings: typeof SAVINGS_DEFAULTS;
};

export const DEFAULT_SETTINGS: ScoringSettings = {
  lead: { ...LEAD_WEIGHTS },
  savings: { ...SAVINGS_DEFAULTS },
};
