# DS photo web

可部署到 OpenAI Sites 或独立 Node/Docker 主机的 DS2 照片合成工具。页面编辑、照片处理和 PNG 导出全部在浏览器中完成；Next.js 运行层只负责页面、精简素材目录和受保护的只读图片响应，不接收用户照片。

## 本地运行

首次运行先安装锁定依赖，然后启动开发服务器：

```powershell
npm.cmd ci
npm.cmd run dev -- --hostname 127.0.0.1 --port 4173
```

访问 `http://127.0.0.1:4173/`。发布前执行：

```powershell
npm.cmd run check
npm.cmd run build
```

生产构建由 vinext 生成 `dist/server/index.js` Cloudflare Worker 入口，随后 `tools/harden-dist.mjs` 只把索引中的 65 项素材复制到内部 Assets 绑定路径，并验证 Worker 优先路由和运行包。素材文件不会绕过受保护媒体路由直接公开。

`npm.cmd run smoke` 默认对 `http://127.0.0.1:4174` 执行 Edge 无界面回归，也可通过 `SMOKE_BASE_URL` 和 `BROWSER_PATH` 指定目标。

## 合成规则

- 合成尺寸固定为 2560 x 1440，导出为 PNG，背景固定为黑色。
- 每次仅允许一张照片、一个相框和最多两个贴纸。
- 相框固定铺满画面；贴纸可在相框上方或下方，默认位于相框下方。
- 照片默认居中铺满，可独立移动、缩放、按 90 度旋转，并吸附到中心轴和画面边缘。
- 照片和贴纸选中时显示示廓框，可从四个角端等比缩放；示廓框不会进入导出结果。
- 照片调整模式会暂时隐藏相框和贴纸；退出后恢复，不会删除素材。
- 撤销和重做最多保留 30 步。所有照片处理与合成都只在当前浏览器中进行。

## 编辑、吸附与颜色

- 拖动贴纸靠近画布水平或垂直中心 24 个逻辑像素内时，会吸附到对应的 X/Y 中心轴并显示参考线。
- 照片同时支持 X/Y 中心轴与画面四边吸附。
- 拖动旋转手柄靠近 0°、90°、180°、270° 的 6° 范围内时，会吸附到直角方向。
- 每个贴纸可独立使用游戏中的 24 色调色板，新贴纸默认使用“雪白”或 `Snow White`。
- 换色遵循游戏的逐分量乘色规则并保留源贴纸 alpha；预览和 PNG 导出使用同一结果。
- 吸附参考线和选中框仅用于编辑，不会写入导出的 PNG。

## 项目结构与素材库

- `site/`：浏览器端 HTML、CSS、JavaScript、HEIC 模块和 favicon。
- `app/`：OpenAI Sites 使用的页面、目录和媒体路由。
- `server/`：素材目录裁剪、不可猜测媒体令牌和短时会话校验。
- `assets/asset-index.json`：仅供服务端读取的 65 项完整素材索引。
- `assets/library/`：非公开静态目录中的原始透明 PNG。
- `assets/thumbnails/`：非公开静态目录中的 WebP 缩略图。
- `tools/`：素材完整性检查和浏览器回归。
- `Dockerfile`、`DEPLOY_CN.md`：独立 Node 容器和中国大陆访问部署说明。

网页启动时通过 `/api/catalog` 读取只含显示必需字段的目录，不会一次解码全部高清素材。素材面板按需加载缩略图，用户选中某项后才加载对应原始 PNG。切换界面语言时，贴纸、相框、已选素材和颜色菜单会同步读取官方中英文名称。

更新正式素材时，应同时更新原始 PNG、索引中的尺寸及 SHA-256，并重新生成同路径缩略图。相框仍需保持 `2560×1440 RGBA PNG`；缩略图不能代替正式素材参与导出。

## 防护边界

- 原图、缩略图和四张背景装饰不再由可枚举的公开目录提供；媒体 URL 使用服务端 HMAC 令牌。
- 素材目录和媒体请求使用短时、HttpOnly、SameSite 会话 Cookie；浏览器提供 Fetch Metadata 时额外要求同源，明确的跨站盗链会被拒绝。
- 浏览器拿到的目录不包含 SHA-256、真实文件路径、素材来源等级、解包配置对象 ID 或本地文件名。
- 全站返回严格 CSP、`frame-ancestors 'none'`、CORP、COOP、HSTS、Permissions Policy、`nosniff` 等响应头；服务端没有写接口。
- 上传文件限制为 50 MB，换色 Canvas 缓存最多保留 16 项，降低浏览器内存滥用风险。

这些措施用于阻止直接路径访问、普通跨站盗链和低成本批量枚举，不是 DRM。公开网页必须把被使用的像素发送到访问者浏览器，因此具备技术能力的访问者仍可从浏览器响应中取得已加载素材。若需要真正控制下载，应改为登录授权、限流 CDN、按用户水印或不公开原图。

## OpenAI Sites 部署准备

- `.openai/hosting.json` 已绑定既有 Sites 项目；不要重新创建站点或修改其中的 `project_id`。
- Sites 生产环境已将随机 `DS_ASSET_SECRET` 保存为 Secret；不能把该值写入源码、`.env` 或提交记录，轮换后需要重新部署版本。
- Sites 访问策略已切换为公开；真实 Edge 浏览器已验证无需 ChatGPT 登录即可载入和使用。
- 当前公开生产版本为 Sites 版本 3：`https://death-stranding-2-photo-frame.docile-mite-7384.chatgpt.site`。
- Sites 版本是不可变快照；更新网站时保存并部署新版本，旧版本不会被原地覆盖。
- 站点虽已公开，仍须持续确认游戏素材、商标和图像授权范围；免责声明不等于取得授权。

## 中国大陆访问

`chatgpt.site` 不应被视为中国大陆稳定入口。项目已提供独立 Node/Docker 生产构建；大陆正式方案需要独立域名、境内云主机和 ICP 备案，无备案时可先使用香港或新加坡节点，但无法保证跨境线路稳定。具体步骤见 `DEPLOY_CN.md`。

- Cloudflare 免费 Worker 已发布到 `https://ds2-photo-frame.ds2-photo-tools.workers.dev`，不依赖 ChatGPT 登录。
- 当前大陆网络实测将该 `workers.dev` 域名解析到 `202.160.130.145`，HTTPS 连接立即失败；该地址仅保留为海外免费入口，不能作为中国大陆可用方案。
- Wrangler 配置明确启用正式 `workers.dev` 路由并关闭逐版本 Preview URL，减少不必要的可访问入口。

## 当前素材状态

- 网页当前展示 41 张相框和 24 张贴纸，共 65 项。
- `S04`、`S14`、`S16` 与保留项内容重复，已从服务端索引移除；对应本地原图和缩略图继续保留。
- 29 张相框标记为 `validated-final`，其中包含新增的 F37 `SSS`。
- F11–F20、F23、F24 共 12 张相框标记为 `temporary-v1-manual-promotion`，当前正常展示但保留来源等级。
- 网页展示的 24 张贴纸均标记为 `final-sticker`。

## 背景装饰

`assets/backgrounds/` 内有四张透明 PNG。网页每次完整载入时随机选择一张，作为左侧素材栏的低透明度装饰。它们没有交互，不参与 Canvas 合成，也不会进入导出图片。
