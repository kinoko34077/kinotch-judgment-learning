/**
 * Research-only deterministic condition checker.
 * A match NEVER authorizes usage, approval, deployment, or an autonomous action.
 * No dependencies, side effects, network calls or personal context storage.
 */
const hasOwn=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
function check(predicate,context) {
  if (!hasOwn(context,predicate.fact) || context[predicate.fact]===undefined || context[predicate.fact]===null) return null;
  return Object.is(context[predicate.fact],predicate.equals);
}
function checkAll(predicates,context) {
  if (!Array.isArray(predicates) || !predicates.length) throw new TypeError("Nonempty predicate array required");
  const values=predicates.map(p=>check(p,context));
  return values.includes(false)?false:values.includes(null)?null:true;
}
function result(rule,status,extra={}) {
  return Object.freeze({
    knowledge_id:rule.id,
    status,authority:"research_synthesis_unapproved",
    runtime_eligible:false,personal_approval:false,actionable:false,...extra
  });
}
export function evaluateResearchCandidate(rule,context) {
  if (!rule || !rule.id || !Array.isArray(rule.applies_when) ||
      !Array.isArray(rule.avoid_when) || !Array.isArray(rule.reversal_conditions))
    throw new TypeError("Invalid research candidate");
  if (!context || typeof context!=="object" || Array.isArray(context)) throw new TypeError("Context must be an object");
  if (rule.runtime_eligible!==false || rule.personal_approval!==false ||
      rule.adoption_status!=="candidate") throw new Error("Cannot evaluate promoted/unknown-authority rules");
  const applicable=checkAll(rule.applies_when,context);
  if (applicable===false) return result(rule,"not_applicable");
  // Contraindications override even a missing positive fact; fail-closed.
  const avoid=rule.avoid_when.map(p=>check(p,context));
  if (avoid.includes(true)) return result(rule,"contraindicated");
  if (applicable===null || avoid.includes(null))
    return result(rule,"needs_context",{missing_facts:missing(rule.applies_when.concat(rule.avoid_when),context)});
  const reversalResults=rule.reversal_conditions.map(c=>({condition:c,match:checkAll(c.when,context)}));
  const reversals=reversalResults.filter(x=>x.match===true);
  if (reversals.length) return result(rule,"reversal_candidate",{consider:reversals.map(x=>x.condition.consider)});
  if (reversalResults.some(x=>x.match===null))
    return result(rule,"needs_context",{missing_facts:missing(rule.reversal_conditions.flatMap(x=>x.when),context)});
  return result(rule,"candidate_match",{consider:[rule.recommendation]});
}
function missing(predicates,context) {
  return [...new Set(predicates.filter(x=>!hasOwn(context,x.fact)||context[x.fact]===undefined||context[x.fact]===null).map(x=>x.fact))];
}
export function evaluateResearchSet(records,context) {
  if (!Array.isArray(records)) throw new TypeError("Records must be an array");
  const seen=new Set();
  return records.map(rule=>{
    if (seen.has(rule.id)) throw new Error("Duplicate research rule ID "+rule.id);
    seen.add(rule.id);
    return evaluateResearchCandidate(rule,context);
  });
}
