# Screeps Dashboard Docker

基于 ScreepsDashboard 完整功能的 Docker-only Web 版本。每个 Dashboard 实例绑定一个 Screeps 账号，浏览器通过同源 Node 服务访问 Screeps API 和实时 WebSocket，不保存或传递 Screeps Token。

## 功能

- 单实例、单 Screeps 账号配置
- HTTP API 和实时 WebSocket 同源代理
- 官方服与显式 allowlist 私服支持
- 用户资料、资源、房间、地图、排行榜和市场
- 房间详情、官方渲染器和实时数据
- 控制台与消息
- 中英文界面
- Docker/Compose 部署

## 快速开始

开发环境：

```bash
pnpm install
pnpm run dev
```

开发页面位于 <http://localhost:3001>，服务端健康检查位于 <http://localhost:3001/healthz>。

## Docker 单账号配置

复制配置模板并填写固定账号信息：

```bash
cp config/dashboard.json.example config/dashboard.json
mkdir -p secrets
printf '%s' 'YOUR_SCREEPS_TOKEN' > secrets/screeps_token
docker compose up -d --build
```

`config/dashboard.json` 示例：

```json
{
  "baseUrl": "https://screeps.com",
  "username": "your-screeps-username",
  "allowedOrigins": ["https://screeps.com"],
  "tokenFile": "/run/secrets/screeps_token"
}
```

打开 <http://localhost:3200>。Token 通过 Docker Secret 挂载到 Node 服务端，浏览器不会接触 Token。`config/dashboard.json` 和 `secrets/` 已加入 `.gitignore`，不要提交凭据。

## 私服 allowlist

默认只允许 `https://screeps.com`。私服必须同时配置 `baseUrl` 和 `allowedOrigins`，例如：

```json
{
  "baseUrl": "https://screeps.example.com",
  "username": "your-screeps-username",
  "allowedOrigins": ["https://screeps.example.com"],
  "tokenFile": "/run/secrets/screeps_token"
}
```

只填写可信的 `http(s)` origin，不包含 API path。当前版本面向家庭局域网或 Tailscale/ZeroTier 等个人组网；不要直接将端口暴露到不可信公网。反向代理鉴权、TLS 和 OIDC 后续再补。

## 运行模式

```text
浏览器 -> Node HTTP/WS 同源代理 -> Screeps 官方服或私服
                         ↑
                  Docker 配置 + Secret
```

前端只保存界面偏好和当前实例的非敏感运行元数据；Screeps Token 不写入 localStorage，也不出现在浏览器 WebSocket URL 中。

## GHCR 预构建镜像

```bash
docker pull ghcr.io/zkl2333/screeps-dashboard:latest
docker compose up -d
```

Compose 默认从源码构建；如使用预构建镜像，可将 `compose.yaml` 中的 `build: .` 替换为：

```yaml
image: ghcr.io/zkl2333/screeps-dashboard:latest
```

生产环境建议使用 `sha-<commit>` 或版本 tag，而不是可变的 `latest`。GHCR 包默认为私有；私有包需要使用具有 `read:packages` 权限的 Personal Access Token 登录 `ghcr.io`。

## 开发检查

```bash
pnpm install --frozen-lockfile
pnpm run check
docker build -t screeps-dashboard:test .
```

## License

GPL-3.0
