import path from 'node:path';
import { chromium } from 'playwright-core';

const root = path.resolve(import.meta.dirname, '..');
const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:4174';
const isSitesProduction = new URL(baseUrl).hostname.endsWith('.chatgpt.site');
const executablePath = process.env.BROWSER_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browser = await chromium.launch({ executablePath: executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];

page.on('pageerror', function(error) { errors.push('pageerror: ' + error.message); });
page.on('console', function(message) {
  if (message.type() !== 'error') return;
  const text = message.text();
  if (isSitesProduction && text.includes("Executing inline script violates") && text.includes("script-src 'self'")) return;
  errors.push('console: ' + text);
});
page.on('requestfailed', function(request) {
  errors.push('requestfailed: ' + request.url() + ' - ' + request.failure()?.errorText);
});
page.on('response', function(response) {
  if (response.status() >= 400) errors.push('http ' + response.status() + ': ' + response.url());
});

try {
  const response = await page.goto(baseUrl, { waitUntil: 'networkidle' });
  if (!response || response.status() !== 200) throw new Error('首页未返回 200');
  await page.waitForFunction(function() {
    return document.querySelectorAll('.sticker-thumb').length === 24;
  });

  const stickerCount = await page.locator('.sticker-thumb').count();
  if (stickerCount !== 24) throw new Error('贴纸数量不是 24');
  await page.locator('.sticker-thumb').first().click();
  await page.locator('#stickerColorTrigger').click();
  const colorCount = await page.locator('.sticker-color-option').count();
  if (colorCount !== 24) throw new Error('颜色数量不是 24');
  await page.locator('.sticker-color-option').nth(5).click();

  await page.getByRole('button', { name: '相框' }).click();
  const frameCount = await page.locator('.sticker-thumb').count();
  if (frameCount !== 42) throw new Error('相框栏数量不是 41 + 无相框');
  const sssFrame = page.locator('.sticker-thumb').filter({ hasText: 'SSS' });
  if (await sssFrame.count() !== 1) throw new Error('未找到 F37 SSS');
  await sssFrame.click();

  await page.locator('#fileInput').setInputFiles(path.join(root, 'assets', 'library', 'frames', 'F02.png'));
  await page.waitForFunction(function() {
    return !document.getElementById('btnDownload').disabled;
  });

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#btnDownload').click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const firstChunk = await new Promise(function(resolve, reject) {
    stream.once('data', resolve);
    stream.once('error', reject);
  });
  if (!Buffer.from(firstChunk).subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    throw new Error('导出文件不是 PNG');
  }

  const directAsset = await page.request.get(baseUrl + '/assets/library/frames/F37.png');
  if (![403, 404].includes(directAsset.status())) throw new Error('公开原图路径没有被隐藏');
  if (errors.length) throw new Error(errors.join('\n'));

  console.log('浏览器回归通过：24 个贴纸、41 个相框、24 色、F37、上传、换色及 PNG 导出均正常。');
} finally {
  await browser.close();
}
