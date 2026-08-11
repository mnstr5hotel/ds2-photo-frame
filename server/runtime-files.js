import fs from 'node:fs/promises';
import path from 'node:path';

const INTERNAL_ASSET_PREFIX = '/__ds2_runtime__/';

async function readCloudflareAsset(request, relativePath) {
  try {
    const { env } = await import('cloudflare:workers');
    if (!env?.ASSETS) return null;
    const assetUrl = new URL(INTERNAL_ASSET_PREFIX + relativePath, request.url);
    const response = await env.ASSETS.fetch(assetUrl);
    if (!response.ok) throw new Error('Runtime asset not found: ' + relativePath);
    return new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Runtime asset not found:')) throw error;
    return null;
  }
}

export async function readRuntimeFile(request, relativePath) {
  const cloudflareAsset = await readCloudflareAsset(request, relativePath);
  if (cloudflareAsset) return cloudflareAsset;
  return fs.readFile(path.join(/* turbopackIgnore: true */ process.cwd(), ...relativePath.split('/')));
}
