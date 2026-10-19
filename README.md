# KiNoTch. Judgment Learning System

A domain-agnostic web application to acquire external knowledge, present AI-preselected answers for quick human approval/correction, learn KiNoTch.-specific judgment criteria from differences, validate their generalization, and make approved rules available to other agents.

- **Scope:** UI/UX, software architecture, development planning, music, creation, research, education, strategy, and extensible domains.
- **Primary interaction:** AI proposes answer + brief reasons → GO or correct → extract candidate rule → evaluate on unseen cases.
- **Knowledge separation:** public/general evidence, domain knowledge, personal cross-domain and domain rules, provisional hypotheses, approved rules, and evaluation cases.
- **Phase 1 implementation:** Cloudflare Workers Static Assets + Worker + D1 (accepted in [Issue #2](https://github.com/kinoko34077/kinotch-judgment-learning/issues/2)).
- **Current public main:** landing page and a public-only bootstrap Worker; D1 `DB` binding configured, migrations `0001` and `0002` committed. The owner confirmed the binding, and production `0001` migration was verified. The additive `0002` index has **not** been confirmed on remote D1.
- **Private app:** owner-only GitHub OAuth + D1 app prepared and independently security-reviewed on [Draft PR #19](https://github.com/kinoko34077/kinotch-judgment-learning/pull/19), **not merged/deployed**. Local tests are not proof of live GitHub sign-in.
- **Public repository:** source code and public specification only. Private judgment histories or credentials must not be committed.

The initial concept remains owned by [parent Issue #1](https://github.com/kinoko34077/kinotch-judgment-learning/issues/1), while [Phase 1 Issue #2](https://github.com/kinoko34077/kinotch-judgment-learning/issues/2) is the concrete auth/site implementation authority. Cross-repository work status is tracked in [devflow Control #389](https://github.com/kinoko34077/devflow/issues/389).

For D1 access recovery, exact pre-release gates, secure settings, real OAuth acceptance and rollback, see **[Phase 1 Cloudflare Release & Recovery Checklist](docs/PHASE1_CLOUDFLARE_RELEASE.md)**. This runbook does not grant permission to publish the private app.