# Conditional UI/UX & software-design research — issue-derived extraction

## Provenance
This directory reconstructs the structured **subset already recorded in GitHub Issues #5–#7** from a user-provided Deep Research report dated 2026-10-08. It is **not** an archival copy of the full report or its originally described ZIP. Original source catalog (report says 46 items), reported bundle counts and its internal citation handles were not independently inspected here.

Canonical tracking: [#4](https://github.com/kinoko34077/kinotch-judgment-learning/issues/4), [#5 evidence](https://github.com/kinoko34077/kinotch-judgment-learning/issues/5), [#6 knowledge](https://github.com/kinoko34077/kinotch-judgment-learning/issues/6), [#7 decisions/seeds](https://github.com/kinoko34077/kinotch-judgment-learning/issues/7).

## Dataset
- `knowledge/domains/uiux/research-candidates.json`: 20 candidate principles; compact applicability wording is **raw, not semantically disambiguated**.
- `knowledge/domains/uiux/tradeoffs.json`: 10 conditional tradeoffs.
- `research/uiux-2026-10-08/source-inventory.json`: 25 named external systems/standards from the Issue tables, **no source URL or clause verification yet**.
- `knowledge/domains/uiux/antipatterns.json`: 10 reported anti-patterns, not independently verified.
- `research/uiux-2026-10-08/verification-rules.json`: 12 candidate checks, not executed against a live UI.
- `learning/seeds/uiux-research-seeds.json`: 14 AI-initial-answer examples. No human responses or personal approval are recorded.
- `evaluations/examples/uiux-ia-public-example.json`: 1 **public illustrative** evaluation case; keep out of training seeds. Because it is public, it **cannot** substantiate a blind held-out evaluation on its own.

## Evidence and authority
All candidate claims are `source_unverified`; do not use as compliance assurance, legal advice, or approved KiNoTch. rules. The project is domain-agnostic; this dataset is one domain-specific research input, not the project-wide policy. Original issue values are retained as raw Japanese mixed-language wording; normalization and traceable primary references are later checkpoints.

## Verification
Run `node scripts/validate-research-extract.mjs`. It checks parseable JSON, cardinalities, unique IDs, source-verification flags and evaluation/training separation. It **does not** assert that any external scholarly, product or normative claim is true.

## Roadmap
1. Preserve and validate this Issue-derived dataset (this PR).
2. Independently resolve publisher/URL/version/clause and classify claim strength (#5).
3. Refine each record into structured applicability/exception/conflict/source links (#6), preserving source wording.
4. Feed validated knowledge to question selection/AI suggestions, without manufacturing user approval (#7).
5. Evaluate on genuinely unseen cases; keep personal data out of public Git.
6. Integrate with agents only after evidence and boundary checks.

Do not merge OAuth/credential work from [PR #3](https://github.com/kinoko34077/kinotch-judgment-learning/pull/3) into this research change.
