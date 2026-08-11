const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'none'",
  "child-src 'none'",
  "connect-src 'self'",
  "font-src 'self'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "img-src 'self' data: blob:",
  "manifest-src 'self'",
  "media-src 'none'",
  "object-src 'none'",
  "script-src 'self'",
  "script-src-attr 'none'",
  "style-src 'self'",
  "worker-src 'self' blob:",
  "require-trusted-types-for 'script'",
  'upgrade-insecure-requests',
].join('; ');

export const securityHeaderEntries = [
  ['Content-Security-Policy', contentSecurityPolicy],
  ['Cross-Origin-Opener-Policy', 'same-origin'],
  ['Cross-Origin-Resource-Policy', 'same-origin'],
  ['Origin-Agent-Cluster', '?1'],
  ['Permissions-Policy', 'camera=(), geolocation=(), microphone=(), payment=(), usb=()'],
  ['Referrer-Policy', 'same-origin'],
  ['Strict-Transport-Security', 'max-age=31536000'],
  ['X-Content-Type-Options', 'nosniff'],
  ['X-Frame-Options', 'DENY'],
];

export function applySecurityHeaders(response) {
  securityHeaderEntries.forEach(function([name, value]) {
    response.headers.set(name, value);
  });
  return response;
}
