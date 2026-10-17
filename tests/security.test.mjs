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