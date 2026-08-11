import { applySecurityHeaders } from '../../server/security-headers.js';
import { readRuntimeFile } from '../../server/runtime-files.js';

export const dynamic = 'force-dynamic';

const publicFiles = new Map([
  ['app.js', { path: 'app.js', type: 'text/javascript; charset=utf-8' }],
  ['lang.js', { path: 'lang.js', type: 'text/javascript; charset=utf-8' }],
  ['style.css', { path: 'style.css', type: 'text/css; charset=utf-8' }],
  ['build.json', { path: 'build.json', type: 'application/json; charset=utf-8' }],
  ['robots.txt', { path: 'robots.txt', type: 'text/plain; charset=utf-8' }],
  ['assets/favicon.svg', { path: 'assets/favicon.svg', type: 'image/svg+xml' }],
  ['vendor/heic-to-csp-1.5.2.js', { path: 'vendor/heic-to-csp-1.5.2.js', type: 'text/javascript; charset=utf-8' }],
  ['vendor/heic-to-LICENSE.txt', { path: 'vendor/heic-to-LICENSE.txt', type: 'text/plain; charset=utf-8' }],
]);

export async function GET(request, context) {
  const params = await context.params;
  const requestedPath = Array.isArray(params.file) ? params.file.join('/') : params.file;
  const file = publicFiles.get(requestedPath);
  if (!file) return applySecurityHeaders(new Response('Not Found', { status: 404 }));
  try {
    const content = await readRuntimeFile(request, 'site/' + file.path);
    return applySecurityHeaders(new Response(content, {
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': file.type,
        'X-Content-Type-Options': 'nosniff',
      },
    }));
  } catch {
    return applySecurityHeaders(new Response('Not Found', { status: 404 }));
  }
}
