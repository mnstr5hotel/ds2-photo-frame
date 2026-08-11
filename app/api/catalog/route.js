import { getPublicCatalog } from '../../../server/asset-catalog.js';
import { hasValidAssetSession } from '../../../server/asset-session.js';
import { applySecurityHeaders } from '../../../server/security-headers.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin') {
    return applySecurityHeaders(new Response('Forbidden', { status: 403 }));
  }
  if (!hasValidAssetSession(request)) {
    return applySecurityHeaders(new Response('Unauthorized', { status: 401 }));
  }
  return applySecurityHeaders(Response.json(getPublicCatalog(), {
    headers: {
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, noarchive',
    },
  }));
}
