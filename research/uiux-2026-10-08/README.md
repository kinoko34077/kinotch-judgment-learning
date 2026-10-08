# Conditional UI/UX & software-design research — issue-derived extraction

## Provenance
This directory reconstructs the structured **subset already recorded in GitHub Issues #5–#7** from a user-provided Deep Research report dated 2026-10-08. It is **not** an archival copy of the full report or its originally described ZIP. Original source catalog (report says 46 items), reported bundle counts and its internal citation handles were not independently inspected here.

Canonical tracking: [#4](https://github.com/kinoko34077/kinotch-judgment-learning/issues/4), [#5 evidence](https://github.com/kinoko34077/kinotch-judgment-learning/issues/5), [#6 knowledge](https://github.com/kinoko34077/kinotch-judgment-learning/issues/6), [#7 decisions/seeds](https://github.com/kinoko34077/kinotch-judgment-learning/issues/7).

## Dataset
- `knowledge/domains/uiux/research-candidates.json`: 20 candidate principles; compact applicability wording is **raw, not semantically disambiguated**.
- `knowledge/domains/uiux/tradeoffs.json`: 10 conditional tradeoffs.
- `research/uiux-2026-10-08/source-inventory.json`: 25 named external systems/standards from the Issue tables; **all 25 inventoried entries have at least one bounded claim checked**, but this is **NOT** full-document validation, a reproduction of the original claimed 46-source catalog, or adoption of the research rules.
- `research/uiux-2026-10-08/primary-claim-checks-2026-10-09.json`: **6 specific claims from 5 official primary documents checked** (WCAG 2.2, APG, JLREQ, NIST AI RMF, Web Vitals); full source validation is not asserted. For the combined inventory name `W3C JLREQ / Japanese Gap Analysis`, only JLREQ was checked.
- `research/uiux-2026-10-08/primary-claim-checks-batch2-2026-10-09.json`: 9 additional checked claims across 7 new inventory entries, from 8 official documents. Working Draft WCAG 3.0 remains **non-normative**, ISO 29148:2018 is distinct from its draft successor; ISO paid clauses were not examined. Total: **15 claims, 12 partially checked inventory entries, 13 untouched**.
- `research/uiux-2026-10-08/primary-claim-checks-batch3-2026-10-09.json`: 14 additional bounded claims across the 13 remaining inventory entries, from 14 publisher pages. ISO 9241-210 and 9241-115 are separate paid standards checked **only via public abstracts**; Adobe Spectrum 2 intro is a historical overview, not current API certification. **Aggregate: 29 checked claims, 25 inventory entries, 27 pages; full-document/source-catalog validation is still outstanding.**
- `knowledge/domains/uiux/antipatterns.json`: 10 reported anti-patterns, not independently verified.
- `research/uiux-2026-10-08/verification-rules.json`: 12 candidate checks, not executed against a live UI.
- `learning/seeds/uiux-research-seeds.json`: 14 AI-initial-answer examples. No human responses or personal approval are recorded.
- `evaluations/examples/uiux-ia-public-example.json`: 1 **public illustrative** evaluation case; keep out of training seeds. Because it is public, it **cannot** substantiate a blind held-out evaluation on its own.

## Evidence and authority
All candidate knowledge records remain `source_unverified` and are not personally approved; source-level claim checks do not imply knowledge approval. Do not use as compliance assurance, legal advice, or approved KiNoTch. rules. The project is domain-agnostic; this dataset is one domain-specific research input, not the project-wide policy. Original issue values are retained as raw Japanese mixed-language wording; normalization and traceable primary references are later checkpoints.

## Verification
Run `node scripts/validate-research-extract.mjs`. It checks parseable JSON, cardinalities, unique IDs across all three claim ledgers, inventory claim linkage and limited-verification boundaries, and evaluation/training separation. It **does not** assert that any external scholarly, product or normative claim is true.

## Roadmap
1. Preserve and validate this Issue-derived dataset (PR #8).
2. Record limited publisher evidence for every one of the 25 Issue-derived inventory entries (PR #9/#10/#11); continue deeper per-knowledge claim linkage and original report catalog recovery (#5).
3. Refine each record into structured applicability/exception/conflict/source links (#6), preserving source wording.
4. Feed validated knowledge to question selection/AI suggestions, without manufacturing user approval (#7).
5. Evaluate on genuinely unseen cases; keep personal data out of public Git.
6. Integrate with agents only after evidence and boundary checks.

Do not merge OAuth/credential work from [PR #3](https://github.com/kinoko34077/kinotch-judgment-learning/pull/3) into this research change.
