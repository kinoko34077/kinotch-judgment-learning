const el = id => document.getElementById(id);
let question = null;
let domain = "";
function status(message) { el("message").textContent = message; }
async function request(path, body) {
  const options = body === undefined ? { credentials: "same-origin", cache: "no-store" } : {
    method: "POST", credentials: "same-origin", cache: "no-store",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  };
  const response = await fetch(path, options);
  if (response.status === 401) { location.replace("/"); throw new Error("ログインが必要です"); }
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || "通信エラー");
  return value;
}
function element(tag, value, className) {
  const node = document.createElement(tag);
  node.textContent = value;
  if (className) node.className = className;
  return node;
}
async function nextQuestion() {
  el("question").hidden = true;
  el("correction").hidden = true;
  status("次の設問を読み込み中…");
  const data = await request("/api/next?domain=" + encodeURIComponent(domain));
  question = data.question;
  if (!question) { status("この分野の初期設問はすべて回答済みです。履歴から取り消すと再回答できます。"); return; }
  el("qid").textContent = question.domain.toUpperCase() + " / " + question.id;
  el("prompt").textContent = question.prompt;
  el("ai-answer").textContent = question.aiAnswer;
  el("ai-reason").textContent = question.aiReason;
  el("options").textContent = (question.choices || []).join("\n");
  el("source").textContent = question.source || "";
  el("question").hidden = false;
  status("妥当ならGO、異なる場合だけ修正してください。");
}
async function refreshHistory() {
  const { history } = await request("/api/history");
  const root = el("history");
  root.replaceChildren();
  if (!history.length) { root.textContent = "回答履歴はありません。"; return; }
  for (const item of history) {
    const row = element("div", "", "history-item");
    const details = element("div", "");
    details.append(element("small", item.domain_id + " / " + item.action + " / 更新 " + new Date(item.updated_at).toLocaleString("ja-JP")));
    details.append(element("p", item.prompt));
    const correction = [item.answer, item.note].filter(Boolean).join(" / ");
    if (correction) details.append(element("p", correction));
    const undo = element("button", "取り消し", "button secondary");
    undo.type = "button";
    undo.addEventListener("click", async () => {
      if (!confirm("この回答を取り消して、再度出題できるようにしますか？")) return;
      undo.disabled = true;
      try { await request("/api/undo", { questionId: item.question_id }); await refreshHistory(); await nextQuestion(); }
      catch (e) { status(e.message); } finally { undo.disabled = false; }
    });
    row.append(details, undo);
    root.append(row);
  }
}
async function save(action, answer = "", note = "") {
  if (!question) return;
  const buttons = [...el("question").querySelectorAll("button")];
  buttons.forEach(b => { b.disabled = true; });
  try {
    await request("/api/answer", { questionId: question.id, action, answer, note });
    await Promise.all([nextQuestion(), refreshHistory()]);
  } catch (e) { status(e.message); }
  finally { buttons.forEach(b => { b.disabled = false; }); }
}
async function init() {
  try {
    await request("/api/me");
    const { domains } = await request("/api/domains");
    el("domain").replaceChildren();
    for (const item of domains) {
      const option = element("option", item.name);
      option.value = item.id;
      el("domain").append(option);
    }
    el("domain").disabled = false;
    domain = domains[0]?.id || "";
    if (!domain) { status("設問分野がありません。"); return; }
    await Promise.all([nextQuestion(), refreshHistory()]);
  } catch (e) { status(e.message); }
}
el("domain").addEventListener("change", async event => {
  domain = event.target.value;
  try { await nextQuestion(); } catch (e) { status(e.message); }
});
el("go").addEventListener("click", () => save("GO"));
el("skip").addEventListener("click", () => save("SKIP"));
el("edit").addEventListener("click", () => { el("correction").hidden = false; el("answer").focus(); });
el("cancel").addEventListener("click", () => { el("correction").hidden = true; });
el("correction").addEventListener("submit", event => {
  event.preventDefault();
  const answer = el("answer").value.trim();
  const note = el("note").value.trim();
  if (!answer && !note) { status("修正内容か採用案を入力してください。"); return; }
  el("correction").reset();
  save("CORRECT", answer, note);
});
el("refresh").addEventListener("click", () => refreshHistory().catch(e => status(e.message)));
el("logout").addEventListener("click", async () => {
  try { await request("/auth/logout", {}); location.replace("/"); } catch (e) { status(e.message); }
});
init();