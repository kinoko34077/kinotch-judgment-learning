import {readFile} from "node:fs/promises";
import assert from "node:assert/strict";
import {gateResearchSeed} from "./gate-research-question.mjs";
const json=async p=>JSON.parse(await readFile(new URL("../"+p,import.meta.url),"utf8"));
const [bindings,seeds,rules,fixtures,publicExample]=await Promise.all([
 json("learning/seeds/uiux-question-routing.v1.json"),
 json("learning/seeds/uiux-research-seeds.json"),
 json("knowledge/domains/uiux/conditional-candidates.v1.json"),
 json("tests/fixtures/uiux-conditional-cases.v1.json"),
 json("evaluations/examples/uiux-ia-public-example.json")
]);
assert.equal(bindings.records.length,14);
assert.equal(seeds.records.length,14);
assert.equal(rules.records.length,20);
assert.equal(bindings.evaluation_data_is_training,false);
assert.equal(publicExample.training_seed,false);
assert.equal(publicExample.visibility,"public_example_not_blind");
assert.equal(publicExample.independent_evaluation,"not_yet_performed");
const u=xs=>new Set(xs);
assert.equal(u(bindings.records.map(x=>x.question_id)).size,14);
assert.deepEqual(u(bindings.records.map(x=>x.question_id)),u(seeds.records.map(x=>x.id)));
assert.ok(!bindings.records.some(x=>x.question_id===publicExample.evaluation_id));
const ruleMap=new Map(rules.records.map(x=>[x.id,x]));
const seedMap=new Map(seeds.records.map(x=>[x.id,x]));
const fixturesById=new Map(fixtures.fixtures.map(x=>[x.id,x]));
let preview=0,unmapped=0,insufficient=0,passed=0;
for(const binding of bindings.records) {
 const seed=seedMap.get(binding.question_id);
 assert.equal(seed.human_response,null);
 assert.equal(seed.human_approval,"not_requested");
 assert.equal(seed.usage,"training_seed_only");
 assert.equal(binding.human_response,null);
 assert.equal(binding.human_approval,"not_requested");
 assert.equal(binding.runtime_eligible,false);
 assert.equal(binding.model_question_generated,false);
 assert.equal(binding.context_policy,"explicit_facts_only_no_scenario_inference");
 const r=binding.candidate_knowledge_id?ruleMap.get(binding.candidate_knowledge_id):null;
 if(!r){
   assert.equal(binding.candidate_knowledge_id,null);
   assert.equal(binding.mapping_status,"unmapped_direct_rule");
   const got=gateResearchSeed(binding,null,{});
   assert.equal(got.status,"defer_unmapped_rule");++unmapped;
   assert.equal(got.go_recorded,false);
   continue;
 }
 assert.equal(binding.mapping_status,"hypothesis_requires_review");
 const contexts=Object.fromEntries(
  ["positive","negative","exception","reversal","missing-applicability","missing-guard","missing-reversal"]
     .map(k=>[k,fixturesById.get(r.id+"-"+k)?.context])
 );
 for(const kind of Object.keys(contexts))assert.ok(contexts[kind],"missing fixture "+r.id+"/"+kind);
 const ready=gateResearchSeed(binding,r,contexts.positive);
 const expected=r.evidence_support_level==="partial_claim_support"?"preview_candidate_only":"defer_insufficient_evidence";
 assert.equal(ready.status,expected,binding.question_id+" evidence tier");
 if(expected==="preview_candidate_only")++preview;else ++insufficient;
 assert.equal(gateResearchSeed(binding,r,contexts.negative).status,"defer_not_applicable");
 assert.equal(gateResearchSeed(binding,r,contexts.exception).status,"defer_contraindicated");
 assert.equal(gateResearchSeed(binding,r,contexts.reversal).status,"defer_reversal");
 assert.equal(gateResearchSeed(binding,r,contexts["missing-applicability"]).status,"defer_missing_context");
 assert.equal(gateResearchSeed(binding,r,contexts["missing-guard"]).status,"defer_missing_context");
 assert.equal(gateResearchSeed(binding,r,contexts["missing-reversal"]).status,"defer_missing_context");
 assert.equal(gateResearchSeed(binding,r,{}).status,"defer_missing_context");
 for(const output of [ready,gateResearchSeed(binding,r,{})]) {
   assert.equal(output.go_recorded,false);
   assert.equal(output.human_authorized,false);
   assert.equal(output.rule_actionable,false);
   assert.equal(output.preview_only,true);
 }
 assert.throws(()=>gateResearchSeed({...binding,human_response:"GO"},r,contexts.positive),/never-approved/);
 assert.throws(()=>gateResearchSeed({...binding,human_approval:"approved"},r,contexts.positive),/never-approved/);
 assert.throws(()=>gateResearchSeed(binding,{...r,personal_approval:true},contexts.positive),/promoted/);
 assert.throws(()=>gateResearchSeed(binding,{...r,id:"wrong"},contexts.positive),/mismatched/);
 passed+=8;
}
assert.equal(unmapped,1);
assert.equal(preview,5);
assert.equal(insufficient,8);
assert.equal(passed,13*8);
console.log("PASS: 14 issue-derived learning seeds, 13 candidate links, 1 explicit gap; gate outcomes: 5 research-only previews, 8 insufficient evidence, 1 unmapped.");
console.log("PASS: 104 mapped gate scenarios plus authorization guards, with no personal GO/approval or held-out claim.");
