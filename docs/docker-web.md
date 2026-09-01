# Docker Web 部署

本项目是 Docker-only 的 Screeps Web Dashboard。每个实例绑定一个 Screeps 账号，HTTP API 和实时 WebSocket 都经由同源 Node 服务转发，Token 只存在于服务端 Docker Secret。

## 启动

```bash
cp config/dashboard.json.example config/dashboard.json
mkdir -p secrets
printf '%s' 'YOUR_SCREEPS_TOKEN' > secrets/screeps_token
docker compose up -d --build
```

打开 <http://localhost:3200>，健康检查：

```bash
curl http://localhost:3200/healthz
```

配置文件至少包含：

```json
{
  "baseUrl": "https://screeps.com",
  "username": "your-screeps-username",
  "allowedOrigins": ["https://screeps.com"],
  "tokenFile": "/run/secrets/screeps_token"
}
```

`/api/config` 只返回 `baseUrl`、用户名、配置状态和 WebSocket 路径，不返回 Token：

```bash
curl http://localhost:3200/api/config
```

## 私服 allowlist

私服必须同时出现在 `baseUrl` 和 `allowedOrigins` 中。只填写可信的 `http(s)` origin，不包含 API path。HTTP 与 WebSocket 都固定转发到该配置目标，不接受浏览器传入的目标地址或凭据。

## 部署边界

当前版本面向家庭局域网或 Tailscale/ZeroTier 等个人组网：

- 不要直接把 Dashboard 端口暴露到不可信公网。
- 反向代理鉴权、TLS、OIDC 和公网访问控制后置实现。
- Docker Compose 使用只读配置文件和 Docker Secret；`config/dashboard.json`、`secrets/` 不得提交到 Git。
- 当前为单实例、单账号模式，不提供账号切换、游客模式或应用内用户管理。

## 运行模式

```text
浏览器 -> Node 同源 HTTP/WS 代理 -> Screeps 官方服或私服
                              ↑
                       Docker 配置 + Secret
```

## 安全检查

确认 Token 没有进入浏览器 localStorage、WebSocket URL、镜像层或日志。生产更新建议使用 GHCR 的不可变 `sha-<commit>` 或版本 tag，而不是 `latest`。
