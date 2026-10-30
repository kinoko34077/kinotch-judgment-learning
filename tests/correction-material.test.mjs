import test from "node:test";
import assert from "node:assert/strict";
import {extractCorrectionMaterial, extractCorrectionMaterials} from "../worker/correction-material.js";

const common = {
  question_id:"uiux-src-wcag257",domain_id:"uiux",prompt:"条件を変更したら？",
  ai_answer:"B",ai_reason:"根拠に基づく初期案",action:"CORRECT",
  answer:"別案を採用",note:"ただし条件が成立しない場合は別の手順",
  correction_kind:"exception",revision:2
};
test("GO and SKIP never authorize a general judgment or even candidate material", () => {
  assert.equal(extractCorrectionMaterial({...common,action:"GO"}),null);
  assert.equal(extractCorrectionMaterial({...common,action:"SKIP"}),null);
  assert.deepEqual(extractCorrectionMaterials([{...common,action:"GO"},{...common,action:"SKIP"}]),[]);
});
test("every supported correction is scoped to a case, never promoted or generalized", () => {
  const types=["alternative","partial","premise","exception","supplement","unspecified"];
  for (const kind of types) {
    const candidate = extractCorrectionMaterial({...common,correction_kind:kind});
    assert.equal(candidate.status,"hypothesis_material_unverified");
    assert.equal(candidate.authority,"owner_case_correction_not_general_approval");
    assert.equal(candidate.autoApproved,false);
    assert.equal(candidate.generalized,false);
    assert.equal(candidate.generatedByAI,false);
    assert.equal(candidate.scope,"this_question_only");
    assert.equal(candidate.source.questionId,common.question_id);
    assert.equal(candidate.source.revision,2);
    assert.deepEqual(candidate.baseline,{proposal:common.ai_answer,reason:common.ai_reason});
    assert.equal(candidate.correction.note,common.note);
    assert.equal(candidate.correction.alternative,common.answer);
    assert.equal(candidate.extractedContent,common.note);
    assert.equal(candidate.missing.includes("separate_rule_approval"),true);
    assert.ok(candidate.nextCheck.suggestion.length > 8);
  }
});
test("legacy corrections are retained as unclassified, no invented applicability", () => {
  const material=extractCorrectionMaterial({...common,correction_kind:"",answer:"修正A",note:""});
  assert.equal(material.correction.kind,"unspecified");
  assert.equal(material.extractedContent,"修正A");
  assert.equal(material.scope,"this_question_only");
  assert.equal(material.missing.includes("applicability_conditions"),true);
});
test("empty correction and corrupted source do not create false rules", () => {
  assert.equal(extractCorrectionMaterial({...common,answer:"",note:""}),null);
  assert.throws(()=>extractCorrectionMaterial({...common,revision:0}),TypeError);
  assert.throws(()=>extractCorrectionMaterial({...common,domain_id:123}),TypeError);
  assert.throws(()=>extractCorrectionMaterials({}),TypeError);
});
