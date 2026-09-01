# Screeps Dashboard Docker

基于 ScreepsDashboard 完整功能的 Docker-only Web 版本。项目不再包含 Tauri、桌面端、Android 或 iOS 构建链，浏览器统一通过同源 Node 服务访问 Screeps API。

## 功能

- 账号登录、Token 登录和游客模式
- 多服务器配置与私服支持
- 用户资料、资源、房间、地图、排行榜和市场
- 房间详情、官方渲染器和实时数据
- 控制台与消息
- 中英文界面
- Docker 部署和同源 Screeps API 代理

## 快速开始

```bash
pnpm install
pnpm run dev
```

开发页面位于 <http://localhost:3001>，代理健康检查位于 <http://localhost:3001/healthz>。

生产环境从源码构建：

```bash
cp .env.example .env
# 编辑 .env，设置管理员密码
docker compose up -d --build
```

打开 <http://localhost:3200>。

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

`latest` 指向默认分支的最新镜像；每次发布还会生成 `sha-<commit>` 标签。推送 `v0.1.2` 这类版本标签时，会同时生成 `v0.1.2`、`0.1.2`、`0.1` 和 `0`。GHCR 包默认为私有；私有包需要先使用具有 `read:packages` 权限的 Personal Access Token 执行 `docker login ghcr.io`，也可以在 GitHub 包设置中将其改为公开，公开包可匿名拉取。

## 私服 allowlist

默认只允许代理到 `https://screeps.com`。私服必须显式加入：

```yaml
services:
  dashboard:
    environment:
      SCREEPS_ALLOWED_ORIGINS: https://screeps.com,https://screeps.example.com
```

只填写可信的 `http(s)` origin，不包含 API path。不要将服务端口直接暴露到不可信公网，外部访问应使用 HTTPS 和反向代理认证。

管理员密码通过 `DASHBOARD_ADMIN_PASSWORD` 配置。

## 运行模式

```text
浏览器 -> Node 静态文件服务 / 同源 API 代理 -> Screeps 官方服或私服
```

当前登录凭据仍由浏览器会话管理。后续可以独立增加服务端 session 和 Docker secret 模式，但不会改变 Docker-only 主线。

## 开发检查

```bash
pnpm install --frozen-lockfile
pnpm run check
docker build -t screeps-dashboard:test .
```

## License

GPL-3.0