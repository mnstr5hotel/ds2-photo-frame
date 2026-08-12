import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const readText = function(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
};
const readJson = function(relativePath) {
  return JSON.parse(readText(relativePath));
};
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function fileHash(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

const indexHtml = readText('site/index.html');
const appSource = readText('site/app.js');
const langSource = readText('site/lang.js');
const manifest = readJson('assets/asset-index.json');
const colors = readJson('assets/logo-color-palette.json');

check(Array.isArray(manifest) && manifest.length > 0, '素材索引必须是非空数组');
check(new Set(manifest.map(function(item) { return item.id; })).size === manifest.length, '素材 ID 必须唯一');
check(colors.length === 24, '调色板必须包含 24 种颜色');
check(colors[0] && colors[0].name === 'SnowWhite', '默认颜色必须是 SnowWhite');
check(!/\.innerHTML\s*=/.test(appSource), '不要使用 innerHTML 字符串写入');
check(appSource.includes("const ASSET_CATALOG_URL = 'assets/catalog.json';"), '静态素材目录必须使用相对路径');
check(!appSource.includes('/api/catalog') && !appSource.includes('/media/'), '静态网页不能依赖服务端素材路由');

const htmlIds = new Set(Array.from(indexHtml.matchAll(/\sid="([^"]+)"/g), function(match) { return match[1]; }));
const requiredIds = Array.from(appSource.matchAll(/getElementById\('([^']+)'\)/g), function(match) { return match[1]; });
requiredIds.forEach(function(id) {
  check(htmlIds.has(id), 'HTML 缺少脚本引用的 ID：' + id);
});

const languageKeys = new Set(Array.from(langSource.matchAll(/^\s{4}([a-z0-9_]+):/gm), function(match) { return match[1]; }));
const usedLanguageKeys = new Set([
  ...Array.from(indexHtml.matchAll(/data-i18n="([^"]+)"/g), function(match) { return match[1]; }),
  ...Array.from(appSource.matchAll(/\bt\('([^']+)'\)/g), function(match) { return match[1]; }),
]);
usedLanguageKeys.forEach(function(key) {
  check(languageKeys.has(key), '缺少语言键：' + key);
});

manifest.forEach(function(item) {
  check(item.category === 'frame' || item.category === 'sticker', item.id + ' 的分类无效');
  check(Number.isInteger(item.width) && item.width > 0, item.id + ' 的宽度无效');
  check(Number.isInteger(item.height) && item.height > 0, item.id + ' 的高度无效');
  check(item.names && item.names.en && item.names['zh-Hans'], item.id + ' 缺少中英文名称');
  check(!path.isAbsolute(item.relative_path) && !item.relative_path.includes('..'), item.id + ' 的相对路径不安全');

  const relativePath = item.relative_path.replace(/\\/g, '/');
  const originalPath = path.join(root, 'assets', 'library', ...relativePath.split('/'));
  const optimizedPath = path.join(root, 'assets', 'optimized', ...relativePath.replace(/\.png$/i, '.webp').split('/'));
  const thumbnailPath = path.join(root, 'assets', 'thumbnails', ...relativePath.replace(/\.png$/i, '.webp').split('/'));
  check(fs.existsSync(originalPath), item.id + ' 缺少原图');
  check(fs.existsSync(optimizedPath), item.id + ' 缺少发布用 WebP 素材');
  check(fs.existsSync(thumbnailPath), item.id + ' 缺少缩略图');
  if (fs.existsSync(originalPath) && item.sha256) {
    check(fileHash(originalPath) === item.sha256, item.id + ' 的 SHA-256 不匹配');
  }
});

if (failures.length) {
  console.error('发布前检查失败：');
  failures.forEach(function(message) { console.error('- ' + message); });
  process.exit(1);
}

const frameCount = manifest.filter(function(item) { return item.category === 'frame'; }).length;
const stickerCount = manifest.filter(function(item) { return item.category === 'sticker'; }).length;
console.log('发布前检查通过：' + frameCount + ' 个相框，' + stickerCount + ' 个贴纸，24 种颜色。');
