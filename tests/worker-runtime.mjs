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
  "--var", "OWNER_GITHUB_USER_ID:" + ownerId,
  "--var", "PUBLIC_ORIGIN:https://example.workers.dev"], {
  stdio: ["ignore", "pipe", "pipe"],
  detached: true // Linux CI: kill the entire npx → Wrangler process group
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

  for (const path of ["/%61pp", "/app%2Ehtml", "/app%2F", "//app", "/app/", "/app.html/", "/app/index.html", "/APP"]) {
    const res = await request(path);
    assert.ok([302,404].includes(res.status), "Unexpected public alias response for "+path+": "+res.status);
    const text = await res.text();
    assert.ok(!text.includes("PRIVATE JUDGMENT SESSION"), "Private shell leaked at "+path);
  }

  const privatePage = await request("/app", { headers: { Cookie: cookie } });
  assert.equal(privatePage.status, 200, "Owner /app should serve HTML, not redirect");
  assert.match(await privatePage.text(), /PRIVATE JUDGMENT SESSION/);
  assert.equal(privatePage.headers.get("Cache-Control"), "no-store");
  assert.equal(privatePage.headers.get("X-Frame-Options"), "DENY");

  const rejected = await request("/api/me");
  assert.equal(rejected.status, 401, "Anonymous owner-only API access must fail");
  assert.equal(rejected.headers.get("Cache-Control"), "no-store");

  // Research-only adapter is owner-gated and never inserts response rows.
  const previewAnon = await request("/api/research/seeds");
  assert.equal(previewAnon.status, 401, "No public access to research preview");
  const previewOwner = await request("/api/research/seeds", { headers: {Cookie:cookie} });
  assert.equal(previewOwner.status, 200);
  const previewList = await previewOwner.json();
  assert.equal(previewList.researchOnly, true);
  assert.equal(previewList.seeds.length, 14);
  assert.ok(previewList.seeds.every(s => s.previewOnly && !s.runtimeEligible));
  const researchPost = await request("/api/research/evaluate", {
    method:"POST", headers:{Cookie:cookie,Origin:"https://example.workers.dev","Content-Type":"application/json"},
    body:JSON.stringify({seedId:"Q-BAS-001",selections:{}})
  });
  assert.equal(researchPost.status, 200);
  const researchResult = await researchPost.json();
  assert.equal(researchResult.evaluation.status, "defer_missing_context");
  assert.equal(researchResult.evaluation.go_recorded,false);
  assert.equal(researchResult.evaluation.rule_actionable,false);
  const previewRows = await request("/api/history");
  assert.equal((await previewRows.json()).history.length, 0, "No D1 history writes from research preview");

  const domains = await request("/api/domains", { headers: { Cookie: cookie } });
  assert.equal(domains.status, 200);
  assert.equal((await domains.json()).domains.length, 3);

  const post = (path, payload) => request(path, {
    method: "POST",
    headers: {Cookie:cookie, Origin:"https://example.workers.dev", "Content-Type":"application/json"},
    body: JSON.stringify(payload)
  });
  const prior = await request("/api/history",{headers:{Cookie:cookie}});
  assert.equal(prior.status,200);
  assert.equal((await prior.json()).history.length,0,"Local test DB must be fresh");
  const saved = await post("/api/answer",{questionId:"uiux-001",action:"GO"});
  assert.equal(saved.status,200,"Owner GO write should persist");
  assert.equal((await saved.json()).saved,true);
  const history = await request("/api/history",{headers:{Cookie:cookie}});
  assert.equal(history.status,200);
  const stored = (await history.json()).history;
  assert.equal(stored.length,1);
  assert.equal(stored[0].action,"GO");
  const anonymousHistory = await request("/api/history");
  assert.equal(anonymousHistory.status, 200, "Public history is readable");
  const publicEntries = (await anonymousHistory.json()).history;
  assert.equal(publicEntries.length, 1);
  assert.equal(publicEntries[0].action, "GO");
  assert.equal("owner_id" in publicEntries[0], false, "Do not expose owner ID");

  // Anonymous reading never elevates to mutations, even with matching Origin.
  const anonymousWrite = await request("/api/answer", {
    method:"POST", headers:{"Content-Type":"application/json", Origin:"https://example.workers.dev"},
    body:JSON.stringify({questionId:"uiux-001",action:"CORRECT",note:"unauthorized"})
  });
  assert.equal(anonymousWrite.status, 401, "Public history cannot authorize writes");

  const undone = await post("/api/undo",{questionId:"uiux-001"});
  assert.equal(undone.status,200);
  assert.equal((await undone.json()).undone,true);
  const finalHistory = await request("/api/history",{headers:{Cookie:cookie}});
  assert.equal((await finalHistory.json()).history.length,0);
  const next = await request("/api/next?domain=uiux",{headers:{Cookie:cookie}});
  assert.equal((await next.json()).question.id,"uiux-001");
  // Deferral must remain revisitable and must not immediately repeat forever.
  const deferred = await post("/api/answer",{questionId:"uiux-001",action:"SKIP"});
  assert.equal(deferred.status, 200);
  const standardNext = await request("/api/next?domain=uiux",{headers:{Cookie:cookie}});
  const standardResult = await standardNext.json();
  assert.equal(standardResult.question, null);
  assert.equal(standardResult.pendingCount, 1);
  const review = await request("/api/next?domain=uiux&pending=1",{headers:{Cookie:cookie}});
  assert.equal((await review.json()).question.id,"uiux-001");
  const publicDeferred = await request("/api/history");
  assert.equal((await publicDeferred.json()).history[0].action,"SKIP");
  const resolved = await post("/api/answer",{questionId:"uiux-001",action:"CORRECT",correctionKind:"premise",note:"設問の前提を修正"});
  assert.equal(resolved.status,200);
  const typedHistory = await request("/api/history");
  const typedEntries = (await typedHistory.json()).history;
  assert.equal(typedEntries[0].correction_kind,"premise");
  assert.equal(typedEntries[0].action,"CORRECT");
  const finalPending = await request("/api/next?domain=uiux",{headers:{Cookie:cookie}});
  assert.equal((await finalPending.json()).pendingCount,0);
  const cleanup = await post("/api/undo",{questionId:"uiux-001"});
  assert.equal(cleanup.status,200);
  console.log("LOCAL WORKER E2E PASS: public/owner routing; DB reads; saved GO, history, undo and replayable question; public GET + owner-only mutations");
} finally {
  // Killing only npx can orphan its Wrangler subprocess and hang the CI job.
  // Runs only on disposable Ubuntu CI; never affects a production Worker.
  if (child.pid) {
    try { process.kill(-child.pid, "SIGKILL"); } catch {}
  }
  child.stdout.destroy();
  child.stderr.destroy();
  await delay(250);
}
