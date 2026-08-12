# DEATH STRANDING 2 PHOTO SIMULATOR 后续维护交接

交接日期：2026-08-12
交接基线：`main` / `49bb681` 及本次文档更新

## 1. 正式项目入口

- 产品英文名：`DEATH STRANDING 2 PHOTO SIMULATOR`
- 固定中文副标题：`死亡搁浅2照片模拟器`
- GitHub 仓库：`mnstr5hotel/ds2-photo-simulator`
- 正式网站：`https://mnstr5hotel.github.io/ds2-photo-simulator/`
- 本地目录：`D:\File D\projects_\vscode new\DS photo web`
- 正式分支：`main`
- 托管方式：公开 GitHub 仓库 + GitHub Actions + GitHub Pages

仓库名和 Pages 路径使用小写连字符 `ds2-photo-simulator`；页面标题、应用名称和分享标题统一使用全大写英文产品名。

## 2. 当前架构

这是纯静态浏览器应用。正式运行链路为：

1. `site/` 保存 HTML、CSS、JavaScript、Service Worker 和本地 HEIC 转换库。
2. `assets/asset-index.json` 与调色板文件作为构建输入。
3. `tools/build-static.mjs` 复制页面与发布素材，生成 `dist-pages/` 和 `assets/catalog.json`。
4. GitHub Actions 对 `main` 执行 `npm ci`、`npm run check`、`npm run build`。
5. `actions/deploy-pages` 将 `dist-pages/` 发布到 GitHub Pages。

正式版本不依赖 Next.js、EdgeOne、Cloudflare Worker、数据库、登录、Cookie、服务端素材路由或运行时第三方 CDN。用户上传照片只在本地浏览器内解码和合成。

## 3. 已交付功能

- 逻辑画布和导出尺寸固定为 `2560 × 1440`，导出格式为 PNG。
- 支持一张照片、一个相框和最多两个贴纸。
- 照片支持上传/更换、拖动、缩放、90 度旋转、重置、居中、边缘吸附和 `50%–150%` 亮度。
- 普通 JPEG、PNG、WebP 不主动有损压缩；最长边超过 5120 像素时才降采样。
- HEIC/HEIF 在浏览器内转换为 JPEG，质量参数为 0.95。
- 相框固定铺满画面；黑色相框在无照片时仍可通过预览底色辨认。
- 贴纸支持拖动、缩放、旋转、删除、相框上下层级和 24 色换色；默认色为 `SnowWhite`。
- 撤销/重做最多 30 步，连续手势会合并历史记录。
- 支持中英文界面，以及相框、贴纸、颜色的中英文官方名称。
- 桌面端和竖屏移动端均有独立适配；照片调整模式也有完整工具栏。
- 页面其他区域可取消贴纸选中；调整贴纸时不会重建左侧素材列表。
- 页面纹理位于界面底层，不覆盖画布、相框或照片。

## 4. 素材合同

网页当前必须保持：

- 41 个相框
- 24 个可选贴纸
- 24 种贴纸颜色
- 4 张左栏环境装饰图

关键目录：

- `assets/asset-index.json`：网页素材主索引，包含 ID、尺寸、中英文名称、来源信息和 SHA-256。
- `assets/library/`：41 个相框和 27 个贴纸的原始 PNG；保留源文件，不代表全部进入网页。
- `assets/optimized/`：导出阶段使用的高清透明 WebP。
- `assets/previews/`：选中素材后优先加载的轻量预览 WebP。
- `assets/thumbnails/`：左侧素材栏使用的 WebP 缩略图。
- `assets/logo-color-palette.json`：24 色调色板和中英文颜色名。

`S04`、`S14`、`S16` 是重复贴纸衍生项，只从 `asset-index.json` 和实际网页选择列表中排除；不得删除 `assets/library/` 中的本地原始文件。其历史缩略图目前也保留。

新增或替换素材时，必须同时处理原图、optimized、preview、thumbnail、索引、中英文名称和 SHA-256，再运行发布前检查。不要用近似图标、手绘文字或拉伸局部纹理替代正式素材。

## 5. 加载与缓存策略

- 左栏首批可见缩略图优先加载，其余懒加载。
- 悬停或键盘聚焦素材时进行低优先级预取。
- 点击相框或贴纸后，画布先请求 `assets/previews/`，避免等待高清素材。
- 最终导出时只为当前正在使用的素材请求 `assets/optimized/` 高清版本。
- 同一素材请求复用内存缓存，避免重复创建图片请求。
- `site/sw.js` 使用 `ds2-photo-simulator-v1` 缓存：图片缓存优先，JS/CSS/JSON 网络优先。

若再次反馈“点击素材仍慢”，先用浏览器 Network 面板区分 DNS/连接等待、文件下载、图片解码和 Canvas 换色耗时。GitHub Pages 在中国大陆的连通性波动无法仅靠前端代码彻底解决。

## 6. 关键文件

- `site/index.html`：页面结构、标题和站点元信息。
- `site/style.css`：桌面/移动布局、视觉效果与工具栏。
- `site/app.js`：状态、渲染、交互、素材加载、照片处理和导出。
- `site/lang.js`：中英文界面文本。
- `site/sw.js`：静态资源缓存策略；发布资源策略变化时应递增缓存版本。
- `tools/preflight.mjs`：素材完整性、安全边界和语言键检查。
- `tools/browser-smoke.mjs`：浏览器端完整回归。
- `.github/workflows/pages.yml`：GitHub Pages 构建和部署。
- `FRONTEND_BASELINE.md`：不可随意破坏的交互与视觉合同。
- `PROJECT_SUMMARY.md`：本轮从素材整合到正式发布的完整过程总结。

## 7. 本地验证

环境要求：Node.js 22；浏览器回归默认调用本机 Microsoft Edge，依赖 Playwright。

```powershell
npm.cmd install
npm.cmd run check
npm.cmd run build
npm.cmd run start
```

本地地址默认为 `http://127.0.0.1:4174/`。完整本地回归：

```powershell
$env:SMOKE_BASE_URL='http://127.0.0.1:4174/'
$env:SMOKE_EXPECT_PUBLIC_ASSETS='true'
npm.cmd run smoke
```

线上回归：

```powershell
$env:SMOKE_BASE_URL='https://mnstr5hotel.github.io/ds2-photo-simulator/'
$env:SMOKE_EXPECT_PUBLIC_ASSETS='true'
npm.cmd run smoke
```

通过标准：24 个贴纸、41 个相框、24 色、F37、上传、换色和 PNG 导出均正常。

## 8. 发布流程

1. 从最新 `main` 创建 `codex/<说明>` 分支。
2. 只修改任务范围内文件，检查 `git diff`。
3. 运行 `npm.cmd run check`、`npm.cmd run build` 和本地 smoke。
4. 明确提交并推送分支，创建 PR。
5. 等待 PR 的 `build` 通过；PR 中 `deploy` 跳过属于正常行为。
6. 合并到 `main` 后等待 `Deploy GitHub Pages` 的 build 和 deploy 均成功。
7. 在线上正式地址运行 smoke，并核对本次直接修改的 UI/元信息。
8. 将本地切回 `main`，执行 `git pull --ff-only origin main`，确认工作树干净。

只修改 README 等不在 workflow `paths` 范围内的文档时不会自动部署，这是现有降噪设计。

## 9. 已知限制和风险

1. GitHub Pages 是公开静态托管，源码和发布素材可被访问者下载；前端无法提供真正的素材保密。
2. `github.io` 免费地址的根域固定，只有项目路径可通过仓库名改变；独立域名需要自行注册并绑定。
3. 中国大陆访问 GitHub Pages 的速度和稳定性不可控。
4. 页面不保存工程文件；刷新后当前编辑内容丢失，但有未导出改动时会提示离开。
5. 免责声明不等于版权授权，素材、名称和商标风险需持续关注。
6. GitHub Actions 当前会提示部分官方 Pages Action 使用 Node 20 的弃用警告，但 2026-08-12 的构建和部署均成功；后续应关注官方 Action 新版本，不要把警告误判为项目失败。
7. `browser-smoke.mjs` 验证主要闭环，但尚未覆盖全部移动端手势、亮度数值和每一种素材的像素级结果。

## 10. 历史过程文件

以下本地目录已被 `.gitignore` 排除，不属于当前源码或发布输入：

- `.next/`
- `.next-edgeone/`
- `.next-node/`
- `.wrangler/`
- `dist/`
- `.tools/`
- `node_modules/`
- `dist-pages/`（当前静态构建产物，可随时重新生成）

其中 `.next*`、`.wrangler/`、`dist/` 和 `.tools/` 是旧 Next.js、EdgeOne、Cloudflare 或调试阶段的过程产物；确认无需回溯旧方案后可清理。`node_modules/` 与 `dist-pages/` 可删除后重建。

## 11. 接手后的第一轮检查

1. 阅读本文件、`PROJECT_SUMMARY.md` 和 `FRONTEND_BASELINE.md`。
2. 检查 `git status -sb`、远程仓库和当前分支。
3. 运行 check、build、local smoke。
4. 打开正式网站，确认标题为 `DEATH STRANDING 2 PHOTO SIMULATOR`，中文副标题为 `死亡搁浅2照片模拟器`。
5. 随机验证黑色相框、贴纸换色、照片亮度、竖屏工具栏和 2560 × 1440 PNG 导出。
6. 改素材前先核对原始素材交接目录：`D:\File D\projects_\DS2网页素材交接-2026-08-10`。
