# GitHub Pages 发布说明

## 当前方案

项目当前通过公开 GitHub 仓库和 GitHub Pages 免费部署。

- 仓库：`mnstr5hotel/ds2-photo-frame`
- 线上地址：`https://mnstr5hotel.github.io/ds2-photo-frame/`
- 发布分支：`main`
- 发布产物：`dist-pages/`

推送到 `main` 后，GitHub Actions 会执行检查、静态构建，并发布到 GitHub Pages。

## Workflow 行为

`.github/workflows/pages.yml` 只在影响网页和素材的路径变化时触发，单独修改 README 等文档不会再触发部署。

当前保留：

- `npm ci`
- `npm run check`
- `npm run build`
- GitHub Pages deploy

当前已取消：

- 线上 smoke job
- Playwright 线上回归

取消原因：GitHub Pages 刚部署完成时，CDN 与静态资源刷新存在时序差异，容易导致 smoke 阶段误报失败并发送噪音邮件。

## 本地维护命令

```powershell
npm.cmd run check
npm.cmd run build
npm.cmd run start
```

本地完整回归：

```powershell
$env:SMOKE_BASE_URL='http://127.0.0.1:4174/'
$env:SMOKE_EXPECT_PUBLIC_ASSETS='true'
npm.cmd run smoke
```

## 免费方案限制

- `github.io` 默认域名无法去掉，除非绑定自有域名。
- GitHub Pages 免费公开部署意味着素材和源码可被直接访问。
- 中国大陆访问 `github.io` 的速度和稳定性不可控。
- 若未来需要更稳定的大陆访问入口，建议购买域名并迁移到具备大陆或边缘节点的托管/CDN 服务。

当前点击素材已改用透明 WebP 发布素材；原始 PNG 仍保留在 `assets/library/`，网页不直接加载。
