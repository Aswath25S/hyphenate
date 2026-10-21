import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': import.meta.dirname, 'server-only': `${import.meta.dirname}/tests/helpers/server-only.ts` } },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
