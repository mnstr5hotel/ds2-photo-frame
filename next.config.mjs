import { securityHeaderEntries } from './server/security-headers.js';

const securityHeaders = securityHeaderEntries.map(function([key, value]) {
  return { key, value };
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  agentRules: false,
  compress: true,
  distDir: process.env.NEXT_DIST_DIR || '.next',
  output: 'standalone',
  outputFileTracingIncludes: {
    '/*': ['./assets/**/*', './site/**/*'],
  },
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
