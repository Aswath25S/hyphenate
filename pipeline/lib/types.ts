import type { RawPosting } from './sources';
import type { Posting } from '../../lib/schemas';
import type { FinalLabel } from '../prompts/match';

export type FilteredPosting = RawPosting & {
  posting_id: string;
  merged_raw_ids: string[];
  extra_salary_lines: { location: string; line: string }[];
  date_basis: 'posted_at' | 'updated_at' | 'unknown';
  title_decision: 'rule' | 'llm';
};

export type ExtractedPosting = Posting & {
  prompt_version: string;
  text: string;
  extra_salary_lines: { location: string; line: string }[];
  salary_source: 'posting_text' | 'job_board' | null;
  ats: string;
};

export type MatchedPosting = { posting_id: string; prompt_version: string; labels: FinalLabel[] };
