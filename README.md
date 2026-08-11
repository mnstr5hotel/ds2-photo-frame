# DS2 Photo Frame

《死亡搁浅 2》风格照片合成工具。网页、素材目录、贴纸、相框和颜色配置全部作为静态文件运行；用户照片、编辑状态和 PNG 导出始终留在浏览器中，不会上传到服务器。

公开地址：`https://2075570039-star.github.io/ds2-photo-frame/`

## 本地运行

```powershell
npm.cmd ci
npm.cmd run check
npm.cmd run build
npm.cmd run start
```

打开 `http://127.0.0.1:4174/`。另开终端执行完整浏览器回归：

```powershell
$env:SMOKE_BASE_URL='http://127.0.0.1:4174/'
$env:SMOKE_EXPECT_PUBLIC_ASSETS='true'
npm.cmd run smoke
```

## GitHub Pages 发布

`.github/workflows/pages.yml` 在 `main` 更新时自动完成：

1. 安装锁定依赖并检查脚本、语言键、素材数量、尺寸和 SHA-256。
2. 将网页与公开素材打包到 `dist-pages/`。
3. 通过 GitHub Pages 部署静态产物。
4. 等待线上素材目录可用，再执行上传、换色、相框、贴纸和 PNG 导出回归。

GitHub Free 的 Pages 需要公开仓库，因此源码和素材文件都可被访问和下载。本项目不再使用 HMAC 媒体令牌、会话 Cookie、服务端图片路由、EdgeOne Secret、Next.js、Cloudflare Worker 或 Docker 生产入口。

## 功能规则

- 合成与导出尺寸固定为 `2560×1440` PNG，背景为黑色。
- 一张照片、一个相框、最多两个贴纸。
- 相框固定铺满；贴纸可位于相框上方或下方。
- 照片支持移动、缩放、90°旋转、中心轴和边缘吸附。
- 贴纸支持移动、缩放、旋转、层级切换和游戏内 24 色换色，默认雪白色。
- 撤销和重做最多保留 30 步。
- JPEG、PNG、WebP、HEIC/HEIF 均在浏览器本地处理。

## 项目结构

- `site/`：HTML、CSS、JavaScript、语言文件和 HEIC 浏览器模块。
- `assets/library/`：公开原始 PNG。
- `assets/thumbnails/`：公开 WebP 缩略图。
- `assets/backgrounds/`：左侧素材栏随机装饰。
- `assets/asset-index.json`：本地完整素材索引。
- `tools/build-static.mjs`：生成精简公开目录和 Pages 产物。
- `tools/preflight.mjs`：素材及前端一致性检查。
- `tools/browser-smoke.mjs`：浏览器功能回归。

当前网页展示 41 张相框、24 张贴纸和 24 种颜色。重复贴纸 `S04`、`S14`、`S16` 不进入网页目录，但本地原始文件继续保留。

## 权利与隐私

这是非官方、非商业粉丝项目，与 KOJIMA PRODUCTIONS、Sony Interactive Entertainment 或其关联方无隶属、授权或背书关系。相关名称、商标、图像和游戏素材的权利归各自权利人所有；免责声明不等于取得授权。

静态发布意味着访问者可以直接下载网站素材。网页不会收集或上传用户选择的照片，但 GitHub Pages 会按照其服务规则处理访问日志。
