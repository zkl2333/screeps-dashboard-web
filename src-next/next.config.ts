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
                source: "/api/auth/:path*",
                destination: "http://127.0.0.1:3000/api/auth/:path*",
              },
              {
                source: "/api/screeps-proxy",
                destination: "http://127.0.0.1:3000/api/screeps-proxy",
              },
              {
                source: "/healthz",
                destination: "http://127.0.0.1:3000/healthz",
              },
            ];
          },
        }
      : {}),
  };
}
