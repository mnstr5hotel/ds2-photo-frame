import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const distRoot = path.join(root, 'dist');
const clientRoot = path.join(distRoot, 'client');
const serverRoot = path.join(distRoot, 'server');
const serverEntrypoint = path.join(serverRoot, 'index.js');
const generatedWranglerConfig = path.join(serverRoot, 'wrangler.json');
if (!fs.existsSync(serverEntrypoint) || !fs.existsSync(generatedWranglerConfig)) {
  throw new Error('Missing vinext Cloudflare Worker entrypoint');
}

function resetDirectory(target) {
  const resolved = path.resolve(target);
  if (!resolved.startsWith(clientRoot + path.sep)) throw new Error('Unsafe dist target: ' + resolved);
  if (fs.existsSync(resolved)) fs.rmSync(resolved, { recursive: true });
  fs.mkdirSync(resolved, { recursive: true });
}

function copyFile(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

const privateRoot = path.join(clientRoot, '__ds2_runtime__');
const runtimeAssets = path.join(privateRoot, 'assets');
const runtimeSite = path.join(privateRoot, 'site');
resetDirectory(privateRoot);
fs.cpSync(path.join(root, 'site'), runtimeSite, { recursive: true });
fs.cpSync(path.join(root, 'assets', 'backgrounds'), path.join(runtimeAssets, 'backgrounds'), { recursive: true });

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets', 'asset-index.json'), 'utf8'));
manifest.forEach(function(item) {
  const relativePath = item.relative_path.replace(/\\/g, '/');
  copyFile(
    path.join(root, 'assets', 'library', ...relativePath.split('/')),
    path.join(runtimeAssets, 'library', ...relativePath.split('/'))
  );
  const thumbnailPath = relativePath.replace(/\.png$/i, '.webp');
  copyFile(
    path.join(root, 'assets', 'thumbnails', ...thumbnailPath.split('/')),
    path.join(runtimeAssets, 'thumbnails', ...thumbnailPath.split('/'))
  );
});

fs.cpSync(path.join(root, '.openai'), path.join(distRoot, '.openai'), { recursive: true, force: true });

const wranglerConfig = JSON.parse(fs.readFileSync(generatedWranglerConfig, 'utf8'));
if (wranglerConfig.main !== 'index.js' || wranglerConfig.assets?.run_worker_first !== true) {
  throw new Error('Generated Worker config does not protect runtime assets');
}

const forbiddenRuntimePatterns = ['var ICNS =', 'Invalid ICNS', 'No codestream found in JXL'];
const workerText = fs.readFileSync(serverEntrypoint, 'utf8');
forbiddenRuntimePatterns.forEach(function(pattern) {
  if (workerText.includes(pattern)) throw new Error('Unsafe image parser remains in Worker: ' + pattern);
});

console.log('dist 已加固：复制 ' + manifest.length + ' 项受保护运行素材，并验证 Worker 优先路由与运行包。');
