# Docker Web 运行模式

此 fork 增加 Docker Web 运行模式：Next.js 静态导出由 Node 服务提供，并通过同源代理访问 Screeps API，避免浏览器 CORS 问题。Tauri 桌面和移动端行为保持不变。

## 启动

```bash
docker compose up -d --build
```

打开 <http://localhost:3200>。

健康检查：

```bash
curl http://localhost:3200/healthz
```

## 私服允许列表

默认只允许代理到 `https://screeps.com`。如果需要连接私服，必须显式加入允许列表：

```yaml
services:
  dashboard:
    environment:
      SCREEPS_ALLOWED_ORIGINS: https://screeps.com,https://screeps.example.com
```

只填写可信的 `http(s)` origin，不包含 API path。该 allowlist 防止容器成为开放代理或访问未授权的内网服务。

## 凭据说明

当前 Web 模式沿用上游登录模型：Token 或已保存密码存在浏览器 `localStorage` 中，请仅在可信设备上使用。浏览器将 Screeps 请求发送至同源 `/api/screeps-proxy`，代理再转发到允许列表中的服务器。

此模式解决 Docker Web 访问和 CORS，不会把凭据迁移为服务端托管。服务端凭据模式应作为独立安全设计，不与首个 Docker 化提交混合。
