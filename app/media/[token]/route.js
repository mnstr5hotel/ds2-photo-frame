import { getMediaDefinition } from '../../../server/asset-catalog.js';
import { hasValidAssetSession } from '../../../server/asset-session.js';
import { applySecurityHeaders } from '../../../server/security-headers.js';
import { readRuntimeFile } from '../../../server/runtime-files.js';

export const dynamic = 'force-dynamic';

export async function GET(request, context) {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin') {
    return applySecurityHeaders(new Response('Forbidden', { status: 403 }));
  }
  if (!hasValidAssetSession(request)) {
    return applySecurityHeaders(new Response('Unauthorized', { status: 401 }));
  }
  const params = await context.params;
  const definition = getMediaDefinition(params.token);
  if (!definition) return applySecurityHeaders(new Response('Not Found', { status: 404 }));

  try {
    const content = await readRuntimeFile(request, definition.storagePath);
    return applySecurityHeaders(new Response(content, {
      headers: {
        'Cache-Control': 'private, max-age=86400',
        'Content-Type': definition.contentType,
        'Cross-Origin-Resource-Policy': 'same-origin',
        'X-Content-Type-Options': 'nosniff',
        'X-Robots-Tag': 'noindex, noimageindex, noarchive',
      },
    }));
  } catch {
    return applySecurityHeaders(new Response('Not Found', { status: 404 }));
  }
}
