# Phase 1 — Cloudflare Release & Recovery Checklist

**Scope:** `kinotch-judgment-learning` public Worker, future owner-only OAuth app, existing D1. This document is an operational checklist, **not deployment authorization**. The owning [Issue #2](https://github.com/kinoko34077/kinotch-judgment-learning/issues/2) and [devflow Control #389](https://github.com/kinoko34077/devflow/issues/389) govern changes and current state.

## Known accepted baseline (2026-10-19)

- Cloudflare account ID: `fb59b3c4a3fb2cda44dad80638390309`. Intended D1 database name: `kinotch-judgment-learning`, ID: `d503a90d-4c9f-4f98-80bf-ebe427aac12d`.
- `main` has the **public-only** Worker at `worker/bootstrap.js`, the D1 `DB` binding, schema migration `0001_init.sql` and additive `0002_oauth_pending_expiry.sql`.
- The owner verified the `DB` binding in Cloudflare. Production migration **0001 was applied and read back** (six application tables, three illustrative questions); **0002 has not been verified or applied**. Merging SQL into GitHub does not run it on remote D1.
- GitHub OAuth app and Cloudflare OAuth variables/secrets were entered by the owner; **their actual runtime values and a successful real OAuth login have not been independently validated**.
- The owner-only Worker, UI and rate-limiting binding live in [Draft PR #19](https://github.com/kinoko34077/kinotch-judgment-learning/pull/19), **not in production**. Exact-head security Formal COMMENT review [#5566431998](https://github.com/kinoko34077/kinotch-judgment-learning/pull/19#pullrequestreview-5566431998) reported no P0/P1/P2, with P3 caveats.
- The previously configured remote PC Wrangler environment is currently selecting a `CLOUDFLARE_API_TOKEN` that receives **D1 API error 10000 on a read-only `d1 info` call**. No credential value is retained here. Account identity alone does **not** prove D1 permission.

Re-read live PR, Issue, main commit, CI and current Cloudflare state. These observations can become stale.

## Gate A — Repair the intended D1 access, then apply only pending 0002

**Human-only action if still required:** In the owner's Cloudflare account, verify the *intended currently selected* API token/session has the necessary D1 access to the correct account and database. Update or issue credentials only through the provider UI after explicit owner authorization. Never paste a token or secret into a public Issue, workflow, source file or chat. Do not silently override `CLOUDFLARE_API_TOKEN` with a different credential path after a 10000 denial.

**Assistant routine operations (after access is restored):**

1. Use the existing verified main checkout (or a fresh clean checkout), with `wrangler.jsonc`. Read the database name and ID from this exact configuration.
2. Perform **read-only** `npx --yes wrangler@4.151.1 d1 info kinotch-judgment-learning --config wrangler.jsonc` and `npx --yes wrangler@4.151.1 d1 migrations list kinotch-judgment-learning --remote --config wrangler.jsonc`. Verify account, exact D1 ID, that 0001 is already applied, and whether **only 0002** is pending. If inconsistent, **stop**, record evidence and diagnose rather than write.
3. If confirmed, execute `npx --yes wrangler@4.151.1 d1 migrations apply kinotch-judgment-learning --remote --config wrangler.jsonc` **once**, inspecting the migration plan before confirming. This modifies remote database schema and is not part of a GitHub merge.
4. Independently read back the existence of `oauth_pending_expiry` in `sqlite_master`, and re-list pending migrations (expect none). Do not query or log personal response rows. If 0002 was already applied, do not apply again merely to produce a success log.
5. Record the exact command result and verification in Issue #2 and Control #389 without credentials.

The 0002 change is a single additive `CREATE INDEX IF NOT EXISTS` on the OAuth pending table; it does not change existing response or session rows. It is *not* a substitute for a database backup or permission review.

## Gate B — Secure configuration without disclosing its values

- Confirm the future production Worker will use the intended HTTPS **origin only**, with `PUBLIC_ORIGIN` matching the actual URL (no trailing path). Its GitHub OAuth callback URI must be the same origin plus `/auth/callback`.
- Check that **names and existence** of `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` (Secret type), `OWNER_GITHUB_USER_ID` and `PUBLIC_ORIGIN` are correct. Do **not** copy Secret values into logs or GitHub. The configured owner ID must be the actual immutable GitHub numeric ID, not username.
- Ensure the PR #19 Wrangler config uses the intended D1 UUID, `main: worker/index.js`, `keep_vars: true` and `AUTH_RATE_LIMIT` binding. Rate-limit capacity is approximate, not an absolute guarantee.
- Verify the *actual* Cloudflare build/deployment source and CI match the reviewed PR head. A successful GitHub dry run alone is not proof that the production environment has the new bindings.

## Gate C — External/public authentication release (explicit owner approval)

**Do not merge/deploy PR #19 solely because tests, a GitHub review or this checklist pass.** Authenticated personal data processing and an externally accessible login surface require a separate explicit release decision. Before approval, identify the resulting public URL, regression/rollback path, exact PR SHA, and intended data-handling behavior.

Once owner approval is granted and Gate A/B pass, check current-head tests, independent exact-head formal security review and source/base mergeability again. Deploy in a controlled manner using the authorized GitHub/Cloudflare path. Check the *actual* Cloudflare deployment and avoid claiming release from GitHub statuses alone.

## Gate D — Real runtime acceptance (not covered by mocks)

1. On the deployed origin, verify unauthenticated `/` stays public and `/app`/private API cannot be accessed anonymously.
2. Owner performs **one real GitHub OAuth sign-in** through the intended registered app; validate callback/PKCE and the owner-only `/app` and `/api/me`.
3. Test a different GitHub identity only using an actually permitted test account/session (never impersonate accounts): that identity must not get an owner session or read/write personal APIs.
4. Exercise at least two domains with GO, correction, skip, undo, logout/re-login, cross-browser or cross-device reload and history persistence. Use **designated throwaway answer data** and remove it only through a defined verified cleanup operation; never expose the owner's actual private history in logs/issues.
5. Verify public pages and mobile viewport without leaking the private app HTML through aliases. Record pass/fail and exact evidence in Issue #2.

Mocked GitHub OAuth tests and local D1 tests are useful prerequisites but **not** proof of real OAuth or remote persistence.

## Rollback and failure boundaries

- If a deployment causes routing/auth problems, **stop further release actions**, preserve diagnostic evidence (redact credentials and private data) and restore the last accepted **public-only Worker deployment** through an authorized Cloudflare/GitHub rollback path; verify the public landing and all private endpoints fail closed.
- Worker rollback **does not undo D1 migrations**. The additive 0002 index can normally remain; deleting it would be a separately reviewed database change.
- If login fails, distinguish: actual deployed Worker version; OAuth callback/origin mismatch; missing runtime binding/variable/secret; D1 permission/migration state; third-party GitHub availability; Cloudflare rate limiting. Do not demand that the owner recreate D1, OAuth app or secrets by default.
- If token D1 access still fails with API error 10000, **do not bypass the current credential or relabel local dry-run as production success**. Report who must make the permission change and recheck Gate A afterward.

**Current public-only fallback:** source configuration at main after schema-only [PR #20](https://github.com/kinoko34077/kinotch-judgment-learning/pull/20), not a promise of any specific Cloudflare runtime deployment ID.
