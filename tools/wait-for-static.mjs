const baseUrl = process.env.SMOKE_BASE_URL;
if (!baseUrl) throw new Error('SMOKE_BASE_URL is not configured');

const catalogUrl = new URL('assets/catalog.json', baseUrl);
for (let attempt = 1; attempt <= 20; attempt += 1) {
  try {
    const response = await fetch(catalogUrl, { cache: 'no-store' });
    if (response.ok) {
      const catalog = await response.json();
      const frames = catalog.items.filter(function(item) { return item.category === 'frame'; }).length;
      const stickers = catalog.items.filter(function(item) { return item.category === 'sticker'; }).length;
      if (frames === 41 && stickers === 24 && catalog.colors.length === 24) {
        console.log('GitHub Pages 静态素材目录已就绪。');
        process.exitCode = 0;
        break;
      }
    }
  } catch (error) {
    console.log('等待静态站点：' + error.message);
  }
  if (attempt === 20) throw new Error('静态站点未在 100 秒内就绪');
  await new Promise(function(resolve) { setTimeout(resolve, 5000); });
}
