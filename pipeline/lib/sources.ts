/** Public job-board adapters: Greenhouse, Lever, Ashby → one RawPosting shape. */
import { getJson } from './fetch';
import { htmlToText } from './text';

export type Ats = 'greenhouse' | 'lever' | 'ashby';

export type RawPosting = {
  raw_id: string; // ats:token:job id
  company: string;
  domain: string;
  ats: Ats | 'manual';
  board_token: string;
  source_job_id: string;
  title: string;
  locations: string[];
  text: string;
  structured_salary: { min: number | null; max: number | null; currency: string | null; period: 'year' | 'hour' | null; summary: string | null } | null;
  workplace: string | null;
  posted_at: string | null; // first published, when the board exposes it
  updated_at: string | null;
  source_url: string; // public job page
  api_url: string;
  fetched_at: string;
};

export type SeedRow = {
  company: string; domain: string; ats: Ats; board_token: string; employee_band: string; hq_state: string; size_source_url: string;
};

export function apiUrl(ats: Ats, token: string): string {
  switch (ats) {
    case 'greenhouse': return `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs?content=true`;
    case 'lever': return `https://api.lever.co/v0/postings/${encodeURIComponent(token)}?mode=json`;
    case 'ashby': return `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(token)}?includeCompensation=true`;
  }
}

/* ---- Greenhouse ---- */
type GhJob = {
  id: number; title: string; updated_at?: string; first_published?: string; absolute_url: string; content?: string;
  location?: { name?: string }; offices?: { name?: string; location?: string }[];
};

/* ---- Lever ---- */
type LeverJob = {
  id: string; text: string; createdAt?: number; hostedUrl: string; descriptionPlain?: string; description?: string;
  lists?: { text: string; content: string }[]; additionalPlain?: string; additional?: string;
  categories?: { location?: string; allLocations?: string[]; commitment?: string; team?: string };
  salaryRange?: { min?: number; max?: number; currency?: string; interval?: string };
  workplaceType?: string; country?: string;
};

/* ---- Ashby ---- */
type AshbyJob = {
  id: string; title: string; location?: string; secondaryLocations?: { location?: string }[]; isListed?: boolean;
  workplaceType?: string; isRemote?: boolean; descriptionHtml?: string; descriptionPlain?: string; publishedAt?: string;
  jobUrl: string; employmentType?: string; address?: { postalAddress?: { addressCountry?: string } };
  compensation?: {
    compensationTierSummary?: string;
    summaryComponents?: { compensationType?: string; interval?: string; currencyCode?: string; minValue?: number | null; maxValue?: number | null }[];
  };
};

export async function fetchBoard(seed: Pick<SeedRow, 'company' | 'domain' | 'ats' | 'board_token'>): Promise<RawPosting[]> {
  const url = apiUrl(seed.ats, seed.board_token);
  const fetched_at = new Date().toISOString();
  const base = { company: seed.company, domain: seed.domain, ats: seed.ats, board_token: seed.board_token, api_url: url, fetched_at };

  if (seed.ats === 'greenhouse') {
    const data = await getJson<{ jobs: GhJob[] }>(url);
    return (data.jobs ?? []).map((j) => ({
      ...base,
      raw_id: `greenhouse:${seed.board_token}:${j.id}`,
      source_job_id: String(j.id),
      title: j.title.trim(),
      locations: uniq([j.location?.name, ...(j.offices ?? []).map((o) => o.location || o.name)]),
      text: htmlToText(j.content ?? ''),
      structured_salary: null,
      workplace: null,
      posted_at: j.first_published ?? null,
      updated_at: j.updated_at ?? null,
      source_url: j.absolute_url,
    }));
  }

  if (seed.ats === 'lever') {
    const data = await getJson<LeverJob[]>(url);
    return (Array.isArray(data) ? data : []).map((j) => {
      const lists = (j.lists ?? []).map((l) => `${l.text}\n${htmlToText(l.content)}`).join('\n\n');
      const text = [j.descriptionPlain ?? htmlToText(j.description ?? ''), lists, j.additionalPlain ?? htmlToText(j.additional ?? '')]
        .filter(Boolean).join('\n\n');
      const sr = j.salaryRange;
      const interval = sr?.interval?.toLowerCase() ?? '';
      return {
        ...base,
        raw_id: `lever:${seed.board_token}:${j.id}`,
        source_job_id: j.id,
        title: j.text.trim(),
        locations: uniq([...(j.categories?.allLocations ?? []), j.categories?.location]),
        text,
        structured_salary: sr && (sr.min || sr.max)
          ? { min: sr.min ?? null, max: sr.max ?? null, currency: sr.currency ?? null, period: interval.includes('hour') ? 'hour' : interval.includes('year') ? 'year' : null, summary: null }
          : null,
        workplace: j.workplaceType ?? null,
        posted_at: j.createdAt ? new Date(j.createdAt).toISOString() : null,
        updated_at: null,
        source_url: j.hostedUrl,
      };
    });
  }

  const data = await getJson<{ jobs: AshbyJob[] }>(url);
  return (data.jobs ?? []).filter((j) => j.isListed !== false).map((j) => {
    const comp = j.compensation?.summaryComponents?.find((c) => c.compensationType === 'Salary');
    const interval = comp?.interval?.toLowerCase() ?? '';
    return {
      ...base,
      raw_id: `ashby:${seed.board_token}:${j.id}`,
      source_job_id: j.id,
      title: j.title.trim(),
      locations: uniq([j.location, ...(j.secondaryLocations ?? []).map((l) => l.location)]),
      text: j.descriptionPlain?.trim() || htmlToText(j.descriptionHtml ?? ''),
      structured_salary: comp && (comp.minValue || comp.maxValue)
        ? {
            min: comp.minValue ?? null, max: comp.maxValue ?? null, currency: comp.currencyCode ?? null,
            period: interval.includes('hour') ? 'hour' : interval.includes('year') ? 'year' : null,
            summary: j.compensation?.compensationTierSummary ?? null,
          }
        : null,
      workplace: j.workplaceType ?? (j.isRemote ? 'Remote' : null),
      posted_at: j.publishedAt ?? null,
      updated_at: null,
      source_url: j.jobUrl,
    };
  });
}

function uniq(xs: (string | undefined | null)[]): string[] {
  return [...new Set(xs.map((x) => (x ?? '').trim()).filter(Boolean))];
}
