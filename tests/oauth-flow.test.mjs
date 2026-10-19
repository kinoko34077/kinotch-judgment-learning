import test from "node:test";
import assert from "node:assert/strict";
import worker, { hexHash } from "../worker/index.js";

const host = "https://example.workers.dev";
const TEST_OWNER = "123456";
function createDB() {
  const pending = new Map();
  const sessions = new Map();
  let writes = 0;
  return {
    pending, sessions, get writes() { return writes; },
    prepare(query) {
      return {
        bind(...args) {
          return {
            async first() {
              if (query.startsWith("SELECT verifier FROM oauth_pending")) {
                const row = pending.get(args[0]);
                return row?.expires_at > args[1] ? { verifier: row.verifier } : null;
              }
              if (query.startsWith("SELECT user_id FROM auth_sessions")) {
                const row = sessions.get(args[0]);
                return row?.expires_at > args[1] ? { user_id: row.user_id } : null;
              }
              throw Error("Unexpected SQL first: " + query);
            },
            async run() {
              writes++;
              if (query.startsWith("DELETE FROM oauth_pending WHERE expires_at")) {
                for (const [k, v] of pending) if (v.expires_at < args[0]) pending.delete(k);
              } else if (query.startsWith("DELETE FROM auth_sessions WHERE expires_at")) {
                for (const [k,v] of sessions) if (v.expires_at < args[0]) sessions.delete(k);
              } else if (query.startsWith("DELETE FROM oauth_pending WHERE state_hash")) {
                pending.delete(args[0]);
              } else if (query.startsWith("DELETE FROM auth_sessions WHERE token_hash")) {
                sessions.delete(args[0]);
              } else if (query.startsWith("INSERT INTO oauth_pending")) {
                pending.set(args[0], {verifier:args[1], expires_at:args[2]});
              } else if (query.startsWith("INSERT INTO auth_sessions")) {
                sessions.set(args[0], {user_id:args[1], expires_at:args[2]});
              } else throw Error("Unexpected SQL run: " + query);
              return {success:true};
            }
          };
        }
      };
    }
  };
}
function env(db) {
  return {
    DB: db, PUBLIC_ORIGIN: host, GITHUB_CLIENT_ID:"unit-client", 
    GITHUB_CLIENT_SECRET:"unit-test-secret", OWNER_GITHUB_USER_ID:TEST_OWNER,
    AUTH_RATE_LIMIT: {async limit(){return {success:true};}}
  };
}
const flowCookie = response => {
  const header = response.headers.get("Set-Cookie");
  assert.match(header, /__Host-knt_oauth=[A-Za-z0-9_-]+/);
  assert.match(header, /HttpOnly; Secure; SameSite=Lax/);
  return header.match(/__Host-knt_oauth=([^;]+)/)[1];
};
async function begin(e) {
  const response = await worker.fetch(new Request(host+"/auth/start"), e);
  assert.equal(response.status,302);
  const location = new URL(response.headers.get("Location"));
  assert.equal(location.origin,"https://github.com");
  assert.equal(location.pathname,"/login/oauth/authorize");
  assert.equal(location.searchParams.get("redirect_uri"),host+"/auth/callback");
  assert.equal(location.searchParams.get("code_challenge_method"),"S256");
  assert.equal(location.searchParams.get("client_id"),"unit-client");
  const token = flowCookie(response);
  assert.equal(location.searchParams.get("state"),token);
  return {state:token,challenge:location.searchParams.get("code_challenge")};
}
const callbackReq = ({state,code="fixture-code",cookie=true}) =>
  new Request(host + "/auth/callback?state="+encodeURIComponent(state)+"&code="+code, {
    headers: cookie ? {Cookie:"__Host-knt_oauth="+state} : {}
  });
function providerStub(id, seen) {
  return async (url,opts) => {
    seen.push({url:String(url),opts});
    if (String(url)==="https://github.com/login/oauth/access_token") {
      const body=new URLSearchParams(opts.body);
      assert.equal(body.get("client_id"),"unit-client");
      assert.equal(body.get("client_secret"),"unit-test-secret");
      assert.equal(body.get("redirect_uri"),host+"/auth/callback");
      const verifier=body.get("code_verifier");
      assert.ok(verifier && verifier.length > 40);
      const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(verifier));
      const b64=btoa(String.fromCharCode(...new Uint8Array(hash))).replace(/\\+/g,"-").replace(/\\//g,"_").replace(/=+$/,"");
      assert.equal(b64,seen.expectedChallenge);
      return new Response(JSON.stringify({access_token:"fake-test-token"}),{status:200});
    }
    assert.equal(String(url),"https://api.github.com/user");
    assert.equal(opts.headers.Authorization,"Bearer fake-test-token");
    return new Response(JSON.stringify({id}),{status:200});
  };
}

test("GitHub owner OAuth callback issues secure one-time session, replay denied and logout revokes", async () => {
  const db=createDB();
  const e=env(db);
  const {state,challenge}=await begin(e);
  assert.equal(db.pending.size,1);
  const seen=[];seen.expectedChallenge=challenge;
  const original=globalThis.fetch;
  globalThis.fetch=providerStub(123456,seen);
  try {
    const login=await worker.fetch(callbackReq({state}),e);
    assert.equal(login.status,302);
    assert.equal(login.headers.get("Location"),"/app");
    const cookies=login.headers.getSetCookie?.() || [login.headers.get("Set-Cookie")];
    const authCookie=cookies.find(v=>v?.includes("__Host-knt_session="));
    assert.ok(authCookie);
    assert.match(authCookie,/HttpOnly; Secure; SameSite=Lax/);
    const session=authCookie.match(/__Host-knt_session=([^;]+)/)[1];
    assert.equal(db.sessions.size,1);
    assert.ok(db.sessions.has(await hexHash(session)),"raw token must never be stored");
    assert.equal(db.pending.size,0);
    assert.equal((await worker.fetch(new Request(host+"/api/me",{headers:{Cookie:"__Host-knt_session="+session}}),e)).status,200);
    const replay=await worker.fetch(callbackReq({state}),e);
    assert.equal(replay.status,400);
    assert.equal(seen.length,2,"replay must never reach provider");
    const logout=await worker.fetch(new Request(host+"/auth/logout",{
      method:"POST",headers:{Origin:host,"Content-Type":"application/json",Cookie:"__Host-knt_session="+session},body:"{}"
    }),e);
    assert.equal(logout.status,200);
    assert.match(logout.headers.get("Set-Cookie"),/Max-Age=0/);
    assert.equal(db.sessions.size,0);
    assert.equal((await worker.fetch(new Request(host+"/api/me",{headers:{Cookie:"__Host-knt_session="+session}}),e)).status,401);
  } finally {globalThis.fetch=original;}
});

test("non-owner identity never gets session; authorization state is single-use", async () => {
  const db=createDB(),e=env(db);
  const {state,challenge}=await begin(e);
  const seen=[];seen.expectedChallenge=challenge;
  const original=globalThis.fetch;
  globalThis.fetch=providerStub(654321,seen);
  try {
    const res=await worker.fetch(callbackReq({state}),e);
    assert.equal(res.status,403);
    assert.equal(db.sessions.size,0);
    assert.equal(db.pending.size,0);
    assert.match(res.headers.get("Set-Cookie"),/Max-Age=0/);
  } finally {globalThis.fetch=original;}
});

test("missing cookie, mismatched state and expired state fail without provider calls", async () => {
  const db=createDB(),e=env(db);
  const {state}=await begin(e);
  assert.equal((await worker.fetch(callbackReq({state,cookie:false}),e)).status,400);
  assert.equal((await worker.fetch(new Request(host+"/auth/callback?state="+state+"&code=abc", {
    headers:{Cookie:"__Host-knt_oauth="+("B".repeat(43))}
  }),e)).status,400);
  const hashed=await hexHash(state);
  db.pending.get(hashed).expires_at=Date.now()-1;
  assert.equal((await worker.fetch(callbackReq({state}),e)).status,400);
  assert.equal(db.pending.size,0);
});

test("expired session must be rejected even if cookie contains known owner identity", async()=>{
  const db=createDB(),e=env(db);
  const cookie="C".repeat(50);
  db.sessions.set(await hexHash(cookie),{user_id:TEST_OWNER,expires_at:Date.now()-1});
  const res=await worker.fetch(new Request(host+"/api/me",{headers:{Cookie:"__Host-knt_session="+cookie}}),e);
  assert.equal(res.status,401);
});
