// Isolated local Cloudflare Worker + D1 runtime acceptance check.
// Production credentials, Cloudflare remote DB and OAuth provider are never used.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const config = "wrangler.jsonc";
const database = "kinotch-judgment-learning";
const origin = "http://127.0.0.1:8798";
const ownerId = "79015263";
const session = "A".repeat(50);
const sessionHash = createHash("sha256").update(session).digest("hex");
const cookie = "__Host-knt_session=" + session;

function runLocal(args) {
  const result = spawnSync("npx", ["--yes", "wrangler@4.151.1", ...args], {
    encoding: "utf8", timeout: 60_000, maxBuffer: 1024 * 1024 * 3
  });
  if (result.status !== 0) throw Error(
    "Local Wrangler command failed: " + args.join(" ") + "\n" +
    (result.stderr || "") + "\n" + (result.stdout || "")
  );
}

runLocal(["d1", "migrations", "apply", database, "--local", "--config", config]);
runLocal(["d1", "execute", database, "--local", "--config", config,
  "--command", "INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES ('" +
    sessionHash + "','" + ownerId + "'," + (Date.now() + 86_400_000) + ")"
]);

const child = spawn("npx", ["--yes", "wrangler@4.151.1", "dev", "--local",
  "--ip", "127.0.0.1", "--port", "8798", "--config", config,
  "--var", "OWNER_GITHUB_USER_ID:" + ownerId], {
  stdio: ["ignore", "pipe", "pipe"]
});
let startupOutput = "";
child.stdout.on("data", part => { startupOutput += part.toString(); });
child.stderr.on("data", part => { startupOutput += part.toString(); });

async function request(path, opts = {}) {
  return fetch(origin + path, { redirect: "manual", ...opts });
}
try {
  let ready = false;
  for (let i = 0; i < 80; i++) {
    if (child.exitCode != null) throw Error("Wrangler dev exited: " + startupOutput);
    try {
      const res = await request("/");
      if (res.ok) { ready = true; break; }
    } catch {}
    await delay(500);
  }
  assert.ok(ready, "Worker failed to start: " + startupOutput);

  const publicPage = await request("/");
  assert.equal(publicPage.status, 200, "Public landing not served");

  const directHtml = await request("/app.html");
  assert.equal(directHtml.status, 302, "Direct HTML access must reach auth gate");
  assert.equal(directHtml.headers.get("Location"), "/app");

  const anonymous = await request("/app");
  assert.equal(anonymous.status, 302, "Unauthenticated /app must redirect");
  assert.equal(anonymous.headers.get("Location"), "/");

  const privatePage = await request("/app", { headers: { Cookie: cookie } });
  assert.equal(privatePage.status, 200, "Owner /app should serve HTML, not redirect");
  assert.match(await privatePage.text(), /PRIVATE JUDGMENT SESSION/);
  assert.equal(privatePage.headers.get("Cache-Control"), "no-store");
  assert.equal(privatePage.headers.get("X-Frame-Options"), "DENY");

  const rejected = await request("/api/history");
  assert.equal(rejected.status, 401, "Anonymous personal API access must fail");
  assert.equal(rejected.headers.get("Cache-Control"), "no-store");

  const domains = await request("/api/domains", { headers: { Cookie: cookie } });
  assert.equal(domains.status, 200);
  assert.equal((await domains.json()).domains.length, 3);
  console.log("LOCAL WORKER E2E PASS: public HTML; gated /app.html; anonymous redirect; owner /app 200; private 401; D1 domains=3");
} finally {
  child.kill();
  await delay(500);
}
