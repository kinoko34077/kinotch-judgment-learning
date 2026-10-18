import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/bootstrap.js";

const cases = ["/api/me", "/api/", "/auth/start", "/auth/callback", "/app", "/app/history", "/app/"];
for (const path of cases) {
  test(`private/auth route ${path} stays disabled without database/auth`, async () => {
    let servedAsset = false;
    const res = await worker.fetch(new Request(`https://example.workers.dev${path}`), {
      ASSETS: { fetch: () => { servedAsset = true; return new Response("unexpected"); } }
    });
    assert.equal(res.status, 404);
    assert.equal(res.headers.get("Cache-Control"), "no-store");
    assert.equal(servedAsset, false);
  });
}

for (const path of ["/", "/index.html", "/robots.txt", "/styles.css"]) {
  test(`public asset path ${path} passes to assets binding`, async () => {
    const url = `https://example.workers.dev${path}`;
    let passed;
    const res = await worker.fetch(new Request(url), {
      ASSETS: { fetch: request => { passed = request.url; return new Response("public", { status: 200 }); } }
    });
    assert.equal(res.status, 200);
    assert.equal(passed, url);
  });
}
