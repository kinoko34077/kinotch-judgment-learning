import test from "node:test";
import assert from "node:assert/strict";
import worker, { hexHash } from "../worker/index.js";

function fakeDatabase(userId) {
  return {
    prepare(sql) {
      return {
        bind() {
          return {
            async first() {
              if (sql.includes("FROM auth_sessions")) return { user_id: String(userId) };
              return null;
            },
            async all() { return { results: [] }; }
          };
        }
      };
    }
  };
}
const origin = "https://example.workers.dev";
const token = "A".repeat(50);
const env = ownerId => ({ DB: fakeDatabase(ownerId), PUBLIC_ORIGIN: origin, OWNER_GITHUB_USER_ID: "123456" });
test("non-owner session can never read personal history", async () => {
  const res = await worker.fetch(new Request(origin + "/api/history", { headers: { Cookie: "__Host-knt_session=" + token } }), env(123457));
  assert.equal(res.status, 401);
  assert.equal(res.headers.get("Cache-Control"), "no-store");
});
test("owner session can read personal history", async () => {
  const res = await worker.fetch(new Request(origin + "/api/history", { headers: { Cookie: "__Host-knt_session=" + token } }), env(123456));
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).history, []);
});
test("cross-origin POST to answer API is rejected for an owner", async () => {
  const res = await worker.fetch(new Request(origin + "/api/answer", { method: "POST", headers: { Cookie: "__Host-knt_session=" + token, Origin: "https://attacker.example", "Content-Type": "application/json" }, body: JSON.stringify({questionId:"uiux-001",action:"GO"}) }), env(123456));
  assert.equal(res.status, 403);
});
test("unsupported content type rejected for an owner", async () => {
  const res = await worker.fetch(new Request(origin + "/api/answer", { method: "POST", headers: { Cookie: "__Host-knt_session=" + token, Origin:origin,"Content-Type":"text/plain" }, body: "{}" }), env(123456));
  assert.equal(res.status, 403);
});
test("session hashing deterministic, never raw at rest", async () => {
  const first = await hexHash(token);
  assert.equal(first.length, 64);
  assert.notEqual(first, token);
  assert.equal(first, await hexHash(token));
});
test("authenticated /app requests canonical route once and sets private asset headers", async () => {
  let calls = 0;
  let servedPath = null;
  const e = {
    ...env(123456),
    ASSETS: {
      async fetch(request) {
        calls++;
        servedPath = new URL(request.url).pathname;
        return new Response("<!doctype html><title>Owner workspace</title>", {
          status: 200, headers: { "Content-Type": "text/html" }
        });
      }
    }
  };
  const res = await worker.fetch(new Request(origin + "/app", {
    headers: { Cookie: "__Host-knt_session=" + token }
  }), e);
  assert.equal(res.status, 200);
  assert.equal(servedPath, "/app");
  assert.equal(calls, 1);
  assert.equal(res.headers.get("Cache-Control"), "no-store");
  assert.equal(res.headers.get("X-Frame-Options"), "DENY");
  assert.match(res.headers.get("Content-Security-Policy"), /frame-ancestors 'none'/);
});

test("nonowner cannot load /app assets", async () => {
  let calls = 0;
  const e = { ...env(123457), ASSETS: { fetch() { calls++; return new Response("unexpected"); } } };
  const res = await worker.fetch(new Request(origin + "/app", {
    headers: { Cookie: "__Host-knt_session=" + token }
  }), e);
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("Location"), "/");
  assert.equal(calls, 0);
});

test("direct /app.html access redirects to authenticated app gate", async () => {
  const res = await worker.fetch(new Request(origin + "/app.html"), {});
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("Location"), "/app");
  assert.equal(res.headers.get("Cache-Control"), "no-store");
});

test("unknown /api/undo question is a 404 rather than a DB FK error", async () => {
  const e = env(123456);
  e.DB.batch = async () => { throw Error("should not mutate"); };
  const res = await worker.fetch(new Request(origin + "/api/undo", {
    method: "POST",
    headers: {
      Cookie: "__Host-knt_session=" + token,
      Origin: origin,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ questionId: "unknown-1" })
  }), e);
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error, "Unknown question");
});
