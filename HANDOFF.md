# DS Photo Web 交接报告

交接日期：2026-08-11
项目目录：`D:\File D\projects_\vscode new\DS photo web`

## 1. 交接结论

本项目已从早期照片贴纸原型整理为面向 OpenAI Sites 的《死亡搁浅 2》风格照片合成工具。核心合成、照片编辑、贴纸与相框约束、移动端触控、撤销/重做、本地 HEIC、固定 16:9 导出、响应式 UI 和受保护素材路由均已完成。

2026-08-11 已接入新增相框 F37 `SSS`。完整素材库现为 41 张相框、27 张贴纸，共 68 个本地原文件；网页素材栏去除 3 个重复贴纸后展示 41 张相框、24 张贴纸，共 65 项，并使用“缩略图浏览、选中后加载高清 PNG”的按需策略。

## 2. 当前成果

### 合成与导出

- 固定逻辑画布及导出尺寸：`2560 x 1440`。
- 固定 PNG 黑色背景，源照片 EXIF/GPS 不进入导出文件。
- 图层顺序：背景、照片、相框下贴纸、相框、相框上贴纸。
- 一张照片、一个相框、最多两个贴纸。
- 相框固定铺满且自动替换；贴纸默认在相框下，可切换到相框上。

### 照片编辑

- 上传后按钮自动从“上传”切换为“更换”。
- JPEG、PNG、WebP 原生解码；HEIC/HEIF 在浏览器本地转换。
- 最长边超过 5120px 时本地降采样。
- 默认 Cover 居中；支持移动、10%–400% 缩放、90 度旋转和重置。
- 支持 X/Y 中心轴及四边吸附。
- 照片调整为独立开关模式；开启后隐藏相框和贴纸，并锁定素材入口与下载。
- 桌面支持拖动和滚轮；移动端支持单指拖动和双指缩放。

### 贴纸编辑

- 贴纸最多两个，达到上限后阻止继续添加。
- 支持拖动、按钮/滚轮缩放、自由旋转及直角吸附。
- 支持在相框上方或下方切换，不改变贴纸彼此的固定顺序规则。
- 支持交接包中的 24 色运行时乘色；每个贴纸默认 `SnowWhite`，可在底部工具栏独立换色。
- 颜色菜单按界面语言显示调色板 `names.en` 或 `names['zh-Hans']`，不显示序号或 Hex；换色进入撤销/重做和 PNG 导出。
- 贴纸、相框、已选素材名称均直接读取官方本地化字段，切换中英文时同步刷新。
- 照片和贴纸都有冰蓝示廓框及四角等比缩放控制点；贴纸另有旋转控制点。
- 角端缩放固定对角作为锚点，并合并为单条历史记录。

### 历史与状态

- 撤销/重做覆盖所有会影响导出的操作，最多 30 步。
- 连续拖动、滚轮和触控手势合并为一步。
- 照片调整模式设置历史边界，防止误撤销相框或贴纸。
- 撤销/重做提示显示 5 秒，位于底部状态栏正中。
- 存在未导出修改时触发浏览器离开提醒。

### UI 与响应式

- 风格依据用户提供的 DS2 游戏内保存、结果、社交系统和音乐播放器截图微调。
- 左上标题固定英文，使用轻窄字面，无蓝色荧光。
- 上传/下载为透明点阵全息按钮，悬停时由下向上填充。
- 照片调整按钮位于左栏底部，悬停时由左向右填充。
- 编辑工具条位于画布外下方，不遮挡合成画面。
- 素材分类只有贴纸和相框。
- 保留中英文界面、非官方非商业免责声明、克制动效及 reduced-motion。
- 四张官方风格标志每次载入随机选择一张，以淡背景形式装饰左侧素材栏；无交互且不进入导出。

## 3. 文件职责

| 路径 | 职责 |
| --- | --- |
| `site/index.html` | 页面结构、画布、控制区、状态栏和免责声明 |
| `site/style.css` | DS2 视觉、动效、响应式布局、全息按钮、示廓框周边 UI |
| `site/app.js` | Canvas 合成、素材模型、照片/贴纸交互、历史、导出、随机背景 |
| `site/lang.js` | 中英文文案与语言切换 |
| `app/` | Next.js 页面、素材目录、受保护媒体和公开外壳路由 |
| `server/` | HMAC 媒体令牌、会话校验和公开目录裁剪 |
| `next.config.mjs` | Next/vinext 共用配置和全站安全响应头 |
| `tools/` | 发布前素材完整性检查和浏览器回归 |
| `README.md` | 运行、素材接入和部署说明 |
| `FRONTEND_BASELINE.md` | 后续修改不得破坏的行为合同和回归清单 |
| `HANDOFF.md` | 本交接报告 |
| `assets/backgrounds/` | 四张随机左栏背景装饰 PNG |
| `assets/asset-index.json` | 服务端使用的 65 项完整素材索引，不直接公开 |
| `assets/library/` | 受保护媒体路由读取的原始透明 PNG |
| `assets/thumbnails/` | 受保护媒体路由读取的 WebP 缩略图 |
| `stickers/` | 早期占位目录，不再作为正式素材入口 |
| `site/vendor/heic-to-csp-1.5.2.js` | 固定版本 HEIC/HEIF 本地转换模块 |
| `site/vendor/heic-to-LICENSE.txt` | 第三方依赖许可文本 |

## 4. 素材配置

`assets/asset-index.json` 是服务端正式素材入口。`server/asset-catalog.js` 只向浏览器返回 ID、分类、尺寸、名称和不可猜测媒体 URL；SHA-256、真实路径、来源等级及解包配置 ID 不公开。`site/app.js` 再把单数分类映射为页面分类并读取官方中英文名称。

- 原图：`assets/library/<relative_path>`
- 缩略图：`assets/thumbnails/<relative_path>`，扩展名改为 `.webp`
- 当前网页数量：41 张相框、24 张贴纸
- `S04`、`S14`、`S16` 因内容重复仅从网页索引移除，本地文件继续保留
- F11–F20、F23、F24：保留 `temporary-v1-manual-promotion` 来源标记

随机背景装饰已复制到项目内部：

- `assets/backgrounds/ds2-title-vertical.png`
- `assets/backgrounds/kojima-productions-2.png`
- `assets/backgrounds/drawbridge.png`
- `assets/backgrounds/dhv-magellan.png`

它们源自 `D:\File D\projects_\已提取素材\贴纸成品\`，仅由受保护媒体路由提供给同源页面。

## 5. 运行与部署

本地运行：

```powershell
cd "D:\File D\projects_\vscode new\DS photo web"
npm.cmd ci
npm.cmd run dev -- --hostname 127.0.0.1 --port 4173
```

打开 `http://127.0.0.1:4173/`。

部署要求：

- 使用 `.openai/hosting.json` 中既有 Sites 项目，不要再次创建站点。
- Sites 环境变量 revision 1 已保存随机 `DS_ASSET_SECRET`；不得读取、提交或在本地复用该值，轮换后需要重新部署。
- 当前公开生产版本为 Sites 版本 3，提交 `3b58e2e6abc9d358783be46733b8e9f7aa56f2d3`，地址为 `https://death-stranding-2-photo-frame.docile-mite-7384.chatgpt.site`；真实浏览器访问无需 ChatGPT 登录。
- `npm.cmd run check` 和 `npm.cmd run build` 必须通过；vinext 生成 Sites 所需的 `dist/server/index.js` Worker 入口，`tools/harden-dist.mjs` 再把精简素材复制到内部 Assets 绑定路径并验证 Worker 优先路由。
- 用户照片始终留在浏览器；服务器仅提供只读页面、目录和素材响应，不需要数据库或持久化服务。
- CSP 和其他安全策略在 `server/security-headers.js` 中统一定义，并由每个服务端路由直接附加；`next.config.mjs` 同时引用同一配置，不得放宽到 `unsafe-eval` 或跨域图片。
- 站点已公开，仍须持续确认游戏素材、名称、商标和图像的授权范围；当前免责声明不等于取得授权。
- 中国大陆稳定访问需使用独立域名、境内云主机和 ICP 备案；项目已增加 Node standalone 与 Docker 入口，详见 `DEPLOY_CN.md`。
- Cloudflare 免费 Worker 已部署到 `https://ds2-photo-frame.ds2-photo-tools.workers.dev`，生产 Secret 已保存；当前大陆线路实测无法连接 `workers.dev`，该地址只作为海外备用入口。

## 6. 已完成验证

- 当前网页索引 65 项对应原图均存在并通过 SHA-256 校验；3 个被排除贴纸的本地文件仍存在。
- 素材面板数量正确：贴纸 24 项；相框 41 项，另含“无相框”入口。
- 高清素材按需加载；添加两个贴纸后第三项被禁用，相框选择与替换状态正常。
- `npm.cmd run check` 通过，包含脚本语法、HTML ID、语言键、素材数量、文件存在性和 SHA-256 校验。
- vinext 兼容性检查为 100%，Cloudflare Worker 生产构建通过；`npm audit --omit=dev` 为 0 个生产依赖漏洞，Worker 运行包不含已知问题的元数据图片解析器实现。
- Wrangler Worker 与 Next 本地开发入口的浏览器回归均通过：24 贴纸、41 相框、24 色、F37、上传、换色和 PNG 导出正常。
- 防护回归通过：无会话 401、明确跨站请求 403、旧公开原图路径 403/404；未提供 Fetch Metadata 的内置浏览器依靠 SameSite 会话校验，精简目录不泄露内部元数据。
- Sites 版本 3 的公开 Edge 生产回归通过：首页、脚本、24 个贴纸、41 个相框、24 色、F37、上传、换色及 PNG 导出均正常。命令行自动请求可能被托管平台的机器人防护返回 403，这不是 ChatGPT 登录门禁。
- `git diff --check` 通过，仅有 Windows LF/CRLF 提示。
- Edge `1440 x 900` 桌面视口无布局重叠。
- 真实 `390 x 844` 移动指标下无横向溢出，触控拖动和双指缩放通过。
- 实际 HEIC 样例在严格 CSP 下成功转换。
- 6000px 测试图成功降采样至 5120px 长边。
- 实际导出为 `2560 x 1440` PNG，黑色背景，选框和吸附线未进入结果。
- 第三个贴纸被阻止；相框替换、贴纸层级和照片模式历史边界通过。
- 照片与贴纸四角缩放保持宽高比，对角锚点无可见漂移。
- 撤销提示在桌面 `720/720`、手机 `195/195` 的视口中心对齐。
- 连续刷新覆盖四张随机背景，全部成功加载且不进入画布。
- 最终整合回归导出 `2560×1440 RGBA PNG`；桌面 `1440×900` 和移动端 `390×844` 均无控制台错误或横向页面溢出。

## 7. 已知限制与风险

1. 页面不保存工程；刷新后照片、素材和历史都会丢失，只提供离开提醒。
2. 浏览器编辑核心仍集中在 `site/app.js`；已有自动化预检和关键路径浏览器冒烟测试，但不是完整单元测试套件。
3. `file://` 和普通静态服务器不再受支持；素材目录、受保护媒体和 HEIC/HEIF 应通过 Next.js HTTP/HTTPS 入口加载。
4. 当前工作树存在大量未提交修改和未跟踪文件。不要使用 `git reset --hard`、`git checkout --` 或清理命令覆盖它们。
5. 公开发布存在素材版权和商标风险；非商业属性与免责声明只能降低误解，不能替代授权。
6. 前端防护不能成为 DRM：访问者仍可从浏览器中取得已经加载的像素；当前措施只降低目录枚举、直接路径访问和盗链成本。
7. Sites 版本 1 因缺少 `dist` 构建产物失败；版本 2 使用 Node standalone 入口，部署虽完成但线上后端返回 522。最终版本 3 改为官方 Cloudflare Worker 构建，并通过生产加载验证。不要回退到 standalone 入口。

## 8. Git 状态

已修改但未提交：

- 原有根目录 `app.js`、`index.html`、`lang.js`、`style.css` 已迁入 `site/`

当前未跟踪：

- `README.md`
- `FRONTEND_BASELINE.md`
- `HANDOFF.md`
- `assets/`
- `stickers/`
- `app/`、`server/`、`site/`、`tools/`
- `package.json`、`package-lock.json`、`next.config.mjs`

这些内容均属于本项目成果。整合前应先审阅，再整体加入版本控制；不要把它们当作临时文件删除。

## 9. 下一对话建议顺序

1. 首先阅读 `HANDOFF.md`、`FRONTEND_BASELINE.md` 和 `README.md`。
2. 监控公开生产地址的 CSP、Cookie、素材响应、HEIC 和 PNG 导出。
3. 后续修改应推送新提交并保存新的不可变 Sites 版本，不覆盖旧版本。
4. 持续完成素材授权审查，并根据中国大陆目标选择境内备案部署或香港过渡部署。

## 10. 可直接用于下一对话的开场说明

> 请接手 `D:\File D\projects_\vscode new\DS photo web`。先阅读 `HANDOFF.md`、`FRONTEND_BASELINE.md`、`README.md` 和 `DEPLOY_CN.md`，并检查未提交工作树。当前编辑器核心、65 项去重素材、vinext Cloudflare Worker 运行层、独立 Node/Docker 入口和素材防护均已完成；Sites 版本 3 已公开并通过真实 Edge 生产回归，无需 ChatGPT 登录。3 个重复贴纸仅从服务端索引排除，本地文件仍保留。下一步根据中国大陆访问目标准备独立域名、云账号和 ICP 备案。
