/** Server-only loaders for the files the pipeline writes to data/app. */
import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { cache } from 'react';
import type { CompanyRow, GapsFile, Meta, PostingDetail, PostingRow } from './app-types';

const APP = path.join(process.cwd(), 'data', 'app');

function read<T>(file: string): T | null {
  const p = path.join(APP, file);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
}

export const getMeta = cache(() => read<Meta>('meta.json'));
export const getPostings = cache(() => read<PostingRow[]>('postings.json') ?? []);
export const getCompanies = cache(() => read<CompanyRow[]>('companies.json') ?? []);
export const getGaps = cache(() => read<GapsFile>('gaps.json') ?? { themes: [], strong_overlap: 0.6 });
export const getPosting = cache((id: string) => (/^[a-f0-9]{8,32}$/.test(id) ? read<PostingDetail>(path.join('postings', `${id}.json`)) : null));
export const getCompany = cache((slug: string) => getCompanies().find((c) => c.slug === slug) ?? null);

export function hasData() {
  return getMeta() !== null;
}
