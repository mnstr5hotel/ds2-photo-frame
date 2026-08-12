import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = path.join(projectRoot, 'dist-pages');
if (path.dirname(outputRoot) !== projectRoot) throw new Error('Invalid static output path');

const assetIndex = JSON.parse(await readFile(path.join(projectRoot, 'assets', 'asset-index.json'), 'utf8'));
const colors = JSON.parse(await readFile(path.join(projectRoot, 'assets', 'logo-color-palette.json'), 'utf8'));

const items = assetIndex.map(function(item) {
  const relativePath = item.relative_path.replace(/\\/g, '/');
  return {
    id: item.id,
    category: item.category,
    width: item.width,
    height: item.height,
    names: item.names,
    src: 'assets/optimized/' + relativePath.replace(/\.png$/i, '.webp'),
    thumbnail: 'assets/thumbnails/' + relativePath.replace(/\.png$/i, '.webp'),
  };
});

const catalog = {
  items: items,
  colors: colors.map(function(color) {
    return {
      index: color.index,
      name: color.name,
      hex: color.hex,
      names: color.names,
    };
  }),
  backgrounds: [
    'assets/backgrounds/ds2-title-vertical.png',
    'assets/backgrounds/kojima-productions-2.png',
    'assets/backgrounds/drawbridge.png',
    'assets/backgrounds/dhv-magellan.png',
  ],
};

await rm(outputRoot, { recursive: true, force: true });
await cp(path.join(projectRoot, 'site'), outputRoot, { recursive: true });
await rm(path.join(outputRoot, 'build.json'), { force: true });
await mkdir(path.join(outputRoot, 'assets'), { recursive: true });
for (const directory of ['backgrounds', 'optimized', 'thumbnails']) {
  await cp(
    path.join(projectRoot, 'assets', directory),
    path.join(outputRoot, 'assets', directory),
    { recursive: true }
  );
}
await writeFile(path.join(outputRoot, 'assets', 'catalog.json'), JSON.stringify(catalog), 'utf8');
await writeFile(path.join(outputRoot, '.nojekyll'), '', 'utf8');

console.log('静态构建完成：' + items.filter(function(item) { return item.category === 'frame'; }).length
  + ' 个相框，' + items.filter(function(item) { return item.category === 'sticker'; }).length + ' 个贴纸。');
