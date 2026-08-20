# Docker Web 部署

本项目是 Docker-only 的 Screeps Web Dashboard。Next.js 静态导出由 Node 服务提供，浏览器请求统一经同源代理转发到 Screeps，避免浏览器 CORS 问题。

## 启动

```bash
docker compose up -d --build
```

打开 <http://localhost:3200>，健康检查：

```bash
curl http://localhost:3200/healthz
```

## 私服 allowlist

默认只允许 `https://screeps.com`。私服必须显式加入 `SCREEPS_ALLOWED_ORIGINS`，多个 origin 用逗号分隔。只填写可信的 `http(s)` origin，不包含 API path。

## 安全建议

- 使用 HTTPS 和反向代理认证。
- 不要直接把 Dashboard 端口暴露到不可信公网。
- 当前登录 Token/密码仍由浏览器 localStorage 管理，请只在可信设备保存账号。
- WebSocket 同源代理和服务端 session 将在后续迭代中补齐。
