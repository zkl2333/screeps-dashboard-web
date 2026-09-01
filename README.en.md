# Screeps Dashboard Docker

A Docker-only Web distribution based on the full ScreepsDashboard feature set. The repository no longer includes Tauri, desktop, Android, or iOS build targets; browsers access Screeps through the same-origin Node service.

## Features

- Administrator password gate for internal APIs
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
```

Set `DASHBOARD_ADMIN_PASSWORD` in the shell, then run:

```bash
pnpm run dev
```

The development UI is available at <http://localhost:3001>; its proxied health endpoint is <http://localhost:3001/healthz>.

For production builds from source, create a `.env` file from `.env.example`, set the administrator password, and start the container:

```bash
cp .env.example .env
docker compose up -d --build
```

Open <http://localhost:3200>.

Alternatively, run the prebuilt image from GitHub Container Registry:

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

`latest` tracks the newest image from the default branch, and every build also receives a `sha-<commit>` tag. Pushing a release tag such as `v0.1.2` additionally creates `v0.1.2`, `0.1.2`, `0.1`, and `0`. GHCR packages are private by default. For a private package, run `docker login ghcr.io` with a Personal Access Token that has `read:packages`; alternatively, make the package public in its GitHub settings to allow anonymous pulls.

## Private-server allowlist

The default target is `https://screeps.com`. Add private servers explicitly:

```yaml
services:
  dashboard:
    environment:
      SCREEPS_ALLOWED_ORIGINS: https://screeps.com,https://screeps.example.com
      DASHBOARD_ADMIN_PASSWORD: ${DASHBOARD_ADMIN_PASSWORD}
```

Only use trusted `http(s)` origins without an API path. Put HTTPS and reverse-proxy authentication in front of any public deployment.

## Architecture

```text
Browser -> Node static server / same-origin API proxy -> Screeps official or private server
```

The administrator session is stored in memory and is cleared when the Node process restarts. Screeps credentials are still managed by the browser in this version.

## Checks

```bash
pnpm install --frozen-lockfile
pnpm run check
docker build -t screeps-dashboard:test .
```

## License

GPL-3.0
