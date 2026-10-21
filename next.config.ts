import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Pipeline output is read from disk at request/build time.
  outputFileTracingIncludes: { '/**': ['./data/app/**/*', './config/**/*'] },
};

export default nextConfig;
