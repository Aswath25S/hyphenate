import path from 'node:path';

export const ROOT = process.cwd();
export const DATA = path.join(ROOT, 'data');
export const P = {
  rawPostings: path.join(DATA, 'raw', 'postings'),
  rawManual: path.join(DATA, 'raw', 'manual'),
  rawNews: path.join(DATA, 'raw', 'news'),
  processed: path.join(DATA, 'processed'),
  extracted: path.join(DATA, 'processed', 'extracted'),
  matched: path.join(DATA, 'processed', 'matched'),
  app: path.join(DATA, 'app'),
  appPostings: path.join(DATA, 'app', 'postings'),
  cache: path.join(DATA, 'cache'),
  logs: path.join(DATA, 'logs'),
  config: path.join(ROOT, 'config'),
  fixtures: path.join(ROOT, 'tests', 'fixtures'),
};
