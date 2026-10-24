import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {auditHeldOutCandidate} from "./audit-research-holdout-eligibility.mjs";
import {gateResearchSeed} from "./gate-research-question.mjs";

const json = async path =>
  JSON.parse(await readFile(new URL("../" + path, import.meta.url), "utf8"));
const [seeds, fixtures, example, bindings, rules] = await Promise.all([
  json("learning/seeds/uiux-research-seeds.json"),
  json("tests/fixtures/uiux-conditional-cases.v1.json"),
  json("evaluations/examples/uiux-ia-public-example.json"),
  json("learning/seeds/uiux-question-routing.v1.json"),
  json("knowledge/domains/uiux/conditional-candidates.v1.json")
]);
assert.equal(seeds.records.length, 14);
assert.equal(fixtures.fixtures.length, 160);
assert.equal(example.visibility, "public_example_not_blind");
const known = {
  training_ids: seeds.records.map(x => x.id),
  fixture_ids: fixtures.fixtures.map(x => x.id),
  public_example_ids: [example.evaluation_id],
  public_scenarios: [...seeds.records.map(x => x.scenario), example.scenario],
  synthetic_contexts: fixtures.fixtures.map(x => x.context)
};
const proposed = {
  id: "EVAL-UNUSED-TEST-001",
  scenario: "初めての共同編集で保存競合が発生する仮定",
  context: {collaborative: true, conflicting_save: true},
  visibility: "private",
  origin: "proposed_unseen_case",
  training_seed: false,
  synthetic_fixture: false,
  public_example: false
};
const status = data => auditHeldOutCandidate(data, known);
const expectExcluded = (candidate, reason) => {
  const result = status(candidate);
  assert.equal(result.status, "excluded", reason);
  assert.equal(result.reason, reason);
  assert.equal(result.blind_score_eligible, false);
  assert.equal(result.personal_approval, false);
  assert.equal(result.rule_actionable, false);
  assert.equal(result.may_export_to_agents, false);
};

// IDs and exact public case content remain disallowed even after re-labeling.
expectExcluded({...proposed, id: seeds.records[0].id}, "training_id_overlap");
expectExcluded({...proposed, id: fixtures.fixtures[0].id}, "synthetic_fixture_id_overlap");
expectExcluded({...proposed, id: example.evaluation_id}, "public_example_id_overlap");
expectExcluded({...proposed, scenario: seeds.records[0].scenario}, "public_scenario_relabel");
expectExcluded({...proposed, scenario: example.scenario}, "public_scenario_relabel");
expectExcluded({
  ...proposed,
  scenario: "  " + seeds.records[0].scenario.normalize("NFKC") + "  "
}, "public_scenario_relabel");
expectExcluded({...proposed, context: fixtures.fixtures[0].context}, "synthetic_context_relabel");

// Identical facts in a different property order cannot become 'unseen'.
expectExcluded({
  ...proposed,
  context: Object.fromEntries(Object.entries(fixtures.fixtures[0].context).reverse())
}, "synthetic_context_relabel");

expectExcluded({...proposed, visibility: "public"}, "not_claimed_private_unseen");
expectExcluded({...proposed, synthetic_fixture: true}, "not_claimed_private_unseen");
expectExcluded({...proposed, public_example: true}, "not_claimed_private_unseen");
expectExcluded({...proposed, training_seed: true}, "not_claimed_private_unseen");
expectExcluded({...proposed, origin: "unknown"}, "not_claimed_private_unseen");
expectExcluded({...proposed, scenario: ""}, "insufficient_case_metadata");
expectExcluded({...proposed, context: {}}, "insufficient_case_metadata");
expectExcluded({...proposed, human_response: "GO"}, "evaluation_labels_must_not_enter_public_preflight");
expectExcluded({...proposed, human_approval: "approved"}, "evaluation_labels_must_not_enter_public_preflight");
expectExcluded({...proposed, expected_answer: "yes"}, "evaluation_labels_must_not_enter_public_preflight");

const candidate = status(proposed);
assert.equal(candidate.status, "requires_private_provenance_audit");
assert.equal(candidate.independent_evaluation_proven, false);
assert.equal(candidate.blind_score_eligible, false);
assert.equal(candidate.personal_approval, false);
assert.equal(candidate.rule_actionable, false);
assert.equal(candidate.may_export_to_agents, false);
assert.throws(()=>status({...proposed, id: ""}), /ID required/);
assert.throws(()=>auditHeldOutCandidate(proposed, {...known, training_ids: null}), /training_ids/);
assert.throws(()=>auditHeldOutCandidate(proposed, {...known, training_ids: [proposed.id, proposed.id]}), /duplicate ID/);
assert.throws(()=>auditHeldOutCandidate(proposed, {...known, synthetic_contexts: null}), /inventories required/);

// Reuse, rather than replace, the existing research condition evaluator.
const binding = bindings.records.find(x => x.candidate_knowledge_id !== null);
const rule = rules.records.find(x => x.id === binding.candidate_knowledge_id);
const positive = fixtures.fixtures.find(x => x.id === rule.id + "-positive");
const routed = gateResearchSeed(binding, rule, positive.context);
assert.equal(routed.preview_only, true);
assert.equal(routed.human_authorized, false);
assert.equal(routed.rule_actionable, false);

console.log("PASS: research held-out preflight rejects public seed IDs, public examples, synthetic fixture IDs and exact content relabeling.");
console.log("PASS: disjoint self-declared case is still NOT independently verified, blind-scoreable, personally approved or actionable.");
console.log("LIMITATION: semantic near-duplicates, true independence, label quality and private evidence require an external authorized audit.");
