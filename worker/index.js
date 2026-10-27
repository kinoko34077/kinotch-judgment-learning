const SESSION_COOKIE = "__Host-knt_session";
const FLOW_COOKIE = "__Host-knt_oauth";
const WEEK = 7 * 86400;
const CORRECTION_KINDS = new Set(["alternative", "partial", "premise", "exception", "supplement", "unspecified"]);

const GITHUB_OAUTH_EXCHANGE_ERRORS = new Set([
  "incorrect_client_credentials",
  "redirect_uri_mismatch",
  "bad_verification_code",
  "unverified_user_email"
]);

// Restrict diagnostics to fixed provider codes. Never echo provider descriptions,
// authorization codes, credentials, tokens, or full upstream response objects.
export function classifyGitHubOAuthExchangeError(payload) {
  const code = payload && typeof payload === "object" ? payload.error : null;
  return typeof code === "string" && GITHUB_OAUTH_EXCHANGE_ERRORS.has(code) ? code : "unknown";
}

export function hexHash(input) {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(input)).then(
    bytes => [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, "0")).join("")
  );
}
export function randomToken(bytes = 32) {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...data)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function isAllowedGitHubUser(actualId, allowedId) {
  return Number.isSafeInteger(actualId) && actualId > 0 && String(actualId) === String(allowedId ?? "");
}
export function validAnswer(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  if (typeof input.questionId !== "string" || !/^[a-z0-9-]{1,80}$/.test(input.questionId)) return false;
  if (!["GO", "CORRECT", "SKIP"].includes(input.action)) return false;
  if (input.answer != null && (typeof input.answer !== "string" || input.answer.length > 1000)) return false;
  if (input.note != null && (typeof input.note !== "string" || input.note.length > 3000)) return false;
  if (input.action === "CORRECT") {
    if (!(String(input.answer ?? "") + String(input.note ?? "")).trim()) return false;
    if (input.correctionKind != null && !CORRECTION_KINDS.has(input.correctionKind)) return false;
  } else if (input.correctionKind != null && input.correctionKind !== "") {
    return false;
  }
  return true;
}
function cookieValue(req, name) {
  const raw = req.headers.get("Cookie") || "";
  const found = raw.split(";").map(s => s.trim()).find(s => s.startsWith(name + "="));
  return found ? found.slice(name.length + 1) : null;
}
function cookie(name, value, maxAge) {
  return name + "=" + value + "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=" + maxAge;
}
function privateHeaders() {
  return { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY", "Content-Security-Policy": "frame-ancestors 'none'" };
}
function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...privateHeaders(), ...extra } });
}
function redirect(path, cookieHeader) {
  const headers = { Location: path, ...privateHeaders() };
  if (cookieHeader) headers["Set-Cookie"] = cookieHeader;
  return new Response(null, { status: 302, headers });
}
function origin(env) {
  const base = String(env.PUBLIC_ORIGIN || "");
  const url = new URL(base);
  if (url.protocol !== "https:" || url.pathname !== "/" || url.search || url.hash) throw new Error("Invalid PUBLIC_ORIGIN");
  return url.origin;
}
function checkMutation(req, env) {
  const ownOrigin = origin(env);
  const supplied = req.headers.get("Origin");
  return supplied === ownOrigin && req.headers.get("Content-Type")?.toLowerCase().startsWith("application/json");
}
async function readSmallJSON(req) {
  const len = Number(req.headers.get("Content-Length") || 0);
  if (len > 8192) throw Error("Request exceeds 8 KiB");
  const reader = req.body?.getReader();
  if (!reader) throw Error("No body");
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 8192) { await reader.cancel(); throw Error("Request exceeds 8 KiB"); }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  const all = new Uint8Array(size);
  let offset = 0;
  for (const x of chunks) { all.set(x, offset); offset += x.length; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(all));
}
async function auth(req, env) {
  const token = cookieValue(req, SESSION_COOKIE);
  if (!token || !/^[A-Za-z0-9_-]{40,100}$/.test(token) || !env.DB) return false;
  const hashed = await hexHash(token);
  const row = await env.DB.prepare("SELECT user_id FROM auth_sessions WHERE token_hash = ? AND expires_at > ?").bind(hashed, Date.now()).first();
  return Boolean(row && isAllowedGitHubUser(Number(row.user_id), env.OWNER_GITHUB_USER_ID));
}
function logoutCookie() { return cookie(SESSION_COOKIE, "", 0); }
function protectedAssetHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("Content-Security-Policy", "default-src 'self'; base-uri 'none'; object-src 'none'; form-action 'self'; frame-ancestors 'none'");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function login(req, env) {
  // Log binding names only to private Worker logs; never log values or expose details to callers.
  const requiredBindings = ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET", "OWNER_GITHUB_USER_ID", "DB", "AUTH_RATE_LIMIT"];
  const missingBindings = requiredBindings.filter(name => !env[name]);
  if (missingBindings.length) {
    console.warn("OAuth runtime configuration incomplete", { missingBindings });
    return json({ error: "Authentication not configured" }, 503);
  }
  // Cloudflare supplies CF-Connecting-IP at the edge; do not accept a caller
  // supplied query parameter or user identity as a rate-limit key.
  const key = req.headers.get("CF-Connecting-IP") || "unidentified";
  const { success } = await env.AUTH_RATE_LIMIT.limit({ key });
  if (!success) return json({ error: "Too many login attempts" }, 429, { "Retry-After": "60" });
  const state = randomToken();
  const verifier = randomToken(48);
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = btoa(String.fromCharCode(...new Uint8Array(hash))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  // Bound stale authorization and session rows without touching active login sessions.
  await env.DB.prepare("DELETE FROM oauth_pending WHERE expires_at < ?").bind(Date.now()).run();
  await env.DB.prepare("DELETE FROM auth_sessions WHERE expires_at < ?").bind(Date.now()).run();
  await env.DB.prepare("INSERT INTO oauth_pending (state_hash, verifier, expires_at) VALUES (?, ?, ?)").bind(await hexHash(state), verifier, Date.now() + 600000).run();
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  url.searchParams.set("redirect_uri", origin(env) + "/auth/callback");
  // This installation uses a GitHub OAuth App. Omit optional scopes to
  // identify the signed-in account via GET /user without requesting private
  // repository or other unnecessary permissions. Do not infer app type from
  // the shared GitHub authorize/token endpoints.
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return redirect(url.toString(), cookie(FLOW_COOKIE, state, 600));
}
async function callback(req, env) {
  // Apply the same edge rate-limiting service with a distinct bucket from
  // /auth/start, so a successful OAuth round trip does not share its quota.
  if (!env.AUTH_RATE_LIMIT) return json({ error: "Authentication not configured" }, 503);
  const key = "oauth-callback:" + (req.headers.get("CF-Connecting-IP") || "unidentified");
  const { success } = await env.AUTH_RATE_LIMIT.limit({ key });
  if (!success) return json({ error: "Too many callback attempts" }, 429, { "Retry-After": "60" });
  const url = new URL(req.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const stored = cookieValue(req, FLOW_COOKIE);
  if (!state || !code || !stored || state !== stored || !/^[A-Za-z0-9_-]{40,100}$/.test(state)) return json({ error: "OAuth validation failed" }, 400, { "Set-Cookie": cookie(FLOW_COOKIE, "", 0) });
  const hashed = await hexHash(state);
  const row = await env.DB.prepare("SELECT verifier FROM oauth_pending WHERE state_hash = ? AND expires_at > ?").bind(hashed, Date.now()).first();
  await env.DB.prepare("DELETE FROM oauth_pending WHERE state_hash = ?").bind(hashed).run();
  if (!row) return json({ error: "OAuth state expired or already used" }, 400, { "Set-Cookie": cookie(FLOW_COOKIE, "", 0) });
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST", headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code, redirect_uri: origin(env) + "/auth/callback", code_verifier: row.verifier })
  });
  if (!response.ok) return json({ error: "OAuth provider unavailable" }, 502, { "Set-Cookie": cookie(FLOW_COOKIE, "", 0) });
  const tokenData = await response.json();
  if (!tokenData?.access_token) {
    const reason = classifyGitHubOAuthExchangeError(tokenData);
    console.warn("GitHub OAuth token exchange rejected", { reason });
    return json({ error: "OAuth exchange failed", reason }, 401, { "Set-Cookie": cookie(FLOW_COOKIE, "", 0) });
  }
  const who = await fetch("https://api.github.com/user", {
    headers: { Authorization: "Bearer " + tokenData.access_token, Accept: "application/vnd.github+json", "User-Agent": "kinotch-judgment-learning", "X-GitHub-Api-Version": "2022-11-28" }
  });
  if (!who.ok) return json({ error: "OAuth identity lookup failed" }, 502, { "Set-Cookie": cookie(FLOW_COOKIE, "", 0) });
  const identity = await who.json();
  if (!isAllowedGitHubUser(identity.id, env.OWNER_GITHUB_USER_ID)) return json({ error: "Account is not authorized" }, 403, { "Set-Cookie": cookie(FLOW_COOKIE, "", 0) });
  const sessionToken = randomToken();
  await env.DB.prepare("INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").bind(await hexHash(sessionToken), String(identity.id), Date.now() + WEEK * 1000).run();
  const headers = new Headers({ Location: "/app", ...privateHeaders() });
  headers.append("Set-Cookie", cookie(SESSION_COOKIE, sessionToken, WEEK));
  headers.append("Set-Cookie", cookie(FLOW_COOKIE, "", 0));
  return new Response(null, { status: 302, headers });
}
async function api(req, env, url) {
  const p = url.pathname;
  // Public reading of owner judgment history is explicitly allowed. Only this
  // GET route is public; all mutation and owner-workspace APIs remain gated.
  if (req.method === "GET" && p === "/api/history") {
    if (!env.DB || !env.OWNER_GITHUB_USER_ID) return json({ error: "Data unavailable" }, 503);
    const rows = await env.DB.prepare("SELECT r.question_id, r.action, r.answer, r.note, r.correction_kind, r.updated_at, r.revision, q.prompt, q.domain_id FROM responses r JOIN questions q ON q.id = r.question_id WHERE r.owner_id = ? ORDER BY r.updated_at DESC LIMIT 100").bind(String(env.OWNER_GITHUB_USER_ID)).all();
    return json({ history: rows.results });
  }
  if (!(await auth(req, env))) return json({ error: "Unauthorized" }, 401);
  if (req.method === "GET" && p === "/api/me") return json({ owner: true });
  if (req.method === "GET" && p === "/api/domains") {
    const rows = await env.DB.prepare("SELECT id, name FROM domains ORDER BY id").all();
    return json({ domains: rows.results });
  }
  if (req.method === "GET" && p === "/api/next") {
    const domain = url.searchParams.get("domain");
    if (!domain || !/^[a-z0-9-]{1,40}$/.test(domain)) return json({ error: "Invalid domain" }, 400);
    // SKIP remains recorded, but is not permanently finished. Explicit review
    // avoids re-showing a single deferred question in an endless loop.
    const showPending = url.searchParams.get("pending") === "1";
    const owner = String(env.OWNER_GITHUB_USER_ID);
    const pending = await env.DB.prepare("SELECT COUNT(*) AS count FROM responses r JOIN questions q ON q.id = r.question_id WHERE r.owner_id = ? AND q.domain_id = ? AND r.action = 'SKIP'").bind(owner, domain).first();
    const q = await env.DB.prepare("SELECT q.id, q.domain_id, q.prompt, q.choices_json, q.ai_answer, q.ai_reason, q.source_note FROM questions q LEFT JOIN responses r ON r.question_id = q.id AND r.owner_id = ? WHERE q.domain_id = ? AND " + (showPending ? "r.action = 'SKIP'" : "r.question_id IS NULL") + " ORDER BY " + (showPending ? "r.updated_at" : "q.id") + " LIMIT 1").bind(owner, domain).first();
    if (!q) return json({ question: null, pendingCount: Number(pending?.count || 0) });
    return json({ question: { id: q.id, domain: q.domain_id, prompt: q.prompt, choices: JSON.parse(q.choices_json), aiAnswer: q.ai_answer, aiReason: q.ai_reason, source: q.source_note }, pendingCount: Number(pending?.count || 0), fromPending: showPending });
  }
  if (req.method === "POST" && p === "/api/answer") {
    if (!checkMutation(req, env)) return json({ error: "Origin and JSON content type required" }, 403);
    let data;
    try { data = await readSmallJSON(req); } catch { return json({ error: "Invalid JSON or body too large" }, 400); }
    if (!validAnswer(data)) return json({ error: "Invalid answer" }, 400);
    const exists = await env.DB.prepare("SELECT id FROM questions WHERE id = ?").bind(data.questionId).first();
    if (!exists) return json({ error: "Unknown question" }, 404);
    const owner = String(env.OWNER_GITHUB_USER_ID);
    const now = Date.now();
    const kind = data.action === "CORRECT" ? (data.correctionKind || "unspecified") : "";
    await env.DB.batch([
      env.DB.prepare("INSERT INTO responses (owner_id, question_id, action, answer, note, updated_at, revision, correction_kind) VALUES (?, ?, ?, ?, ?, ?, 1, ?) ON CONFLICT(owner_id, question_id) DO UPDATE SET action=excluded.action, answer=excluded.answer, note=excluded.note, updated_at=excluded.updated_at, correction_kind=excluded.correction_kind, revision=revision+1").bind(owner, data.questionId, data.action, String(data.answer || ""), String(data.note || ""), now, kind),
      env.DB.prepare("INSERT INTO response_events (owner_id, question_id, action, answer, note, created_at, correction_kind) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(owner, data.questionId, data.action, String(data.answer || ""), String(data.note || ""), now, kind)
    ]);
    return json({ saved: true });
  }
  if (req.method === "POST" && p === "/api/undo") {
    if (!checkMutation(req, env)) return json({ error: "Origin and JSON content type required" }, 403);
    let data;
    try { data = await readSmallJSON(req); } catch { return json({ error: "Invalid body" }, 400); }
    if (!data || typeof data.questionId !== "string" || !/^[a-z0-9-]{1,80}$/.test(data.questionId)) return json({ error: "Invalid question ID" }, 400);
    const exists = await env.DB.prepare("SELECT id FROM questions WHERE id = ?").bind(data.questionId).first();
    if (!exists) return json({ error: "Unknown question" }, 404);
    const owner = String(env.OWNER_GITHUB_USER_ID);
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare("DELETE FROM responses WHERE owner_id = ? AND question_id = ?").bind(owner, data.questionId),
      env.DB.prepare("INSERT INTO response_events (owner_id, question_id, action, answer, note, created_at) VALUES (?, ?, 'UNDO', '', '', ?)").bind(owner, data.questionId, now)
    ]);
    return json({ undone: true });
  }
  return json({ error: "Not found" }, 404);
}
export default {
  async fetch(req, env) {
    try {
      const url = new URL(req.url);
      const path = url.pathname;
      // Our public asset names are ASCII. Reject encoded / ambiguous paths
      // before Cloudflare Static Assets may decode/canonicalize them differently.
      if (/%|\\|\/\//.test(path)) return json({ error: "Not found" }, 404);
      if (path.startsWith("/api/")) return await api(req, env, url);
      if (path === "/auth/start" && req.method === "GET") return await login(req, env);
      if (path === "/auth/callback" && req.method === "GET") return await callback(req, env);
      if (path === "/auth/logout" && req.method === "POST") {
        if (!checkMutation(req, env)) return json({ error: "Origin and JSON content type required" }, 403);
        const t = cookieValue(req, SESSION_COOKIE);
        if (t && env.DB) await env.DB.prepare("DELETE FROM auth_sessions WHERE token_hash = ?").bind(await hexHash(t)).run();
        return json({ loggedOut: true }, 200, { "Set-Cookie": logoutCookie() });
      }
      // Normalize every app HTML alias through /app's authorization gate.
      // /app.js stays a non-secret public JavaScript asset.
      if (/^\/app(?:\.html)?(?:\/.*)?$/i.test(path) && path !== "/app") return redirect("/app");
      if (path === "/app" && (req.method === "GET" || req.method === "HEAD")) {
        if (!(await auth(req, env))) return redirect("/");
        // Static Assets canonicalizes /app.html to /app; request the canonical path
        // directly to prevent a client-visible 307 loop.
        const asset = await env.ASSETS.fetch(new Request(new URL("/app", req.url), req));
        return protectedAssetHeaders(asset);
      }
      if (path.startsWith("/auth/") || path.startsWith("/api/")) return json({ error: "Not found" }, 404);
      if (req.method !== "GET" && req.method !== "HEAD") return json({ error: "Method not allowed" }, 405);
      return env.ASSETS.fetch(req);
    } catch (e) {
      console.error("Request failed", String(e?.name || "Error"));
      return json({ error: "Internal server error" }, 500);
    }
  }
};