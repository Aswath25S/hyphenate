import { describe, expect, it } from 'vitest';
import { BriefOutputSchema, ClusterOutputSchema, DutyLabelSchema, ExtractionOutputSchema, MatchOutputSchema, NewsClassificationSchema, NormaliseOutputSchema } from '../lib/schemas';
import { titleCheckSchema } from '../pipeline/prompts/filter';
import { toToolSchema } from '../pipeline/lib/claude';

const extraction = {
  title: 'Staff Accountant', role_family: 'GL', seniority: 'mid', locations: ['Austin, TX'], remote: 'hybrid',
  salary: { min: 70000, max: 85000, period: 'year', currency: 'USD', raw_text: '$70,000 - $85,000' }, non_usd_salary: false,
  erp: ['NetSuite'], tools: ['Excel'],
  complexity: { multi_entity: false, multi_currency: false, usage_based_billing: false, high_volume: false, entity_count: null },
  pain_phrases: [], duties: [{ text: 'Reconcile bank accounts', source_span: 'Reconcile bank accounts', is_boilerplate: false, is_requirement: false }],
};

describe('Claude output schemas', () => {
  it('extraction accepts a valid object and rejects bad enums', () => {
    expect(ExtractionOutputSchema.safeParse(extraction).success).toBe(true);
    expect(ExtractionOutputSchema.safeParse({ ...extraction, role_family: 'Sales' }).success).toBe(false);
    expect(ExtractionOutputSchema.safeParse({ ...extraction, pain_phrases: Array(9).fill('x') }).success).toBe(false);
    expect(ExtractionOutputSchema.safeParse({ ...extraction, salary: { ...extraction.salary, currency: 'EUR' } }).success).toBe(false);
  });
  it('labels require confidence in 0..1 and a known label', () => {
    expect(DutyLabelSchema.safeParse({ duty_id: 'a', label: 'covered', capability_id: 'tre.bank_rec', confidence: 0.9, rationale: 'x' }).success).toBe(true);
    expect(DutyLabelSchema.safeParse({ duty_id: 'a', label: 'covered', capability_id: 'x', confidence: 1.2, rationale: 'x' }).success).toBe(false);
    expect(DutyLabelSchema.safeParse({ duty_id: 'a', label: 'maybe', capability_id: null, confidence: 0.5, rationale: 'x' }).success).toBe(false);
    expect(MatchOutputSchema.safeParse({ labels: [] }).success).toBe(true);
  });
  it('news, gaps, brief and title schemas parse valid shapes', () => {
    expect(NewsClassificationSchema.safeParse({ items: [{ item_id: 'a', trigger_type: 'funding', event_date: '2026-09-01', summary: 's', confidence: 0.9, company_named_in_headline: true }] }).success).toBe(true);
    expect(NewsClassificationSchema.safeParse({ items: [{ item_id: 'a', trigger_type: 'merger', event_date: null, summary: 's', confidence: 0.9, company_named_in_headline: true }] }).success).toBe(false);
    expect(NormaliseOutputSchema.safeParse({ items: [{ duty_id: 'a', canonical: 'file sales tax returns' }] }).success).toBe(true);
    expect(ClusterOutputSchema.safeParse({ themes: [{ theme_id: 't', name: 'Tax', description: 'd', bucket: 'possible_gap', task_ids: [0, 1] }] }).success).toBe(true);
    expect(ClusterOutputSchema.safeParse({ themes: [{ theme_id: 't', name: 'Tax', description: 'd', bucket: 'gap', task_ids: [] }] }).success).toBe(false);
    expect(BriefOutputSchema.safeParse({ headline: 'h', why_them: 'w', why_now: '', lead_with: 'l', minimum_savings: '', may_not_cover: '', angle: 'a' }).success).toBe(true);
    expect(titleCheckSchema.safeParse({ items: [{ id: '1', keep: true, reason: 'r' }] }).success).toBe(true);
  });
  it('every schema converts to a strict tool schema', () => {
    for (const s of [ExtractionOutputSchema, MatchOutputSchema, NewsClassificationSchema, NormaliseOutputSchema, ClusterOutputSchema, BriefOutputSchema, titleCheckSchema]) {
      const j = toToolSchema(s) as { type: string; additionalProperties: boolean };
      expect(j.type).toBe('object');
      expect(j.additionalProperties).toBe(false);
    }
  });
});
