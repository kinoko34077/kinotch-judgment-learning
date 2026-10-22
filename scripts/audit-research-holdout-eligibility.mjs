/**
 * Research held-out eligibility preflight (public metadata only).
 *
 * This is NOT an evaluation engine, an independence certification, or a source
 * of authority for personal rules. Existing condition handling belongs to
 * evaluate-conditional-candidates.mjs. No private samples/answers or secrets
 * may be committed to this public repository.
 */
const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

function record(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(label + " must be an object");
  }
  return value;
}

function ids(values, field) {
  if (!Array.isArray(values)) throw new TypeError(field + " must be an array");
  const out = new Set();
  for (const value of values) {
    if (typeof value !== "string" || !value.trim()) {
      throw new TypeError(field + " contains invalid ID");
    }
    if (out.has(value)) throw new Error(field + " contains duplicate ID");
    out.add(value);
  }
  return out;
}

function scenarioKey(value) {
  return typeof value === "string" && value.trim()
    ? value.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("ja-JP")
    : null;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    const result = {};
    for (const key of Object.keys(value).sort()) result[key] = canonical(value[key]);
    return result;
  }
  return value;
}

function contextKey(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (!Object.keys(value).length) return null;
  return JSON.stringify(canonical(value));
}

const verdict = (status, reason) => Object.freeze({
  status,
  reason,
  independent_evaluation_proven: false,
  blind_score_eligible: false,
  personal_approval: false,
  rule_actionable: false,
  may_export_to_agents: false
});

/**
 * Reject known leakage from public training, public examples and synthetic
 * fixtures, including exact relabels of scenario/context (not merely IDs).
 *
 * A disjoint case is still UNVERIFIED; independent provenance, source
 * independence, access controls and label quality cannot be checked from
 * public metadata. The returned verdict never approves/blind-scores a case.
 */
export function auditHeldOutCandidate(candidate, known) {
  record(candidate, "candidate");
  record(known, "known");
  const id = candidate.id;
  if (typeof id !== "string" || !id.trim()) throw new TypeError("Candidate ID required");
  const trainIds = ids(known.training_ids, "training_ids");
  const fixtureIds = ids(known.fixture_ids, "fixture_ids");
  const publicIds = ids(known.public_example_ids, "public_example_ids");
  if (trainIds.has(id)) return verdict("excluded", "training_id_overlap");
  if (fixtureIds.has(id)) return verdict("excluded", "synthetic_fixture_id_overlap");
  if (publicIds.has(id)) return verdict("excluded", "public_example_id_overlap");

  const sourceScenarios = known.public_scenarios;
  const sourceContexts = known.synthetic_contexts;
  if (!Array.isArray(sourceScenarios) || !Array.isArray(sourceContexts)) {
    throw new TypeError("Explicit public scenario and synthetic context inventories required");
  }
  const prompt = scenarioKey(candidate.scenario);
  if (prompt !== null && sourceScenarios.some(x => scenarioKey(x) === prompt)) {
    return verdict("excluded", "public_scenario_relabel");
  }
  const context = contextKey(candidate.context);
  if (context !== null && sourceContexts.some(x => contextKey(x) === context)) {
    return verdict("excluded", "synthetic_context_relabel");
  }

  if (candidate.visibility !== "private" ||
      candidate.origin !== "proposed_unseen_case" ||
      candidate.training_seed !== false ||
      candidate.synthetic_fixture !== false ||
      candidate.public_example !== false) {
    return verdict("excluded", "not_claimed_private_unseen");
  }
  if (!prompt || !context) {
    return verdict("excluded", "insufficient_case_metadata");
  }
  if (own(candidate, "human_response") || own(candidate, "human_approval") ||
      own(candidate, "expected_answer")) {
    return verdict("excluded", "evaluation_labels_must_not_enter_public_preflight");
  }
  return verdict("requires_private_provenance_audit", "disjoint_by_public_metadata_only");
}
