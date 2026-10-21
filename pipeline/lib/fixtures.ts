import fs from 'node:fs';
import path from 'node:path';
import { P } from './paths';
import type { FilteredPosting } from './types';
import type { Label } from '../../lib/schemas';

export type Fixture = {
  fixture_id: string;
  labelled_by: string;
  source: { company: string; title: string; source_url: string; posted_at: string | null };
  input: FilteredPosting;
  expected: {
    role_family: string; seniority: string;
    salary_annual: { min: number | null; max: number | null; period: 'year' | 'hour' | null };
    erp: string[]; scored_duty_count: number;
    duties: { duty_id: string; text: string; source_span: string; is_boilerplate: boolean; is_requirement: boolean; label: Label; capability_id: string | null }[];
  };
};

export function loadFixtures(): Fixture[] {
  return fs.readdirSync(P.fixtures).filter((f) => f.endsWith('.json') && f !== 'hand_labels.json' && f !== 'golden_report.json')
    .sort().map((f) => JSON.parse(fs.readFileSync(path.join(P.fixtures, f), 'utf8')));
}
