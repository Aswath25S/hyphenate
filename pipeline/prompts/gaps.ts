/** Gap analysis prompts: normalise duties to canonical tasks, then cluster into themes. */
import { ClusterOutputSchema, NormaliseOutputSchema } from '../../lib/schemas';
import { GAPS } from '../../config/scoring';

export const normaliseSchema = NormaliseOutputSchema;
export const clusterSchema = ClusterOutputSchema;
export const NORMALISE_TOOL = { name: 'record_canonical_tasks', description: 'Record a short canonical task for each duty.' };
export const CLUSTER_TOOL = { name: 'record_themes', description: 'Record the gap themes and which canonical tasks belong to each.' };

export const NORMALISE_SYSTEM = `You rewrite finance job duties as short canonical tasks so identical work groups together. Return the record_canonical_tasks JSON object with one item per duty_id.

Rules: lower case, 2 to 7 words, verb first, no company names, no frequency words unless they change the task, standard finance vocabulary. Example: "Prepare and file monthly sales tax returns across all states" → "file sales and use tax returns". "Manage and develop a team of 3 AP specialists" → "manage accounting staff". "Support ad hoc projects as needed" → "support ad hoc projects".`;

export function normaliseUser(items: { duty_id: string; text: string }[]): string {
  return `<duties>\n${items.map((i) => `${i.duty_id}\t${i.text}`).join('\n')}\n</duties>\n\nReturn the record_canonical_tasks JSON object with exactly ${items.length} items.`;
}

export function clusterSystem(knownAreas: string[]): string {
  return `You group finance tasks that an AI finance-operations platform does not advertise into themes, as product input. Return the record_themes JSON object.

Make between ${GAPS.minThemes} and ${GAPS.maxThemes} themes. Every canonical task in the list must be assigned to exactly one theme, by its numeric id. Each theme has a theme_id (short snake_case), a name (2 to 5 words, sentence case), a one-line description, and a bucket:
- human_work: needs people by nature, not a product gap (managing staff, presenting to leadership, cross-functional partnering, auditor relationships, hiring, policy decisions).
- possible_gap: repetitive work that could be automated but is not on the platform's public site.
- unclear: too vague to judge ("special projects", "support the team as needed").

Known areas the platform does not advertise; use them as possible_gap themes when tasks fit: ${knownAreas.join('; ')}. Do not state or imply the platform cannot do anything; themes describe the work only.`;
}

export function clusterUser(tasks: { canonical: string; count: number }[]): string {
  return `<canonical_tasks count="${tasks.length}">\n${tasks.map((t, i) => `${i}\t${t.count}\t${t.canonical}`).join('\n')}\n</canonical_tasks>\n\nEach line is "<task id>\\t<number of duties>\\t<canonical task>". Return the record_themes JSON object; every task id from 0 to ${tasks.length - 1} must appear in exactly one theme's task_ids.`;
}

export function checkClusters(themes: { task_ids: number[] }[], taskCount: number): string | null {
  const seen = new Map<number, number>();
  for (const t of themes) for (const id of t.task_ids) seen.set(id, (seen.get(id) ?? 0) + 1);
  const missing: number[] = [];
  for (let i = 0; i < taskCount; i++) if (!seen.has(i)) missing.push(i);
  const dupes = [...seen.entries()].filter(([, n]) => n > 1).map(([id]) => id);
  const unknown = [...seen.keys()].filter((id) => id < 0 || id >= taskCount);
  if (unknown.length) return `unknown task ids: ${unknown.slice(0, 20).join(', ')}`;
  if (missing.length > Math.max(2, Math.floor(taskCount * 0.02))) return `task ids not assigned to any theme: ${missing.slice(0, 40).join(', ')}`;
  if (dupes.length) return `task ids assigned to more than one theme: ${dupes.slice(0, 20).join(', ')}`;
  return null;
}
