# DS2 Photo Web 后续维护交接档案

交接日期：2026-08-11

## 当前状态

项目已经进入可正式使用状态，当前正式方案是公开 GitHub 仓库 + GitHub Pages 静态部署。

- 线上地址：`https://mnstr5hotel.github.io/ds2-photo-frame/`
- GitHub 仓库：`mnstr5hotel/ds2-photo-frame`
- 本地路径：`D:\File D\projects_\vscode new\DS photo web`
- 当前分支：`main`
- 部署方式：推送到 `main` 后由 GitHub Actions 构建并发布到 GitHub Pages

项目不再使用 Next.js、EdgeOne 直传、Cloudflare Worker、Docker、HMAC 素材令牌、会话 Cookie 或服务端图片路由。网页、素材目录、缩略图、相框、贴纸和颜色配置均作为公开静态文件发布。

## 产品功能

- 固定导出 `2560 x 1440` PNG。
- 一张照片、一个相框、最多两个贴纸。
- 照片支持移动、缩放、90 度旋转、重置、居中和边缘吸附。
- 贴纸支持移动、缩放、旋转、上下层级、删除和 24 色换色。
- 当前网页展示 41 个相框、24 个贴纸、24 种颜色。
- 支持中英文界面和中英文素材名称。
- 左上角固定中文副标题为 `死亡搁浅拍照模式`，不随语言切换变化。
- 用户照片只在浏览器本地处理，不上传到任何项目服务器。

## 素材与目录

- `assets/asset-index.json` 是素材主索引，包含尺寸、分类、路径、名称和 SHA-256。
- `assets/library/` 保存公开原图。
- `assets/optimized/` 保存网页实际加载的透明 WebP 素材；原始 PNG 不直接进入网页请求。
- `assets/previews/` 保存点击后优先加载的 1280 边长预览 WebP；导出 PNG 时才按当前选择加载 `assets/optimized/` 高清素材。
- `assets/thumbnails/` 保存公开 WebP 缩略图。
- `assets/logo-color-palette.json` 保存 24 色贴纸调色板。
- `site/` 是实际发布的静态网页源码。
- `tools/build-static.mjs` 根据素材索引生成 `dist-pages/`。

重复贴纸 `S04`、`S14`、`S16` 不进入网页目录，但本地原始文件保留。

## 加载优化

当前已做一轮 GitHub Pages 静态素材加载优化：

- 点击素材时加载 `assets/optimized/` 中的透明 WebP；65 个网页素材约 7.42 MiB，相比对应原始 PNG 约减少 54.7%。
- 点击素材时首先加载 `assets/previews/`；65 个预览素材约 2.16 MiB，相比原始 PNG 约减少 86.8%，预览不再等待 2560×1440 高清相框下载。
- 左侧素材栏前 10 个可见缩略图优先加载，其余缩略图懒加载。
- 鼠标悬停或键盘聚焦素材时，低优先级预取原图。
- 点击使用相框或贴纸时，只创建一个高优先级图片请求，并使用异步解码；不再额外插入重复的 `preload` 请求。
- 导出时仅为当前相框和贴纸加载高清 WebP，避免无关素材参与等待。
- `site/sw.js` 使用版本化同源静态资源缓存：图片和缩略图缓存优先，JS/CSS/JSON 网络优先。

这能改善重复访问和点击后的等待时间，但不能解决中国大陆直连 `github.io` 的基础网络波动。

## GitHub Actions

当前 workflow：`.github/workflows/pages.yml`

触发条件：

- `main` 分支中以下路径变化才触发：
  - `.github/workflows/pages.yml`
  - `assets/**`
  - `site/**`
  - `tools/**`
  - `package.json`
  - `package-lock.json`
- 可手动 `workflow_dispatch` 触发。

当前 job：

- `build`：执行 `npm ci`、`npm run check`、`npm run build`。
- `deploy`：发布 `dist-pages/` 到 GitHub Pages。

线上 `smoke` job 已移除，原因是 GitHub Pages/CDN 刷新时序会制造噪音失败邮件。后续如需完整浏览器回归，请在本地或手动环境运行。

## 本地验证

推荐维护前后都执行：

```powershell
npm.cmd run check
npm.cmd run build
```

本地预览：

```powershell
npm.cmd run start
```

默认地址：

```text
http://127.0.0.1:4174/
```

完整本地浏览器回归：

```powershell
$env:SMOKE_BASE_URL='http://127.0.0.1:4174/'
$env:SMOKE_EXPECT_PUBLIC_ASSETS='true'
npm.cmd run smoke
```

## 发布流程

1. 修改 `site/`、`assets/`、`tools/` 或配置。
2. 执行 `npm.cmd run check`。
3. 执行 `npm.cmd run build`。
4. 需要浏览器级验证时，启动本地服务并执行 `npm.cmd run smoke`。
5. 提交并推送 `main`。
6. GitHub Actions 自动构建并部署到 GitHub Pages。

## 已知限制

1. GitHub Pages 免费方案要求公开仓库，源码和素材文件均可被访问者下载。
2. 静态前端无法真正阻止素材获取，只能降低误用便利性。
3. `github.io` 在中国大陆访问速度和稳定性不可控。
4. 页面不保存工程文件，刷新会清空当前照片、贴纸、相框、编辑历史。
5. 版权、商标和素材使用风险仍需持续关注；免责声明不等于授权。

## 后续建议

- 若主要面向中国大陆用户，后续可考虑购买域名并迁移到腾讯云 EdgeOne、腾讯 COS + CDN 或阿里云 OSS + CDN。
- 若继续使用 GitHub Pages，优先做进一步的请求合并、缩略图压缩和更细粒度懒加载。
- 每次新增素材后，务必更新素材索引、缩略图、中英文名称、SHA-256，并通过 `npm.cmd run check`。
