import {readFile} from "node:fs/promises";
import assert from "node:assert/strict";
const json = async path => JSON.parse(await readFile(new URL("../"+path, import.meta.url),"utf8"));
const root="research/uiux-2026-10-08/";
const [manifest,k,t,s,q,e,a,v,sch,pc,pc2,pc3] = await Promise.all([
  json(root+"MANIFEST.json"),json("knowledge/domains/uiux/research-candidates.json"),
  json("knowledge/domains/uiux/tradeoffs.json"),json(root+"source-inventory.json"),
  json("learning/seeds/uiux-research-seeds.json"),json("evaluations/examples/uiux-ia-public-example.json"),
  json("knowledge/domains/uiux/antipatterns.json"),json(root+"verification-rules.json"),
  json("schemas/research-candidate.v1.schema.json"),json(root+"primary-claim-checks-2026-10-09.json"),
  json(root+"primary-claim-checks-batch2-2026-10-09.json"),
  json(root+"primary-claim-checks-batch3-2026-10-09.json")
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
assert.equal(pc.claim_count,6);assert.equal(pc.verified_document_count,5);
assert.equal(pc2.claim_count,9);assert.equal(pc2.verified_document_count,8);
assert.equal(pc2.source_inventory_count,7);
assert.equal(pc3.claim_count,14);
assert.equal(pc3.verified_document_count,14);
assert.equal(pc3.source_inventory_count,13);
assert.equal(pc.source_corpus_fully_verified,false);
assert.equal(pc2.source_corpus_fully_verified,false);
assert.equal(pc3.source_corpus_fully_verified,false);
const checks=[...pc.claims,...pc2.claims,...pc3.claims];
assert.equal(checks.length,29);
unique("checked claims across batches",checks.map(x=>x.id));
assert.equal(new Set(checks.map(x=>x.source_inventory_id)).size,25);
for(const x of checks) {
  assert.equal(x.claim_status,"primary_text_checked");
  assert.equal(x.coverage,"only_identified_claims_not_full_document");
  assert.equal(x.human_approved,false);
  assert.match(x.primary_url,/^https:\/\//);
  assert.ok(x.source_section.length>0);
  assert.ok(x.evidence_class.length>0);
  assert.ok(x.caveat.length>0);
  assert.ok(s.entries.some(y=>y.id===x.source_inventory_id));
}
assert.equal(s.entries.filter(x=>x.verification_state==="limited_claims_checked").length,25);
assert.equal(s.entries.filter(x=>x.verification_state==="not_verified").length,0);
assert.equal(s.stage,"claim_coverage_only");
assert.equal(s.full_documents_verified,false);
assert.equal(s.original_research_source_catalog_complete,false);
for(const x of s.entries) {
  const matched=checks.filter(y=>y.source_inventory_id===x.id);
  assert.equal(x.verified_section,null);
  if(matched.length) {
    assert.equal(x.verification_state,"limited_claims_checked");
    assert.equal(x.primary_source_url,matched[0].primary_url);
    assert.deepEqual(x.checked_claim_ids,matched.map(y=>y.id));
    assert.equal(x.checked_on,"2026-10-09");
    if(x.id==="STD-04")assert.match(x.verification_scope_warning,/Gap Analysis not checked/);
  } else {
    assert.equal(x.verification_state,"not_verified");
    assert.equal(x.primary_source_url,null);
    assert.equal(x.checked_claim_ids,undefined);
  }
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
assert.equal(manifest.partial_claim_check_count,29);
assert.equal(manifest.partially_checked_documents,27);
assert.equal(manifest.partially_checked_inventory_entries,25);
assert.equal(manifest.unverified_inventory_entries,0);
assert.equal(manifest.batch3_claim_count,14);
assert.equal(manifest.all_inventory_entries_have_bounded_claims,true);
assert.equal(manifest.batch2_claim_count,9);
assert.equal(manifest.primary_corpus_fully_verified,false);
assert.equal(manifest.knowledge_record_count,k.records.length);
assert.equal(manifest.tradeoff_count,t.records.length);
assert.equal(manifest.learning_seed_count,q.records.length);
assert.equal(manifest.inventory_entry_count,s.entries.length);
console.log("PASS: 20 knowledge, 10 tradeoffs, 14 seeds, 25 inventory, 10 antipatterns, 12 verification rules, 1 isolated illustrative evaluation.");
console.log("LIMITATION: This test checks structure and recorded provenance only; it cannot reproduce external research verification or user approval.");
