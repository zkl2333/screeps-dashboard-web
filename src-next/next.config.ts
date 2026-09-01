import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

export default function nextConfig(phase: string): NextConfig {
  const development = phase === PHASE_DEVELOPMENT_SERVER;
  return {
    ...(development ? {} : { output: "export" as const }),
    reactStrictMode: true,
    ...(development
      ? {
          async rewrites() {
            return [
              {
                source: "/api/screeps-proxy",
                destination: "http://127.0.0.1:3000/api/screeps-proxy",
              },
              {
                source: "/api/config",
                destination: "http://127.0.0.1:3000/api/config",
              },
              {
                source: "/healthz",
                destination: "http://127.0.0.1:3000/healthz",
              },
              {
                source: "/readyz",
                destination: "http://127.0.0.1:3000/readyz",
              },
              {
                source: "/socket/websocket",
                destination: "ws://127.0.0.1:3000/socket/websocket",
              },
            ];
          },
        }
      : {}),
  };
}
