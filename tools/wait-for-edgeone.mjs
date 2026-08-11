const baseUrl = process.env.SMOKE_BASE_URL;
const expectedCommit = process.env.EXPECTED_COMMIT;

if (!baseUrl) throw new Error('EDGEONE_SMOKE_URL secret is not configured');
if (!expectedCommit) throw new Error('EXPECTED_COMMIT is not configured');

const buildUrl = new URL('/build.json', baseUrl);
const sourceUrl = new URL(baseUrl);
for (const [key, value] of sourceUrl.searchParams) buildUrl.searchParams.set(key, value);

let deployed = false;
for (let attempt = 1; attempt <= 20; attempt += 1) {
  try {
    const response = await fetch(buildUrl, { cache: 'no-store', redirect: 'follow' });
    if (response.ok) {
      const build = await response.json();
      if (build.commit === expectedCommit) {
        console.log('EdgeOne 已部署目标提交：' + expectedCommit.slice(0, 8));
        deployed = true;
        break;
      }
    }
  } catch (error) {
    console.log('等待 EdgeOne：' + error.message);
  }
  if (attempt < 20) await new Promise(function(resolve) { setTimeout(resolve, 15000); });
}

if (!deployed) throw new Error('EdgeOne 未在 5 分钟内发布目标提交：' + expectedCommit);
