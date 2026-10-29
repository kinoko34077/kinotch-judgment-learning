// Read-only bridge to the EXISTING research-only condition evaluator.
// Never writes D1, records personal GO, or promotes research hypotheses.
import routing from "../learning/seeds/uiux-question-routing.v1.json" with { type: "json" };
import seeds from "../learning/seeds/uiux-research-seeds.json" with { type: "json" };
import rules from "../knowledge/domains/uiux/conditional-candidates.v1.json" with { type: "json" };
import { gateResearchSeed } from "../scripts/gate-research-question.mjs";

const seedById = new Map(seeds.records.map(item => [item.id, item]));
const ruleById = new Map(rules.records.map(item => [item.id, item]));
const bindingById = new Map(routing.records.map(item => [item.question_id, item]));

function sourceData(id) {
  const binding = bindingById.get(id);
  if (!binding) return null;
  const seed = seedById.get(id);
  if (!seed || seed.human_response !== null || seed.human_approval !== "not_requested" ||
      seed.usage !== "training_seed_only" || binding.runtime_eligible !== false ||
      binding.model_question_generated !== false) throw Error("Research source gate violated");
  const rule = binding.candidate_knowledge_id ? ruleById.get(binding.candidate_knowledge_id) : null;
  if (binding.candidate_knowledge_id && !rule) throw Error("Research rule is missing");
  return { binding, seed, rule };
}

function factDefinitions(rule) {
  if (!rule) return [];
  const predicates = [
    ...rule.applies_when, ...rule.avoid_when,
    ...rule.reversal_conditions.flatMap(r => r.when)
  ];
  const facts = new Map();
  for (const p of predicates) {
    if (!["string", "boolean", "number"].includes(typeof p.equals) ||
        !/^[a-z][a-z0-9_]{0,64}$/.test(p.fact)) throw Error("Invalid research predicate");
    if (facts.has(p.fact) && !Object.is(facts.get(p.fact), p.equals))
      throw Error("Ambiguous research predicate");
    facts.set(p.fact, p.equals);
  }
  return [...facts].map(([name, equals]) => ({ name, equals }));
}

function detail(entry) {
  const { binding, seed, rule } = entry;
  const initialGate = gateResearchSeed(binding, rule, {});
  return {
    id: seed.id,
    scenario: seed.scenario,
    aiResearchSeed: seed.ai_preselected_seed,
    reversalCondition: seed.reversal_condition,
    candidateKnowledgeId: binding.candidate_knowledge_id,
    evidenceSupportLevel: rule?.evidence_support_level ?? "unmapped",
    facts: factDefinitions(rule),
    initialStatus: initialGate.status,
    authority: "research_synthesis_unapproved",
    previewOnly: true,
    runtimeEligible: false,
    modelQuestionGenerated: false,
    sourceIssue: binding.source_issue
  };
}

// This is metadata for an owner-only RESEARCH INSPECTION page, not new
// production questions. None of these records may enter /api/answer.
export function listResearchPreviews() {
  return routing.records.map(binding => detail(sourceData(binding.question_id)));
}

function unmatched(expected) {
  if (typeof expected === "boolean") return !expected;
  if (typeof expected === "number") return expected + 1;
  return expected === "__other__" ? "__not_other__" : "__other__";
}

export function evaluateResearchPreview(seedId, selections) {
  const entry = typeof seedId === "string" ? sourceData(seedId) : null;
  if (!entry || !selections || typeof selections !== "object" || Array.isArray(selections))
    throw new TypeError("Invalid research preview request");
  const definitions = factDefinitions(entry.rule);
  const byName = new Map(definitions.map(f => [f.name, f.equals]));
  const context = Object.create(null);
  if (Object.keys(selections).length > definitions.length)
    throw new TypeError("Unexpected research fact");
  for (const [name, choice] of Object.entries(selections)) {
    if (!byName.has(name) || !["yes", "no", "unknown"].includes(choice))
      throw new TypeError("Invalid research fact choice");
    if (choice === "unknown") continue;
    const expected = byName.get(name);
    context[name] = choice === "yes" ? expected : unmatched(expected);
  }
  const evaluation = gateResearchSeed(entry.binding, entry.rule, context);
  // The gate itself guarantees non-actionable/no-approval; do not duplicate
  // its decision logic or leak supplied context into stored/public data.
  return { ...evaluation, evidenceSupportLevel: entry.rule?.evidence_support_level ?? "unmapped" };
}
