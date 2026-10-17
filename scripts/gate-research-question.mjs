import {evaluateResearchCandidate} from "./evaluate-conditional-candidates.mjs";

/**
 * Research-only seed routing. No AI call, no user data, no API or persistence.
 * A preview is NOT permission to record GO or to apply a general judgment.
 */
export function gateResearchSeed(binding,rule,context) {
  if (!binding || typeof binding.question_id!=="string" ||
      binding.human_response!==null || binding.human_approval!=="not_requested" ||
      binding.runtime_eligible!==false) throw new TypeError("Seed must be a never-approved research sample");
  const result=(status,extra={})=>Object.freeze({
    question_id:binding.question_id,
    status,knowledge_id:binding.candidate_knowledge_id,
    preview_only:true,go_recorded:false,human_authorized:false,
    rule_actionable:false,...extra
  });
  if(binding.candidate_knowledge_id===null)
    return result("defer_unmapped_rule",{reason:"no_direct_corresponding_candidate",checked_claim_hint:binding.checked_claim_hint});
  if(!rule || rule.id!==binding.candidate_knowledge_id)
    throw new Error("Missing or mismatched candidate rule");
  if(rule.personal_approval!==false || rule.runtime_eligible!==false || rule.normalized_conditions_are_hypotheses!==true)
    throw new Error("Cannot route promoted/unknown-authority rule");
  const outcome=evaluateResearchCandidate(rule,context);
  if(outcome.status==="needs_context")
    return result("defer_missing_context",{missing_facts:outcome.missing_facts});
  if(outcome.status==="contraindicated")return result("defer_contraindicated");
  if(outcome.status==="reversal_candidate")return result("defer_reversal",{consider:outcome.consider});
  if(outcome.status==="not_applicable")return result("defer_not_applicable");
  if(outcome.status!=="candidate_match")throw new Error("Unrecognized research evaluator outcome");
  if(rule.evidence_support_level!=="partial_claim_support")
    return result("defer_insufficient_evidence",{support_level:rule.evidence_support_level});
  return result("preview_candidate_only",{source_claim_ids:rule.evidence_claim_ids,
    warning:"Partial direct research source claim, not whole-rule validation or user GO"});
}
