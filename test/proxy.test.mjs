import test from "node:test";
import assert from "node:assert/strict";
import {createProxyHandler} from "../server/proxy.mjs";

function request(body, method = "POST", headers = {}) {
  return new Request("http://localhost/api/screeps-proxy", {
    method,
    headers: {"content-type": "application/json", ...headers},
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
}

test("uses fixed server credentials and ignores browser credentials", async () => {
  const calls = [];
  const handler = createProxyHandler({
    baseUrl: "https://screeps.com",
    token: "configured-token",
    username: "configured-user",
    fetch: async (url, options) => {
      calls.push({url: url.toString(), options});
      return new Response(JSON.stringify({ok: 1}), {status: 200, headers: {"content-type": "application/json"}});
    },
  });
  const response = await handler(request({
    baseUrl: "https://evil.test", endpoint: "/api/auth/me", method: "GET",
    token: "browser-token", username: "browser-user", query: {shard: "shard2"},
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: 200, ok: true, data: {ok: 1}, url: "https://screeps.com/api/auth/me?shard=shard2",
  });
  assert.equal(calls[0].options.headers["X-Token"], "configured-token");
  assert.equal(calls[0].options.headers["X-Username"], "configured-user");
  assert.equal(calls[0].url, "https://screeps.com/api/auth/me?shard=shard2");
});

test("proxies a configured private Screeps server", async () => {
  const calls = [];
  const handler = createProxyHandler({
    baseUrl: "https://private.screeps.example:21025",
    allowedOrigins: ["https://private.screeps.example:21025"],
    token: "token",
    fetch: async (url) => {
      calls.push(url.toString());
      return new Response(JSON.stringify({ok: 1}), {status: 200});
    },
  });
  const response = await handler(request({endpoint: "/api/game/time", method: "GET"}));
  assert.equal(response.status, 200);
  assert.equal(calls[0], "https://private.screeps.example:21025/api/game/time");
});

test("rejects an invalid configured target", () => {
  assert.throws(() => createProxyHandler({baseUrl: "https://private.screeps.example:21025"}), /SCREEPS_BASE_URL/);
});

test("rejects proxy bodies over the configured size limit", async () => {
  const handler = createProxyHandler({baseUrl: "https://screeps.com", fetch, maxRequestBytes: 32});
  const response = await handler(request({endpoint: "/api/auth/me", method: "GET", padding: "x".repeat(100)}));
  assert.equal(response.status, 413);
});

test("rejects malformed JSON payload values", async () => {
  const handler = createProxyHandler({baseUrl: "https://screeps.com", fetch});
  for (const value of [null, [], 1, "text"]) {
    const response = await handler(request(value));
    assert.equal(response.status, 400);
  }
});

test("rejects malformed endpoints and unsupported methods", async () => {
  const handler = createProxyHandler({baseUrl: "https://screeps.com", fetch});
  assert.equal((await handler(request({endpoint: "https://evil.test", method: "GET"}))).status, 400);
  assert.equal((await handler(request({endpoint: "/api/test", method: "TRACE"}))).status, 400);
  assert.equal((await handler(request({}, "GET"))).status, 405);
});
