import type { Transport } from '../../pipeline/lib/claude';

/** Deterministic stand-in for Claude. */
export const fake: Transport = async ({ tool, user }) => {
  const usage = { text: '', stopReason: 'tool_use', input_tokens: 1000, output_tokens: 200 };
  if (tool.name === 'record_posting') {
    const text = user.split('<posting>\n')[1].split('\n</posting>')[0];
    const bullets = text.split('\n').filter((l) => /^(•|-)\s+\S/.test(l.trim())).map((l) => l.trim().replace(/^(•|-)\s+/, '')).slice(0, 14);
    const sal = text.match(/\$\s?(\d[\d,]*)(?:\.\d+)?\s*(?:-|–|—|to)\s*\$?\s?(\d[\d,]*)/);
    const toN = (s: string) => Number(s.replace(/,/g, ''));
    return {
      ...usage,
      toolInput: {
        title: 'X', role_family: 'AR', seniority: 'mid', locations: [], remote: 'unknown', non_usd_salary: false,
        salary: sal ? { min: toN(sal[1]), max: toN(sal[2]), period: toN(sal[1]) < 500 ? 'hour' : 'year', currency: 'USD', raw_text: sal[0] } : { min: null, max: null, period: null, currency: null, raw_text: null },
        erp: /netsuite/i.test(text) ? ['NetSuite'] : [], tools: [],
        complexity: { multi_entity: /multi-entity|entities/i.test(text), multi_currency: /currenc/i.test(text), usage_based_billing: false, high_volume: /volume/i.test(text), entity_count: null },
        pain_phrases: [],
        duties: bullets.map((b, i) => ({ text: b.slice(0, 80), source_span: b, is_boilerplate: false, is_requirement: i >= 10 })),
      },
    };
  }
  if (tool.name === 'record_labels') {
    const ids = [...user.matchAll(/^(\S+-\d{2})\t/gm)].map((m) => m[1]);
    const cycle = [
      ['covered', 'o2c.collections'], ['assisted', 'gl.journal_entries'], ['human', null], ['gap_candidate', null], ['covered', 'tre.bank_rec'], ['unclear', null],
    ] as const;
    return { ...usage, toolInput: { labels: ids.map((id, i) => ({ duty_id: id, label: cycle[i % 6][0], capability_id: cycle[i % 6][1], confidence: 0.9, rationale: 'fake' })) } };
  }
  if (tool.name === 'record_canonical_tasks') {
    const items = [...user.matchAll(/^(\S+)\t(.*)$/gm)].map((m) => ({ duty_id: m[1], canonical: m[2].toLowerCase().split(' ').slice(0, 3).join(' ') }));
    return { ...usage, toolInput: { items } };
  }
  if (tool.name === 'record_themes') {
    const n = Number(user.match(/count="(\d+)"/)![1]);
    const themes = Array.from({ length: 15 }, (_, t) => ({
      theme_id: `t${t}`, name: `Theme ${t}`, description: 'd', bucket: t % 3 === 0 ? 'human_work' : t % 3 === 1 ? 'possible_gap' : 'unclear',
      task_ids: Array.from({ length: n }, (_, i) => i).filter((i) => i % 15 === t),
    }));
    return { ...usage, toolInput: { themes } };
  }
  if (tool.name === 'record_brief') {
    const data = JSON.parse(user.split('<data>\n')[1].split('\n</data>')[0]);
    return {
      ...usage,
      toolInput: {
        headline: `${data.company} is hiring for finance work.`, why_them: `Average overlap is ${data.average_overlap}.`,
        why_now: 'No recent trigger event found.', lead_with: `${data.lead_product}.`,
        minimum_savings: data.minimum_savings ? `It is ${data.minimum_savings}.` : 'No salary posted, so no figure.',
        may_not_cover: 'None found.', angle: 'Hire after the agents take the routine work.',
      },
    };
  }
  return { ...usage, toolInput: null };
};

