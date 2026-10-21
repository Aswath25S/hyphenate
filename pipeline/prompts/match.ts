/** Matching prompt: label each scored duty against the coverage map. */
import { z } from 'zod';
import { MatchOutputSchema, type DutyLabel } from '../../lib/schemas';
import { OVERLAP } from '../../config/scoring';

export const MATCH_PROMPT_VERSION = 'match-v1';
export const matchSchema = MatchOutputSchema;
export const MATCH_TOOL = {
  name: 'record_labels',
  description: 'Record one coverage label for every duty in the list.',
};

export type Capability = {
  id: string; product: string; capability: string; default_level: 'covered' | 'assisted';
  example_phrases: string[]; not_included: string[]; source_url: string;
};

export function matchSystem(capabilities: Capability[]): string {
  const map = capabilities
    .map((c) => `- ${c.id} [${c.default_level}] ${c.product}: ${c.capability}
    typical phrasings: ${c.example_phrases.join('; ')}
    NOT this capability: ${c.not_included.join('; ') || 'n/a'}`)
    .join('\n');
  return `You label finance job duties against a coverage map of what an AI finance-operations platform advertises on its public website. For each duty, decide whether its core action is work the platform performs. Return the record_labels JSON object with one label per duty_id. Do not reply with prose.

Labels:
- covered: the duty's core action is a capability marked [covered] below, done end to end.
- assisted: the duty matches a capability marked [assisted], or matches a [covered] capability but needs human judgment.
- human: people work by nature: managing or training staff, presenting, partnering with or advising other teams, negotiating, working with auditors as a relationship, setting policy, hiring.
- gap_candidate: repetitive, rules-based work that could be automated but matches no capability below (e.g. payroll processing, sales tax filing, 1099s, commissions, expense-report review, budgeting models, inventory costing, stock-comp accounting).
- unclear: too vague to judge (e.g. "support the finance team", "drive process improvements").

Matching rules:
1. Match on the action, not the topic. "Review and approve journal entries prepared by staff" is human review, not gl.journal_entries. "Implement a new billing system" is a project, not o2c.invoicing.
2. Use the strictest fitting label. When torn between covered and assisted, choose assisted. When torn between assisted and human, choose human.
3. Check each capability's "NOT this capability" near misses before matching.
4. covered and assisted labels must include capability_id (an id from the list). human, gap_candidate and unclear labels use capability_id null.
5. confidence is 0 to 1: how sure you are of the label. rationale is one sentence naming the action and why it fits.

Coverage map:
${map}`;
}

export function matchUser(duties: { duty_id: string; text: string; source_span: string }[], context: { title: string; role_family: string }): string {
  const lines = duties.map((d) => `${d.duty_id}\t${d.text}`).join('\n');
  return `Role: ${context.title} (${context.role_family})

<duties>
${lines}
</duties>

Return the record_labels JSON object, with exactly one label for each of the ${duties.length} duty_ids above.`;
}

export function checkMatch(out: z.infer<typeof MatchOutputSchema>, dutyIds: string[], capabilityIds: Set<string>): string | null {
  const seen = new Map<string, number>();
  for (const l of out.labels) seen.set(l.duty_id, (seen.get(l.duty_id) ?? 0) + 1);
  const missing = dutyIds.filter((id) => !seen.has(id));
  const extra = [...seen.keys()].filter((id) => !dutyIds.includes(id));
  const dupes = [...seen.entries()].filter(([, n]) => n > 1).map(([id]) => id);
  if (missing.length) return `missing labels for duty_ids: ${missing.join(', ')}`;
  if (extra.length) return `unknown duty_ids: ${extra.join(', ')}`;
  if (dupes.length) return `duplicate labels for duty_ids: ${dupes.join(', ')}`;
  const bad = out.labels.filter((l) => (l.label === 'covered' || l.label === 'assisted') && (!l.capability_id || !capabilityIds.has(l.capability_id)));
  if (bad.length) return `covered/assisted labels need a valid capability_id from the map: ${bad.map((b) => `${b.duty_id}=${b.capability_id}`).join(', ')}`;
  return null;
}

export type FinalLabel = DutyLabel & { model_label: DutyLabel['label']; adjusted: string | null };

/**
 * Deterministic post-rules: low confidence → unclear; covered on an
 * [assisted] capability → assisted (strictest fitting label); non-matching
 * labels drop any capability id.
 */
export function finaliseLabels(labels: DutyLabel[], levels: Record<string, 'covered' | 'assisted'>): FinalLabel[] {
  return labels.map((l) => {
    let label = l.label;
    let adjusted: string | null = null;
    if (l.confidence < OVERLAP.unclearConfidenceBelow && label !== 'unclear') {
      adjusted = `confidence ${l.confidence.toFixed(2)} below ${OVERLAP.unclearConfidenceBelow}`;
      label = 'unclear';
    } else if (label === 'covered' && l.capability_id && levels[l.capability_id] === 'assisted') {
      adjusted = `${l.capability_id} is an assisted capability`;
      label = 'assisted';
    }
    const capability_id = label === 'covered' || label === 'assisted' ? l.capability_id : l.label === 'covered' || l.label === 'assisted' ? l.capability_id : null;
    return { ...l, label, capability_id, model_label: l.label, adjusted };
  });
}
