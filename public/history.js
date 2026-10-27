// Public, read-only rendering; user-entered judgment text is always textContent.
const list = document.getElementById("public-history-list");
const status = document.getElementById("public-history-status");
function add(tag, value, cls) {
  const el = document.createElement(tag);
  el.textContent = value;
  if (cls) el.className = cls;
  return el;
}
try {
  const response = await fetch("/api/history", { cache: "no-store", credentials: "omit" });
  if (!response.ok) throw new Error("履歴を取得できませんでした。");
  const data = await response.json();
  const history = Array.isArray(data.history) ? data.history : [];
  status.textContent = history.length ? "直近の回答（閲覧専用）" : "まだ公開回答はありません。";
  for (const item of history) {
    const row = add("article", "", "history-item");
    row.append(add("small", item.domain_id + " / " + ({GO:"GO",CORRECT:"修正",SKIP:"保留"}[item.action] || item.action) + " / " + new Date(item.updated_at).toLocaleString("ja-JP")));
    row.append(add("p", item.prompt));
    if (item.answer) row.append(add("p", "採用案: " + item.answer));
    if (item.note) row.append(add("p", "補足: " + item.note));
    list.append(row);
  }
} catch {
  status.textContent = "回答履歴を取得できませんでした。再読み込みして確認してください。";
}
