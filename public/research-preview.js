// Research-only owner UI. Never calls /api/answer or persists a GO.
const choose = document.getElementById("research-seed");
const description = document.getElementById("research-description");
const factsRoot = document.getElementById("research-facts");
const form = document.getElementById("research-form");
const outcome = document.getElementById("research-outcome");
const byId = new Map();
const statuses = {
  defer_unmapped_rule: "保留：対応する知識候補がありません",
  defer_missing_context: "保留：適用条件が不足しています",
  defer_contraindicated: "保留：禁忌条件が確認されました",
  defer_reversal: "保留：判断の反転条件が成立しています",
  defer_not_applicable: "保留：今回の条件には適用できません",
  defer_insufficient_evidence: "保留：根拠が不足しています",
  preview_candidate_only: "研究用プレビューのみ：採用・承認はされません"
};
function el(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}
function describe() {
  const seed = byId.get(choose.value);
  description.replaceChildren();
  factsRoot.replaceChildren();
  outcome.textContent = seed ? statuses[seed.initialStatus] || "条件を確認してください" : "研究例がありません";
  if (!seed) return;
  description.append(el("strong", seed.id + " — " + seed.scenario));
  description.append(el("p", "研究資料の初期候補: " + seed.aiResearchSeed));
  description.append(el("p", "反転条件の例: " + seed.reversalCondition));
  description.append(el("small", "候補ID: " + (seed.candidateKnowledgeId || "未対応") +
    " / 根拠: " + seed.evidenceSupportLevel + " / 本人未承認・AI自動生成ではない"));
  for (const fact of seed.facts) {
    const label = el("label", "条件 " + fact.name + " = " + String(fact.equals));
    const select = document.createElement("select");
    select.name = fact.name;
    for (const [value, title] of [["unknown", "不明・未指定"], ["yes", "該当する"], ["no", "該当しない"]]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = title;
      select.append(option);
    }
    label.append(select);
    factsRoot.append(label);
  }
}
async function loadSeeds() {
  try {
    const response = await fetch("/api/research/seeds", { credentials: "same-origin", cache: "no-store" });
    if (!response.ok) throw Error("研究例の取得に失敗しました");
    const data = await response.json();
    if (!data.researchOnly || !Array.isArray(data.seeds)) throw Error("不正な研究レスポンス");
    choose.replaceChildren();
    for (const seed of data.seeds) {
      if (!seed.previewOnly || seed.runtimeEligible !== false || seed.modelQuestionGenerated !== false)
        throw Error("研究候補の権限情報に不整合があります");
      byId.set(seed.id, seed);
      const option = document.createElement("option");
      option.value = seed.id;
      option.textContent = seed.id + " / " + seed.scenario;
      choose.append(option);
    }
    describe();
  } catch {
    choose.replaceChildren(el("option", "研究候補を読み込めませんでした"));
    outcome.textContent = "研究候補を読み込めませんでした。ログイン状態を確認してください。";
  }
}
choose.addEventListener("change", describe);
form.addEventListener("submit", async event => {
  event.preventDefault();
  if (!byId.has(choose.value)) return;
  const selections = {};
  for (const select of factsRoot.querySelectorAll("select")) selections[select.name] = select.value;
  outcome.textContent = "研究用の条件を照合中…（保存しません）";
  try {
    const response = await fetch("/api/research/evaluate", {
      method: "POST", credentials: "same-origin", cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seedId: choose.value, selections })
    });
    if (!response.ok) throw Error("条件評価に失敗しました");
    const data = await response.json();
    const result = data.evaluation;
    if (!data.researchOnly || result.preview_only !== true ||
        result.go_recorded !== false || result.human_authorized !== false ||
        result.rule_actionable !== false) throw Error("研究条件に矛盾があります");
    outcome.textContent = (statuses[result.status] || "判定不能") +
      (result.missing_facts?.length ? " / 未指定: " + result.missing_facts.join(", ") : "") +
      (result.source_claim_ids?.length ? " / 根拠ID: " + result.source_claim_ids.join(", ") : "");
  } catch {
    outcome.textContent = "条件を評価できませんでした。値を確認して再実行してください。";
  }
});
loadSeeds();
