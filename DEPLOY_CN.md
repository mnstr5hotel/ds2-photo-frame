# 中国大陆访问部署说明

## 结论

`chatgpt.site` 入口不适合作为中国大陆用户的稳定访问地址。项目已同时支持独立 Node/Docker 生产部署，网页功能、素材会话、HMAC 媒体令牌、防直链响应头和浏览器本地图片处理保持不变，不依赖 ChatGPT 登录或 OpenAI API。

## 推荐正式方案

1. 准备独立域名，并在腾讯云或阿里云等中国大陆云厂商购买大陆地区的容器或云服务器。
2. 通过该云厂商完成域名实名认证与 ICP 备案；网站上线后在页脚显示备案号。
3. 构建并推送本项目 Docker 镜像，生产环境设置至少 32 个字符的随机 `DS_ASSET_SECRET`。
4. 由云负载均衡或 Nginx 提供 HTTPS，并将请求转发到容器的 `3000` 端口。
5. 使用中国大陆不同运营商的桌面和手机网络，复验首页、素材目录、图片上传、HEIC、贴纸换色和 PNG 导出。

示例构建和本地运行：

```powershell
docker build -t ds2-photo-frame .
docker run --rm -p 3000:3000 -e DS_ASSET_SECRET="请替换为至少32字符的随机密钥" ds2-photo-frame
```

不要把生产密钥写入 Dockerfile、源码、`.env` 或 Git。应使用云厂商的 Secret/环境变量功能注入，并在泄露后立即轮换。

## 无备案过渡方案

如果暂时无法备案，可把同一镜像部署到香港或新加坡节点并绑定独立域名。这能摆脱 `chatgpt.site` 和 ChatGPT 登录，但跨境线路仍可能因地区、运营商和时段产生延迟或连接失败，因此不能承诺中国大陆稳定可用。

Cloudflare 免费 Worker 已部署到 `https://ds2-photo-frame.ds2-photo-tools.workers.dev`。部署和 Secret 均正常，但当前大陆网络实测该域名解析到 `202.160.130.145` 后无法建立 HTTPS 连接，因此只作为海外备用入口，不作为大陆过渡方案。

## GitHub + EdgeOne Pages 试运行

源码使用私有 GitHub 仓库保存，EdgeOne Pages 通过 GitHub 授权自动拉取；后续推送 `main` 分支会触发重新部署。导入项目时使用以下配置：

- 框架预设：Next.js
- 安装命令：`npm ci`
- 构建命令：`npm run build:next`
- Node.js：22
- 生产分支：`main`
- 生产环境变量：`DS_ASSET_SECRET`，值为至少 32 字符的随机密钥

不要把 `DS_ASSET_SECRET` 提交到 GitHub。首次部署后应检查 `/api/catalog`、贴纸和相框缩略图、贴纸换色、照片导入及 PNG 导出；只验证首页并不足以证明受保护素材路由已经随服务端构建发布。

## 平台约束

- 中国大陆稳定托管不是修改 HTML、JavaScript 或 DNS 就能解决的问题；关键是独立域名、境内基础设施和合规备案。
- Cloudflare 官方说明，Pages 本身不在中国大陆提供；Cloudflare China Network 需要 Enterprise、中国网络附加订阅、有效 ICP 备案/许可证及内容审核，因此不适合作为本项目的低成本首选。
- 腾讯 EdgeOne Pages 虽有长期免费版和系统项目域名，但中国大陆/全球含大陆区域的系统预览链接只有 3 小时有效期；全球不含大陆区域的系统域名会对大陆网络返回 401。建立稳定入口仍需绑定已备案的自定义域名。
- 腾讯 CloudBase 提供默认 `*.tcloudbaseapp.com`/`*.app.tcloudbase.com` 域名和部分免费额度，但官方将默认域名限定为开发测试用途，存在频率限制、安全提示页，并要求生产环境绑定已备案域名。
- 项目没有数据库或用户照片上传后端。用户照片和合成过程仍留在浏览器内，服务器只提供页面、目录和只读素材响应。
