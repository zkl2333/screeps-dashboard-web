# Screeps Dashboard Docker

A Docker-only Web distribution based on the full ScreepsDashboard feature set. The repository no longer includes Tauri, desktop, Android, or iOS build targets; browsers access Screeps through the same-origin Node service.

## Features

- Account, token, and guest login
- Multiple server profiles and private-server support
- User, resources, rooms, map, rankings, and market views
- Room details, official renderer, and realtime data
- Console and messages
- Chinese and English UI
- Docker deployment with a same-origin Screeps API proxy

## Quick start

```bash
pnpm install
pnpm run dev
```

The development UI is available at <http://localhost:3001>; its proxied health endpoint is <http://localhost:3001/healthz>.

For production:

```bash
docker compose up -d --build
```

Open <http://localhost:3200>.

## Private-server allowlist

The default target is `https://screeps.com`. Add private servers explicitly:

```yaml
services:
  dashboard:
    environment:
      SCREEPS_ALLOWED_ORIGINS: https://screeps.com,https://screeps.example.com
```

Only use trusted `http(s)` origins without an API path. Put HTTPS and reverse-proxy authentication in front of any public deployment.

## Architecture

```text
Browser -> Node static server / same-origin API proxy -> Screeps official or private server
```

Credentials are currently managed by the browser session. A server-side session and Docker secret mode can be added later without changing the Docker-only direction.

## Checks

```bash
pnpm install --frozen-lockfile
pnpm run check
docker build -t screeps-dashboard:test .
```

## License

GPL-3.0