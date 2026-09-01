FROM node:22-alpine AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile --ignore-scripts
COPY src-next ./src-next
RUN pnpm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 STATIC_DIR=/app/public SCREEPS_ALLOWED_ORIGINS=https://screeps.com
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --prod --frozen-lockfile --ignore-scripts
COPY server ./server
COPY --from=build /app/src-next/out ./public
RUN chown -R node:node /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -qO- http://127.0.0.1:3000/readyz || exit 1
CMD ["node", "server/index.mjs"]
