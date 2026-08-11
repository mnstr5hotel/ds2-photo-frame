import fs from 'node:fs';
import path from 'node:path';

const sourceRoot = path.resolve(import.meta.dirname, '..');
const targetArgument = process.argv[2];
if (!targetArgument) throw new Error('Usage: node tools/prepare-deploy-source.mjs <new-target-directory>');

const targetRoot = path.resolve(targetArgument);
if (targetRoot === sourceRoot || targetRoot.startsWith(sourceRoot + path.sep)) {
  throw new Error('Deployment target must be outside the source project');
}
if (fs.existsSync(targetRoot)) throw new Error('Deployment target already exists: ' + targetRoot);
fs.mkdirSync(targetRoot, { recursive: true });

function copy(relativePath) {
  const source = path.join(sourceRoot, ...relativePath.split('/'));
  const target = path.join(targetRoot, ...relativePath.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true, errorOnExist: true });
}

[
  '.openai',
  'app',
  'server',
  'site',
  'tools',
  '.gitignore',
  'FRONTEND_BASELINE.md',
  'HANDOFF.md',
  'README.md',
  'next.config.mjs',
  'package-lock.json',
  'package.json',
  'vite.config.ts',
  'wrangler.jsonc',
].forEach(copy);

copy('assets/asset-index.json');
copy('assets/logo-color-palette.json');
copy('assets/backgrounds');

const manifest = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'assets', 'asset-index.json'), 'utf8'));
manifest.forEach(function(item) {
  const relativePath = item.relative_path.replace(/\\/g, '/');
  copy('assets/library/' + relativePath);
  copy('assets/thumbnails/' + relativePath.replace(/\.png$/i, '.webp'));
});

console.log('部署源码已准备：' + targetRoot);
console.log('包含 ' + manifest.length + ' 项网页素材；未复制本地保留但不展示的重复文件、node_modules、.next 或旧 stickers 目录。');
