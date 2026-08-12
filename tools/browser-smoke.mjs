import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '..');
const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:4174';
const expectPublicAssets = process.env.SMOKE_EXPECT_PUBLIC_ASSETS === 'true';
const isSitesProduction = new URL(baseUrl).hostname.endsWith('.chatgpt.site');
const executablePath = process.env.BROWSER_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browser = await chromium.launch({ executablePath: executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];

async function verifyMobileToolbar(width, height) {
  const context = await browser.newContext({
    viewport: { width: width, height: height },
    hasTouch: true,
    serviceWorkers: 'block',
  });
  const mobilePage = await context.newPage();
  try {
    await mobilePage.goto(baseUrl, { waitUntil: 'networkidle' });
    await mobilePage.waitForFunction(function() {
      return document.querySelectorAll('.sticker-thumb').length === 24;
    });

    const thumbnailPriorities = await mobilePage.locator('.sticker-thumb img').evaluateAll(function(images) {
      return images.slice(0, 5).map(function(image) {
        return { loading: image.loading, priority: image.fetchPriority };
      });
    });
    if (thumbnailPriorities.slice(0, 4).some(function(item) { return item.priority !== 'high'; })) {
      throw new Error(width + 'x' + height + ' 的前 4 张缩略图未设为高优先级');
    }
    if (thumbnailPriorities[4].priority !== 'low' || thumbnailPriorities[4].loading !== 'lazy') {
      throw new Error(width + 'x' + height + ' 的后续缩略图未进入低优先级懒加载');
    }

    await mobilePage.locator('.sticker-thumb').first().click();
    await mobilePage.waitForFunction(function() {
      return !document.getElementById('editToolbar').hidden;
    });
    await mobilePage.waitForTimeout(250);
    const layout = await mobilePage.evaluate(function() {
      const toolbar = document.getElementById('editToolbar').getBoundingClientRect();
      const canvas = document.getElementById('mainCanvas').getBoundingClientRect();
      const controls = document.querySelector('.canvas-control-row').getBoundingClientRect();
      const history = document.querySelector('.history-controls').getBoundingClientRect();
      return {
        toolbarVisible: toolbar.top >= 0 && toolbar.bottom <= window.innerHeight,
        toolbarBelowCanvas: controls.top >= canvas.bottom,
        toolbarContained: toolbar.top >= controls.top && toolbar.bottom <= controls.bottom,
        historyBelowToolbar: history.top >= toolbar.bottom && history.bottom <= controls.bottom,
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
      };
    });
    if (!layout.toolbarVisible) throw new Error(width + 'x' + height + ' 的编辑工具栏未完整进入视口');
    if (!layout.toolbarBelowCanvas) throw new Error(width + 'x' + height + ' 的编辑工具栏未位于预览框下方');
    if (!layout.toolbarContained) throw new Error(width + 'x' + height + ' 的编辑工具栏被父级操作区裁切');
    if (!layout.historyBelowToolbar) throw new Error(width + 'x' + height + ' 的撤销重做按钮未位于编辑工具栏下方');
    if (layout.horizontalOverflow) throw new Error(width + 'x' + height + ' 出现横向溢出');

    await mobilePage.locator('#stickerColorTrigger').click();
    const colorMenu = await mobilePage.locator('#stickerColorMenu').evaluate(function(menu) {
      const rect = menu.getBoundingClientRect();
      return {
        open: !menu.hidden && menu.children.length === 24 && rect.width > 0 && rect.height > 0,
        contained: rect.left >= 0 && rect.right <= window.innerWidth && rect.top >= 0 && rect.bottom <= window.innerHeight,
      };
    });
    if (!colorMenu.open) throw new Error(width + 'x' + height + ' 的贴纸颜色菜单未正确展开');
    if (!colorMenu.contained) throw new Error(width + 'x' + height + ' 的贴纸颜色菜单超出视口');
  } finally {
    await context.close();
  }
}

async function verifyWarmRequestUpgrade() {
  const context = await browser.newContext({
    viewport: { width: 1024, height: 768 },
    serviceWorkers: 'block',
  });
  const warmPage = await context.newPage();
  const previewPattern = '**/assets/previews/stickers/S17_kojima-productions-1.webp';
  let requestCount = 0;
  let resolveWarmRequest;
  const warmRequestSeen = new Promise(function(resolve) { resolveWarmRequest = resolve; });

  await warmPage.route(previewPattern, async function(route) {
    requestCount += 1;
    if (requestCount === 1) {
      resolveWarmRequest();
      await new Promise(function(resolve) { setTimeout(resolve, 1000); });
      await route.continue().catch(function() {});
      return;
    }
    await route.continue();
  });

  try {
    await warmPage.goto(baseUrl, { waitUntil: 'networkidle' });
    await warmPage.waitForFunction(function() {
      return document.querySelectorAll('.sticker-thumb').length === 24;
    });
    const target = warmPage.locator('.sticker-thumb').nth(12);
    await target.hover();
    await Promise.race([
      warmRequestSeen,
      new Promise(function(_, reject) {
        setTimeout(function() { reject(new Error('未触发桌面端低优先级素材预热')); }, 3000);
      }),
    ]);
    await target.click();
    await warmPage.waitForFunction(function() {
      return window.__dsStatusKey === 'status_ready';
    });
    if (requestCount !== 2) throw new Error('点击素材时未取消预热并重新发起交互请求');
  } finally {
    await context.close();
  }
}

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

  const directAssetUrl = new URL('assets/optimized/frames/F37.webp', baseUrl);
  const directAsset = await page.request.get(directAssetUrl.href);
  const directAssetType = directAsset.headers()['content-type'] || '';
  const directAssetIsImage = directAsset.ok() && directAssetType.startsWith('image/');
  if (expectPublicAssets && !directAssetIsImage) {
    throw new Error('静态素材路径不可用');
  }
  if (!expectPublicAssets && directAssetIsImage) {
    throw new Error('公开原图路径没有被隐藏');
  }
  const previewAssetUrl = new URL('assets/previews/frames/F37.webp', baseUrl);
  const previewAsset = await page.request.get(previewAssetUrl.href);
  const previewAssetType = previewAsset.headers()['content-type'] || '';
  if (expectPublicAssets && (!previewAsset.ok() || !previewAssetType.startsWith('image/'))) {
    throw new Error('预览素材路径不可用');
  }
  for (const viewport of [[320, 480], [320, 568], [360, 640], [375, 667], [393, 743], [390, 844], [430, 932], [667, 375]]) {
    await verifyMobileToolbar(viewport[0], viewport[1]);
  }
  await verifyWarmRequestUpgrade();
  if (errors.length) throw new Error(errors.join('\n'));

  console.log('浏览器回归通过：素材数量、上传、换色、PNG 导出、移动工具栏及素材请求优先级均正常。');
} finally {
  await browser.close();
}
