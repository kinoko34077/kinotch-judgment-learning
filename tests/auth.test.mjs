import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedGitHubUser, validAnswer, randomToken, hexHash } from "../worker/index.js";
test("numeric, stable GitHub identity (not username)", () => {
  assert.equal(isAllowedGitHubUser(123456, "123456"), true);
  assert.equal(isAllowedGitHubUser(123457, "123456"), false);
  assert.equal(isAllowedGitHubUser("123456", "123456"), false);
  assert.equal(isAllowedGitHubUser(0, "0"), false);
  assert.equal(isAllowedGitHubUser(1, "alice"), false);
});
test("answer validation", () => {
  assert.equal(validAnswer({ questionId: "uiux-001", action: "GO" }), true);
  assert.equal(validAnswer({ questionId: "uiux-001", action: "CORRECT", note: "条件により異なる" }), true);
  assert.equal(validAnswer({ questionId: "uiux-001", action: "CORRECT" }), false);
  assert.equal(validAnswer({ questionId: "uiux-001", action: "ADMIN" }), false);
  assert.equal(validAnswer({ questionId: "../../secret", action: "GO" }), false);
  assert.equal(validAnswer({ questionId: "uiux-001", action: "CORRECT", note: "x".repeat(3001) }), false);
});
test("random tokens and session hash", async () => {
  const a = randomToken(), b = randomToken();
  assert.notEqual(a, b);
  assert.match(a, /^[A-Za-z0-9_-]{40,100}$/);
  assert.equal((await hexHash(a)).length, 64);
});
test("private API rejects unauthenticated users", async () => {
  const app = (await import("../worker/index.js")).default;
  const res = await app.fetch(new Request("https://example.workers.dev/api/history"), { OWNER_GITHUB_USER_ID: "1" });
  assert.equal(res.status, 401);
  assert.equal(res.headers.get("Cache-Control"), "no-store");
});
test("mutation with wrong origin rejected even if logged out", async () => {
  const app = (await import("../worker/index.js")).default;
  const res = await app.fetch(new Request("https://example.workers.dev/auth/logout", { method: "POST", headers: { Origin: "https://evil.example", "Content-Type": "application/json" }, body: "{}" }), { PUBLIC_ORIGIN: "https://example.workers.dev" });
  assert.equal(res.status, 403);
});