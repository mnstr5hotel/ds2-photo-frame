# DS2 Photo Web 交接报告

交接日期：2026-08-11

## 当前结论

项目已切换为纯静态 GitHub Pages 网站。Next.js、Cloudflare Worker、Docker、HMAC 素材令牌、会话 Cookie 和 EdgeOne 发布链路不再属于正式方案。网页、素材目录与原图均公开；用户照片和导出过程仍完全留在浏览器本地。

## 当前功能

- 固定 `2560×1440` PNG 合成与黑色背景。
- 一张照片、一个相框、最多两个贴纸。
- 照片移动、缩放、旋转、重置和吸附。
- 贴纸移动、缩放、旋转、上下层级和 24 色换色。
- 41 张相框、24 张去重贴纸、24 种颜色。
- 中英文素材名称与界面文案。
- 撤销、重做、HEIC/HEIF、本地降采样和响应式触控。
- 非官方非商业免责声明。

## 运行与验证

```powershell
npm.cmd ci
npm.cmd run check
npm.cmd run build
npm.cmd run start
```

本地地址为 `http://127.0.0.1:4174/`。`dist-pages/` 是生成目录，不提交 Git。

浏览器回归：

```powershell
$env:SMOKE_BASE_URL='http://127.0.0.1:4174/'
$env:SMOKE_EXPECT_PUBLIC_ASSETS='true'
npm.cmd run smoke
```

## 自动发布

`.github/workflows/pages.yml` 监听 `main`，依次执行检查、静态构建、Pages 部署和线上浏览器回归。默认公开地址：

`https://2075570039-star.github.io/ds2-photo-frame/`

## 素材规则

- 网页目录由 `tools/build-static.mjs` 根据 `assets/asset-index.json` 生成。
- 原图输出到 `assets/library/`，缩略图输出到 `assets/thumbnails/`。
- `S04`、`S14`、`S16` 不在网页索引中，本地文件保留。
- 更新素材后必须执行 `npm run check`，确保尺寸、名称和 SHA-256 一致。

## 已知限制

1. 静态发布无法阻止素材下载。
2. `github.io` 在中国大陆无法保证稳定访问。
3. 页面不保存工程，刷新会清除照片、编辑状态和历史。
4. 素材版权与商标风险仍需持续关注，免责声明不构成授权。
