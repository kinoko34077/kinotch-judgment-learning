// P3: Deterministic, no-model extraction of CASE-LEVEL correction material.
// Not a learned general rule. No inferred conditions, no automatic approval,
// no persistence, no public endpoint and no external API or billing.
const TYPES = Object.freeze({
  alternative: ["別案", "比較・優先順位", "元の案と修正案を、新しい条件で比較する"],
  partial: ["部分修正", "変更範囲", "変更した部分と保持すべき部分を別の事例で確認する"],
  premise: ["前提訂正", "前提の妥当性", "前提条件を明示し、条件変更時の判断を確認する"],
  exception: ["例外条件", "例外・反転境界", "例外が成立する条件と成立しない条件を対照する"],
  supplement: ["補足条件", "適用条件", "補足条件を取り除いた場合の判断変化を確認する"],
  unspecified: ["未分類の修正", "追加分類が必要", "どの部分を変えたかと、適用条件をまず明確にする"]
});
export function extractCorrectionMaterial(row) {
  if (!row || row.action !== "CORRECT") return null;
  const kind = typeof row.correction_kind === "string" &&
    Object.hasOwn(TYPES, row.correction_kind) ? row.correction_kind : "unspecified";
  const [kindLabel, target, nextCheck] = TYPES[kind];
  const answer = typeof row.answer === "string" ? row.answer : "";
  const note = typeof row.note === "string" ? row.note : "";
  if (!answer.trim() && !note.trim()) return null;
  if (typeof row.question_id !== "string" || typeof row.domain_id !== "string" ||
      !Number.isSafeInteger(Number(row.revision)) || Number(row.revision) < 1)
    throw new TypeError("Invalid correction source");
  return {
    id: row.question_id + ":revision-" + Number(row.revision),
    status: "hypothesis_material_unverified",
    authority: "owner_case_correction_not_general_approval",
    autoApproved: false,
    domain: row.domain_id,
    source: { questionId: row.question_id, revision: Number(row.revision) },
    question: row.prompt,
    baseline: { proposal: row.ai_answer, reason: row.ai_reason },
    correction: { kind, kindLabel, alternative: answer, note },
    scope: "this_question_only",
    extractedContent: note.trim() || answer.trim(),
    nextCheck: { target, suggestion: nextCheck },
    missing: ["applicability_conditions", "counterexample_evaluation", "separate_rule_approval"],
    generalized: false,
    generatedByAI: false
  };
}
export function extractCorrectionMaterials(rows) {
  if (!Array.isArray(rows)) throw new TypeError("Invalid correction rows");
  return rows.map(extractCorrectionMaterial).filter(Boolean);
}
