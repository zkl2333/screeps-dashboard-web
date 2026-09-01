# Screeps Dashboard 协作规则

本仓库是 Docker-only、自托管的 Screeps Web Dashboard。完整 Web 功能优先，不再兼容 Tauri、桌面端或移动原生构建。

## 运行边界

- 浏览器统一通过同源 Node 服务访问 Screeps API，不添加任意目标开放代理。
- 私服必须显式加入 `SCREEPS_ALLOWED_ORIGINS`。
- 新功能优先实现为 Web + Node，不得新增 Tauri/Rust 专用实现。
- 凭据、日志和运行数据不得提交。

## 验证

```bash
pnpm install --frozen-lockfile
pnpm run check
docker build -t screeps-dashboard:test .
```
