/**
 * Every tunable number lives here. Components and stages import from this
 * file; nothing else hard-codes a weight, discount or threshold.
 */

export const LEAD_WEIGHTS = { pain: 0.5, fit: 0.25, timing: 0.25 };

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

export const SIZE_SCORES = { inBand: 1.0, unknown: 0.5, outOfBand: 0.3 };
export const SIZE_BAND = { min: 200, max: 5000 };

export const COMPLEXITY_SCORES = { twoOrMore: 1.0, one: 0.5, none: 0.2 };

export const TRIGGER_WEIGHTS: Record<string, number> = {
  acquisition: 1.0,
  new_finance_leader: 0.9,
  erp_change: 0.9,
  ipo_sox: 0.9,
  funding: 0.8,
  international_expansion: 0.7,
  usage_based_pricing: 0.7,
  restructuring: 0.4,
};

export const TRIGGER_AGE = [
  { maxDays: 90, multiplier: 1.0 },
  { maxDays: 180, multiplier: 0.5 },
];

export const NEWS = {
  topCompanies: 30, // run news only for the top N by pain + fit
  minConfidence: 0.7,
  maxItemsPerCompany: 15,
};

export const OVERLAP = {
  assistedWeight: 0.5, // weighted overlap = (C + 0.5A) / n
  thinPostingMinDuties: 4,
  unclearConfidenceBelow: 0.6,
  strongLeadOverlap: 0.6, // gap ranking: share of postings with overlap >= this
};

export type SalaryBasis = 'bottom' | 'midpoint';

export const SAVINGS_DEFAULTS = {
  salaryBasis: 'bottom' as SalaryBasis,
  discount: 0.5,
  countAssisted: false,
  assistedWeight: 0.25,
  loadedCostMultiplier: 1.0,
};

export const SAVINGS_RANGES = {
  discount: { min: 0.25, max: 1.0, step: 0.05 },
  loadedCostMultiplier: { min: 1.0, max: 1.4, step: 0.05 },
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
  dedupeSimilarity: 0.9,
};

export const LIVE_DEMO = {
  maxChars: 20000,
  perIpPerHour: 10,
  defaultDailyLimit: 200,
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
