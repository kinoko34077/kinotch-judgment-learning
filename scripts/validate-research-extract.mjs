import {readFile} from "node:fs/promises";
import assert from "node:assert/strict";
const json = async path => JSON.parse(await readFile(new URL("../"+path, import.meta.url),"utf8"));
const root="research/uiux-2026-10-08/";
const [manifest,k,t,s,q,e,a,v,sch] = await Promise.all([
  json(root+"MANIFEST.json"),json("knowledge/domains/uiux/research-candidates.json"),
  json("knowledge/domains/uiux/tradeoffs.json"),json(root+"source-inventory.json"),
  json("learning/seeds/uiux-research-seeds.json"),json("evaluations/examples/uiux-ia-public-example.json"),
  json("knowledge/domains/uiux/antipatterns.json"),json(root+"verification-rules.json"),
  json("schemas/research-candidate.v1.schema.json")
]);
const exactCount=(name,arr,n)=>assert.equal(arr.length,n,name+" count");
const unique=(name,arr)=>assert.equal(new Set(arr).size,arr.length,name+" duplicates");
exactCount("knowledge",k.records,20);exactCount("tradeoffs",t.records,10);
exactCount("seeds",q.records,14);exactCount("source inventory",s.entries,25);
exactCount("antipatterns",a.records,10);exactCount("verification rules",v.records,12);
for (const [name,list] of [["knowledge",k.records],["tradeoffs",t.records],["questions",q.records],["sources",s.entries],["antipatterns",a.records],["verification",v.records]]) {
  unique(name,list.map(x=>x.id));assert.ok(list.every(x=>typeof x.id==="string"&&x.id.length>0),name+" bad ID");
}
assert.equal(sch.properties.authority.const,"research_synthesis_unapproved");
for (const x of k.records) {
  for(const key of sch.required) assert.ok(x[key]!==undefined && x[key]!==null,"knowledge "+x.id+" missing "+key);
  assert.match(x.id,/^K-[A-Z0-9-]+$/);
  assert.equal(x.adoption_status,"candidate");
  assert.equal(x.evidence_status,"primary_sources_not_yet_checked");
  assert.equal(x.authority,"research_synthesis_unapproved");
  assert.equal(x.provenance.original_bundle_verified,false);
}
for (const x of s.entries) {
  assert.equal(x.verification_state,"not_verified");
  assert.equal(x.primary_source_url,null);
  assert.equal(x.verified_section,null);
}
for (const x of q.records) {
  assert.equal(x.human_response,null);assert.equal(x.human_approval,"not_requested");
  assert.equal(x.usage,"training_seed_only");
}
assert.equal(e.training_seed,false);
assert.equal(e.visibility,"public_example_not_blind");
assert.ok(!q.records.some(x=>x.id===e.evaluation_id),"evaluation leakage");
assert.equal(manifest.original_zip_retrieved,false);
assert.equal(manifest.original_46_source_catalog_verified,false);
assert.equal(manifest.primary_sources_independently_verified,false);
assert.equal(manifest.knowledge_record_count,k.records.length);
assert.equal(manifest.tradeoff_count,t.records.length);
assert.equal(manifest.learning_seed_count,q.records.length);
assert.equal(manifest.inventory_entry_count,s.entries.length);
console.log("PASS: 20 knowledge, 10 tradeoffs, 14 seeds, 25 inventory, 10 antipatterns, 12 verification rules, 1 isolated illustrative evaluation.");
console.log("LIMITATION: This test checks structure and declared provenance; it does not validate primary research claims or user acceptance.");
