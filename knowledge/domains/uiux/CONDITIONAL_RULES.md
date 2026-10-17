# Conditional UI/UX research candidates v1

Issue owner: [#6](https://github.com/kinoko34077/kinotch-judgment-learning/issues/6). Parent research: #4; evidence catalog: #5; later question workflow: #7.

## Scope and non-authority
- These are **provisional interpretations** of 20 compact Issue-derived research summaries, not verified design laws, KiNoTch. personal rules, or an API for autonomous changes.
- `personal_approval=false`, `runtime_eligible=false` and `normalized_conditions_are_hypotheses=true` are mandatory. The source candidates and evidence-traceability audit remain distinct and unchanged.
- Every rule carries `evidence_support_level`, linked individual checked-claim IDs and `evidence_limitations`. Only 7/20 have partial direct narrow support; 7 are context-only and 6 lack direct checked claims.
- The original claimed 46-source ZIP, document-wide evidence validation, and per-user GO are absent. No private response data belongs in this public repository.

## Predicate contract
Each `applies_when` array is conjunction (all stated facts must match). `avoid_when` is a disjunction of contraindications. Each `reversal_conditions` entry specifies a matching conjunction and **alternative for review**, not an automatic choice. `conflicts_with` is a symmetric candidate collision hint, not a production tie-breaker.

`evaluateResearchCandidate(rule, context)` returns one of:
- `not_applicable`: a required applicability fact is known to differ;
- `contraindicated`: an explicit avoid condition is true (higher priority than reversal);
- `reversal_candidate`: an explicit reversal is true, and no guard is missing/active;
- `needs_context`: an applicable fact or safety/reversal guard is missing/null;
- `candidate_match`: declared synthetic context matches, but the rule still lacks approval.

Each return includes `authority=research_synthesis_unapproved`, `runtime_eligible=false`, `personal_approval=false`, `actionable=false`. Callers must not interpret `candidate_match` as a deploy/use/agent authorization.

## Verification
Run `node scripts/validate-conditional-candidates.mjs` and `node scripts/validate-research-extract.mjs`. Research CI runs both on changed research data or test scripts. The 160 synthetic test cases contain 8 patterns per rule: match, inapplicable, exception, reversal, missing applicability, missing exception guard, missing reversal guard, and exception-over-reversal precedence.

**Limit of the checks:** cases are constructed from the proposed predicate model and test its implementation/consistency, not independent human judgment, empirical applicability, or blind held-out evaluation. Source #7 owns later evaluation and user-response learning, after a separately validated rule contract.
