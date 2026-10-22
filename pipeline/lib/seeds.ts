import fs from 'node:fs';
import path from 'node:path';
import { parseCsv } from './io';
import { P } from './paths';
import type { SeedRow } from './sources';

export type Seed = SeedRow & { size_note?: string };

export function loadSeeds(): Seed[] {
  const file = path.join(P.config, 'sources.csv');
  if (!fs.existsSync(file)) throw new Error('config/sources.csv is missing. Build the seed list first (npm run seed:discover).');
  return parseCsv(fs.readFileSync(file, 'utf8')).filter((r) => r.company && r.ats && r.board_token) as unknown as Seed[];
}

export type Exclusions = { customers: string[]; customer_domains: string[]; vendors: string[] };

export function loadExclusions(): Exclusions {
  return JSON.parse(fs.readFileSync(path.join(P.config, 'exclusions.json'), 'utf8'));
}

/** Why a company never appears as a lead, or null. */
export function exclusionReason(company: string, domain: string, ex: Exclusions): 'existing_customer' | 'finance_software_vendor' | null {
  const c = company.toLowerCase().trim();
  if (ex.customers.some((x) => x.toLowerCase() === c) || ex.customer_domains.includes(domain.toLowerCase())) return 'existing_customer';
  if (ex.vendors.some((x) => x.toLowerCase() === c)) return 'finance_software_vendor';
  return null;
}
