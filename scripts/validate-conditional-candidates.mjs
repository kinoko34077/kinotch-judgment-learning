import {readFile} from "node:fs/promises";
import assert from "node:assert/strict";
import {evaluateResearchCandidate,evaluateResearchSet} from "./evaluate-conditional-candidates.mjs";

const json=async path=>JSON.parse(await readFile(new URL("../"+path,import.meta.url),"utf8"));
const dir="knowledge/domains/uiux/";
const [candidateSet,sourceSet,audit,fixtures,learning,example]=await Promise.all([
  json(dir+"conditional-candidates.v1.json"),
  json(dir+"research-candidates.json"),
  json(dir+"evidence-traceability-audit.v1.json"),
  json("tests/fixtures/uiux-conditional-cases.v1.json"),
  json("learning/seeds/uiux-research-seeds.json"),
  json("evaluations/examples/uiux-ia-public-example.json")
]);
const unique=(arr,msg)=>assert.equal(new Set(arr).size,arr.length,msg+" duplicates");
assert.equal(candidateSet.records.length,20);
assert.equal(sourceSet.records.length,20);
assert.equal(audit.records.length,20);
assert.equal(candidateSet.original_report_verified,false);
assert.equal(candidateSet.runtime_eligible,false);
assert.equal(fixtures.fixtures.length,160);
assert.equal(fixtures.human_answers_included,false);
assert.equal(fixtures.real_user_context_included,false);
assert.equal(fixtures.training_data,false);
assert.equal(fixtures.blind_held_out_evaluation,false);
unique(candidateSet.records.map(x=>x.id),"normalized rules");
unique(fixtures.fixtures.map(x=>x.id),"fixture IDs");
assert.deepEqual(
  new Set(candidateSet.records.map(x=>x.source_candidate_id)),
  new Set(sourceSet.records.map(x=>x.id)),
  "normalized IDs must match original unapproved research extraction"
);
const lookup=new Map(candidateSet.records.map(x=>[x.id,x]));
const sourceLookup=new Map(sourceSet.records.map(x=>[x.id,x]));
const auditLookup=new Map(audit.records.map(x=>[x.knowledge_id,x]));
const types=["positive","negative","exception","reversal","missing-applicability","missing-guard","missing-reversal","exception-precedes-reversal"];
for(const rule of candidateSet.records){
  assert.equal(rule.source_candidate_id,rule.id);
  assert.equal(rule.personal_approval,false);
  assert.equal(rule.runtime_eligible,false);
  assert.equal(rule.adoption_status,"candidate");
  assert.equal(rule.normalized_conditions_are_hypotheses,true);
  assert.equal(rule.decision_scope,"research_fixture_only");
  assert.equal(sourceLookup.get(rule.id)?.authority,"research_synthesis_unapproved");
  assert.equal(auditLookup.get(rule.id)?.personal_approval,false);
  assert.equal(auditLookup.get(rule.id)?.runtime_eligible,false);
  const evidence=auditLookup.get(rule.id);
  assert.equal(rule.evidence_support_level,evidence.claim_support_level);
  assert.deepEqual(rule.evidence_claim_ids,evidence.primary_claim_links.map(x=>x.claim_id));
  assert.equal(rule.evidence_limitations,evidence.unverified_scope);
  assert.ok(rule.evidence_limitations.length>0);
  assert.ok(rule.recommendation.length>0);
  assert.ok(rule.applies_when.length>=1);
  assert.ok(rule.avoid_when.length>=1);
  assert.ok(rule.reversal_conditions.length>=1);
  for(const p of [...rule.applies_when,...rule.avoid_when,...rule.reversal_conditions.flatMap(c=>c.when)]){
    assert.ok(typeof p.fact==="string" && p.fact.length>0);
    assert.ok(typeof p.equals==="boolean" || typeof p.equals==="string");
  }
  for(const c of rule.reversal_conditions)assert.ok(typeof c.consider==="string"&&c.consider.length>0);
  for(const conflict of rule.conflicts_with){
    assert.ok(lookup.has(conflict),rule.id+" references unknown conflicting candidate");
    assert.notEqual(conflict,rule.id);
    assert.ok(lookup.get(conflict).conflicts_with.includes(rule.id),"conflict symmetry");
  }
  assert.equal(fixtures.fixtures.filter(f=>f.knowledge_id===rule.id).length,types.length);
  for(const type of types)assert.equal(fixtures.fixtures.filter(f=>f.knowledge_id===rule.id&&f.kind===type).length,1);
  assert.throws(
    ()=>evaluateResearchCandidate({...rule,personal_approval:true},{}),
    /Cannot evaluate promoted/
  );
  assert.throws(
    ()=>evaluateResearchCandidate({...rule,runtime_eligible:true},{}),
    /Cannot evaluate promoted/
  );
}
for(const test of fixtures.fixtures){
  const rule=lookup.get(test.knowledge_id);
  assert.ok(rule,test.id+" unknown source candidate");
  const actual=evaluateResearchCandidate(rule,test.context);
  assert.equal(actual.status,test.expected,test.id+" expected="+test.expected);
  assert.equal(actual.personal_approval,false);
  assert.equal(actual.runtime_eligible,false);
  assert.equal(actual.actionable,false);
  assert.equal(actual.authority,"research_synthesis_unapproved");
  if(test.expected==="needs_context")assert.ok(actual.missing_facts?.length>0,test.id+" must explain missing context");
  if(test.expected==="reversal_candidate")assert.ok(actual.consider?.length>0,test.id+" must name the alternative");
}
const all=evaluateResearchSet(candidateSet.records,{});
assert.equal(all.length,20);
assert.ok(all.every(x=>x.status==="needs_context" && x.actionable===false));
assert.throws(()=>evaluateResearchSet([...candidateSet.records,candidateSet.records[0]],{}),/Duplicate/);
assert.ok(learning.records.every(x=>x.human_response===null&&x.human_approval==="not_requested"));
assert.equal(example.visibility,"public_example_not_blind");
console.log("PASS: 20 non-authoritative normalized candidates + 160 synthetic predicate/exception/reversal/unknown fixtures.");
console.log("LIMITATION: fixture success does not prove empirical suitability, personal approval, or real-world deployment readiness.");
