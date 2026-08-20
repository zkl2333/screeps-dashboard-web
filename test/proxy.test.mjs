import test from "node:test";
import assert from "node:assert/strict";
import { createProxyHandler } from "../server/proxy.mjs";

function request(body, method = "POST") {
  return new Request("http://localhost/api/screeps-proxy", {
    method,
    headers: { "content-type": "application/json" },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
}

test("proxies an allowed Screeps request and forwards auth headers", async () => {
  const calls = [];
  const handler = createProxyHandler({
    fetch: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({ ok: 1 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  const response = await handler(request({
    baseUrl: "https://screeps.com",
    endpoint: "/api/auth/me",
    method: "GET",
    token: "test-token",
    username: "player",
    query: { shard: "shard2" },
  }));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: 200,
    ok: true,
    data: { ok: 1 },
    url: "https://screeps.com/api/auth/me?shard=shard2",
  });
  assert.equal(calls[0].options.headers["X-Token"], "test-token");
  assert.equal(calls[0].options.headers["X-Username"], "player");
});

test("proxies any HTTP(S) Screeps server selected by the existing UI", async () => {
  const calls = [];
  const handler = createProxyHandler({
    fetch: async (url) => {
      calls.push(url.toString());
      return new Response(JSON.stringify({ok: 1}), {status: 200});
    },
  });
  const response = await handler(request({
    baseUrl: "https://private.screeps.example:21025",
    endpoint: "/api/game/time",
    method: "GET",
  }));
  assert.equal(response.status, 200);
  assert.equal(calls[0], "https://private.screeps.example:21025/api/game/time");
});

test("rejects malformed endpoints, non-HTTP servers and unsupported methods", async () => {
  const handler = createProxyHandler({fetch});
  assert.equal((await handler(request({baseUrl: "https://screeps.com", endpoint: "https://evil.test", method: "GET"}))).status, 400);
  assert.equal((await handler(request({baseUrl: "file:///tmp", endpoint: "/api/test", method: "GET"}))).status, 400);
  assert.equal((await handler(request({baseUrl: "https://screeps.com", endpoint: "/api/test", method: "TRACE"}))).status, 400);
  assert.equal((await handler(request({}, "GET"))).status, 405);
});
