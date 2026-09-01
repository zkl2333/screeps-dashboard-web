# Docker Web 部署

本项目是 Docker-only 的 Screeps Web Dashboard。Next.js 静态导出由 Node 服务提供，浏览器请求统一经同源代理转发到 Screeps，避免浏览器 CORS 问题。

## 启动

从源码构建并启动：

```bash
cp .env.example .env
# 编辑 .env，设置 DASHBOARD_ADMIN_PASSWORD
docker compose up -d --build
```

也可以直接运行 GitHub Container Registry 中的预构建镜像：

```bash
docker pull ghcr.io/zkl2333/screeps-dashboard:latest
docker run -d \
  --name screeps-dashboard \
  --restart unless-stopped \
  --read-only \
  --tmpfs /tmp \
  --security-opt no-new-privileges:true \
  --env-file .env \
  -p 3200:3000 \
  ghcr.io/zkl2333/screeps-dashboard:latest
```

`latest` 跟随默认分支，`sha-<commit>` 可用于固定到具体提交。`v0.1.2` 这类 Git tag 会发布 `v0.1.2`、`0.1.2`、`0.1` 和 `0`。GHCR 包默认为私有；拉取私有包前，需要使用具有 `read:packages` 权限的 Personal Access Token 登录：

```bash
echo "$GHCR_TOKEN" | docker login ghcr.io -u USERNAME --password-stdin
```

也可以在 GitHub 包设置中将镜像设为公开，以便匿名拉取。

打开 <http://localhost:3200>，健康检查：

```bash
curl http://localhost:3200/healthz
```

## 私服 allowlist

默认只允许 `https://screeps.com`。私服必须显式加入 `SCREEPS_ALLOWED_ORIGINS`，多个 origin 用逗号分隔。只填写可信的 `http(s)` origin，不包含 API path。

管理员密码通过 `DASHBOARD_ADMIN_PASSWORD` 配置。未登录时无法访问内部 API。

## 安全建议

- 使用 HTTPS 和反向代理认证。
- 不要直接把 Dashboard 端口暴露到不可信公网。
- 当前登录 Token/密码仍由浏览器 localStorage 管理，请只在可信设备保存账号。
- WebSocket 同源代理和服务端 session 将在后续迭代中补齐。
