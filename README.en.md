# Screeps Dashboard Docker

A Docker-only Web distribution based on the full ScreepsDashboard feature set. Each Dashboard instance is bound to one Screeps account. The browser accesses HTTP APIs and realtime WebSocket data through the same-origin Node service and never stores or sends the Screeps token.

## Features

- Single-instance, single-account configuration
- Same-origin HTTP API and realtime WebSocket proxy
- Official server and explicitly allowlisted private servers
- User, resources, rooms, map, rankings, and market views
- Room details, official renderer, and realtime data
- Console and messages
- Chinese and English UI
- Docker/Compose deployment

## Quick start

For development:

```bash
pnpm install
pnpm run dev
```

The development UI is available at <http://localhost:3001>; the server health endpoint is <http://localhost:3001/healthz>.

## Docker single-account configuration

Copy the configuration template and fill in the fixed account information:

```bash
cp config/dashboard.json.example config/dashboard.json
mkdir -p secrets
printf '%s' 'YOUR_SCREEPS_TOKEN' > secrets/screeps_token
docker compose up -d --build
```

Example `config/dashboard.json`:

```json
{
  "baseUrl": "https://screeps.com",
  "username": "your-screeps-username",
  "allowedOrigins": ["https://screeps.com"],
  "tokenFile": "/run/secrets/screeps_token"
}
```

Open <http://localhost:3200>. The token is mounted as a Docker Secret and used only by the Node service; the browser never receives it. `config/dashboard.json` and `secrets/` are ignored by Git and must not contain committed credentials.

## Private-server allowlist

The default target is `https://screeps.com`. A private server must be present in both `baseUrl` and `allowedOrigins`, for example:

```json
{
  "baseUrl": "https://screeps.example.com",
  "username": "your-screeps-username",
  "allowedOrigins": ["https://screeps.example.com"],
  "tokenFile": "/run/secrets/screeps_token"
}
```

Only use trusted `http(s)` origins without an API path. This version targets a home LAN or a private mesh such as Tailscale/ZeroTier; do not expose the port directly to an untrusted public network. Reverse-proxy authentication, TLS, and OIDC are intentionally deferred.

## Architecture

```text
Browser -> Node same-origin HTTP/WS proxy -> Screeps official or private server
                                      ↑
                             Docker config + Secret
```

The frontend stores only interface preferences and non-sensitive instance metadata. The Screeps token is not written to localStorage and does not appear in the browser WebSocket URL.

## GHCR prebuilt image

```bash
docker pull ghcr.io/zkl2333/screeps-dashboard:latest
docker compose up -d
```

Compose builds from source by default. To use a prebuilt image, replace `build: .` in `compose.yaml` with:

```yaml
image: ghcr.io/zkl2333/screeps-dashboard:latest
```

For production, prefer a `sha-<commit>` or version tag over mutable `latest`. GHCR packages are private by default; private packages require a Personal Access Token with `read:packages` to log in to `ghcr.io`.

## Checks

```bash
pnpm install --frozen-lockfile
pnpm run check
docker build -t screeps-dashboard:test .
```

## License

GPL-3.0
