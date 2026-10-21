import fs from 'node:fs';
import path from 'node:path';
import { P } from './paths';
import type { Capability } from '../prompts/match';

export type CoverageMap = { as_of: string; note: string; known_not_advertised: string[]; capabilities: Capability[] };

export function loadCoverage(): CoverageMap {
  return JSON.parse(fs.readFileSync(path.join(P.config, 'coverage_map.json'), 'utf8'));
}

export function coverageIndex(c: CoverageMap) {
  const ids = new Set(c.capabilities.map((x) => x.id));
  const levels = Object.fromEntries(c.capabilities.map((x) => [x.id, x.default_level])) as Record<string, 'covered' | 'assisted'>;
  const product = Object.fromEntries(c.capabilities.map((x) => [x.id, x.product])) as Record<string, string>;
  return { ids, levels, product };
}
