# 免费静态部署与中国大陆访问说明

## 当前方案

项目通过公开 GitHub 仓库和 GitHub Pages 免费部署，不需要购买域名、配置服务器、设置 Secret 或登录 ChatGPT。默认项目地址为：

`https://2075570039-star.github.io/ds2-photo-frame/`

推送或合并到 `main` 后，GitHub Actions 会构建、部署并执行线上浏览器回归。部署产物完全静态，用户照片只在浏览器内处理。

## 已接受的取舍

- GitHub Free 要求 Pages 来源仓库公开，源码、贴纸、相框、缩略图和颜色配置均可下载。
- 不再尝试通过前端混淆、HMAC URL、会话 Cookie 或禁止右键隐藏素材。
- 不再需要 `DS_ASSET_SECRET`、EdgeOne 临时预览令牌或 Cloudflare Worker。
- `github.io` 在中国大陆不同地区、运营商和时段可能出现速度慢或无法访问，免费方案无法承诺稳定性。

## 将来需要大陆稳定访问时

若未来需要面向中国大陆的长期稳定入口，通常仍需购买独立域名、完成实名认证和 ICP 备案，并部署到具有大陆节点的合规托管服务。本次 GitHub Pages 方案不解决备案和跨境线路问题。
