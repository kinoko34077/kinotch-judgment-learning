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
test("public history is readable without owner identity but cannot expose sessions", async () => {
  const res = await worker.fetch(new Request(origin + "/api/history", { headers: { Cookie: "__Host-knt_session=" + token } }), env(123457));
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).history, []);
  assert.equal(res.headers.get("Cache-Control"), "no-store");
  assert.equal(res.headers.get("Set-Cookie"), null);
});
test("nonowner is still rejected from owner-only question and mutation APIs", async () => {
  const guarded = env(123457);
  for (const path of ["/api/me", "/api/next?domain=uiux", "/api/correction-materials"]) {
    const res = await worker.fetch(new Request(origin + path, {headers: { Cookie:"__Host-knt_session="+token }}), guarded);
    assert.equal(res.status, 401);
  }
  const write = await worker.fetch(new Request(origin + "/api/answer", {method:"POST", headers:{ Origin:origin, "Content-Type":"application/json" }, body:JSON.stringify({ questionId:"uiux-001",action:"GO" })}), guarded);
  assert.equal(write.status, 401);
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

test("encoded, aliased and slash-variant app paths never bypass the private HTML gate", async () => {
  const bad = ["/%61pp", "/app%2Ehtml", "/app%2F", "//app", "/app/", "/app.html/", "/app/index.html", "/APP"];
  let count = 0;
  const guarded = { ...env(123457), ASSETS: { fetch() { count++; return new Response("leaked"); } } };
  for (const path of bad) {
    const res = await worker.fetch(new Request(origin + path), guarded);
    assert.ok([302, 404].includes(res.status), path + ": " + res.status);
    assert.notEqual(await res.text(), "leaked", path);
  }
  assert.equal(count, 0, "no ambiguous app URL can directly fetch static app assets");
});

test("OAuth rate limiter rejects excess traffic before ANY D1 mutation", async () => {
  let touchedDb = 0;
  let calls = 0;
  const config = {
    GITHUB_CLIENT_ID: "test-public-id",
    GITHUB_CLIENT_SECRET: "unit-test-only",
    OWNER_GITHUB_USER_ID: "123456",
    PUBLIC_ORIGIN: origin,
    AUTH_RATE_LIMIT: {
      async limit({key}) { assert.equal(key, "203.0.113.5"); calls++; return {success:false}; }
    },
    DB: { prepare() { touchedDb++; throw Error("D1 must never be accessed"); } }
  };
  const res = await worker.fetch(new Request(origin + "/auth/start", {headers:{"CF-Connecting-IP":"203.0.113.5"}}), config);
  assert.equal(res.status, 429);
  assert.equal(res.headers.get("Retry-After"), "60");
  assert.equal(res.headers.get("Cache-Control"), "no-store");
  assert.equal(touchedDb, 0);
  assert.equal(calls, 1);
});

test("missing rate-limit binding fails closed without touching D1", async () => {
  let touchedDb = false;
  const res = await worker.fetch(new Request(origin + "/auth/start"), {
    GITHUB_CLIENT_ID: "test-public-id", GITHUB_CLIENT_SECRET: "unit-test-only", OWNER_GITHUB_USER_ID:"123456",
    PUBLIC_ORIGIN: origin,
    DB: {prepare(){touchedDb = true; throw Error("Unexpected DB access");}}
  });
  assert.equal(res.status, 503);
  assert.equal(touchedDb, false);
});

test("OAuth callback attempts are limited before any D1 query or deletion", async () => {
  let dbCalls = 0, rateCalls = 0;
  const res = await worker.fetch(new Request(origin + "/auth/callback?state=invalid&code=fixture", {
    headers: { "CF-Connecting-IP": "203.0.113.5" }
  }), {
    AUTH_RATE_LIMIT: {async limit({key}) {
      assert.equal(key, "oauth-callback:203.0.113.5");
      rateCalls++;
      return {success:false};
    }},
    DB: {prepare() {dbCalls++; throw Error("D1 must not be touched when rate limited");}}
  });
  assert.equal(res.status, 429);
  assert.equal(res.headers.get("Retry-After"), "60");
  assert.equal(res.headers.get("Cache-Control"), "no-store");
  assert.equal(dbCalls, 0);
  assert.equal(rateCalls, 1);
});

test("missing callback rate-limit binding fails closed before D1", async () => {
  let dbCalls = 0;
  const res = await worker.fetch(new Request(origin + "/auth/callback?state=invalid&code=fixture"), {
    DB: {prepare(){dbCalls++; throw Error("D1 must not be touched");}}
  });
  assert.equal(res.status, 503);
  assert.equal(dbCalls, 0);
});
