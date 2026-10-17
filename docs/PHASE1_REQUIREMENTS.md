# Phase 1 — Public reference site + owner-only answer app

Owner: [Issue #2](https://github.com/kinoko34077/kinotch-judgment-learning/issues/2). Vision: [Issue #1](https://github.com/kinoko34077/kinotch-judgment-learning/issues/1).

## Status

Prototype source code only. **Not deployed.** Requires OAuth App registration, Cloudflare account/bindings/secrets, and actual public deployment through an explicit credentials/deploy authorization gate. The initial seeded questions are **illustrative**, not evidence that the planned large-scale knowledge ingestion, generative AI or active learning has been implemented.

## Architecture

- Cloudflare Workers serves both static site and private API on one HTTPS origin.
- Public `/`: read-only promotional/informational page. Public example has no write path.
- Private `/app` and `/api/*`: only the allowlisted GitHub numeric user ID after OAuth.
- Cloudflare D1 stores OAuth transient state, hashed sessions, questions, answers and revision event history.
- Source is public; production answers and secret credentials remain outside GitHub.
- The seed covers UI/UX, software design and music; additions use a common domain/question data model.
- The initial app records GO, CORRECT, SKIP, UNDO and session restart. Rule induction is future work.

## Setup (requires owner consent and credential configuration)

1. Set up Cloudflare Workers and D1. Create the `kinotch-judgment-learning` database.
2. Register a GitHub OAuth App whose callback URL is `https://YOUR_WORKER_HOST/auth/callback`, configured for `read:user` identity permission.
3. Run `npm install`, copy `wrangler.example.jsonc` to gitignored `wrangler.jsonc`, and replace values for `PUBLIC_ORIGIN`, `GITHUB_CLIENT_ID`, `OWNER_GITHUB_USER_ID` (stable numeric GitHub user ID), and D1 `database_id`.
4. Inject `GITHUB_CLIENT_SECRET` as a **Cloudflare Worker secret** via an approved security workflow, never as a source file or GitHub Issue/comment.
5. Apply migration `migrations/0001_init.sql` to D1 and verify the seeded domains/questions.
6. Run `npm test` and validate both authorized and unauthorized GitHub login, persistence, logout, CSRF denial and narrow-screen behavior.
7. Only after explicit authorization, deploy with `npm run deploy`, then test the real URL.

## Security gates

- Authorization code exchange only on server; PKCE S256 and one-time state with 10-minute expiry.
- Fixed callback origin from configured `PUBLIC_ORIGIN`.
- Numeric GitHub user ID allowlist; non-owner login is denied.
- Session random token SHA-256 hashed at rest, Secure/HttpOnly/SameSite cookies, one-week expiration, server-side logout.
- All private APIs check the session and owner identity server-side.
- Same-origin JSON mutation enforced; request body limits and SQLite bound statements.
- No CORS headers for private data, and private API replies use `Cache-Control: no-store`.
- Never commit real user histories or credentials to the public repository.
- Security review and real OAuth E2E **required before enabling live production use**.

## Out of scope for this source change

Real external source ingestion, dynamic AI-generated questions, automated inference of personal rules, adaptive question selection, cross-domain rule validation, GPT/Codex connector endpoints, production deploy, actual secret configuration.

These remain requirements from the parent Issue, and are not claimed as delivered by the first working scaffold.
