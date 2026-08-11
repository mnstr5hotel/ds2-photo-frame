import { issueAssetSession } from '../server/asset-session.js';
import { readRuntimeFile } from '../server/runtime-files.js';
import { applySecurityHeaders } from '../server/security-headers.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const html = await readRuntimeFile(request, 'site/index.html');
  return applySecurityHeaders(new Response(html, {
    headers: {
      'Cache-Control': 'no-cache',
      'Content-Type': 'text/html; charset=utf-8',
      'Set-Cookie': issueAssetSession(request),
    },
  }));
}
