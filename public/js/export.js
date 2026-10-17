// Markdown エクスポート — コピー＆ダウンロード（STATUS.md形式を含む）

import { buildRobotDiagram } from "./mermaid-builder.js";

/**
 * セッションを Markdown 文字列に変換する。
 */
export function toMarkdown(session) {
  const { title, sessionId, createdAt, parts } = session;
  const now = new Date().toLocaleString("ja-JP");
  const created = createdAt ? new Date(createdAt).toLocaleString("ja-JP") : "不明";
  const robotDiagram = buildRobotDiagram(session);

  const lines = [
    `# ${title}`,
    "",
    `> セッション ID: \`${sessionId}\`  `,
    `> 作成日: ${created}  `,
    `> エクスポート: ${now}`,
    "",
    "---",
    "",
  ];

  // Step 1
  lines.push("## Step 1: コア（胸・腹）", "");
  lines.push(`- **[1] 現実**: ${parts.core.reality || "（未入力）"}`);
  lines.push(`- **[2] 理想**: ${parts.core.ideal || "（未入力）"}`);
  lines.push(`- **[3] 提案**: ${parts.core.proposal || "（未入力）"}`);
  lines.push("");

  // Step 2
  lines.push("## Step 2: ドリルダウン（両腕）", "");
  if (parts.drilldown.reality_factors.length) {
    lines.push("### [4-N] 現実の詳細（左腕）");
    parts.drilldown.reality_factors.forEach((f, i) => lines.push(`- [4-${i + 1}] ${f}`));
    lines.push("");
  }
  if (parts.drilldown.ideal_goals.length) {
    lines.push("### [5-N] 理想の詳細（右腕）");
    parts.drilldown.ideal_goals.forEach((g, i) => lines.push(`- [5-${i + 1}] ${g}`));
    lines.push("");
  }
  if (parts.drilldown.gap_summary) {
    lines.push(`**ギャップ**: ${parts.drilldown.gap_summary}`, "");
  }

  // Step 3
  lines.push("## Step 3: What / How（両脚）", "");
  if (parts.what_how.what_items.length) {
    lines.push("| 番号 | What（何を）| How（どうやって）|");
    lines.push("|---|---|---|");
    const len = Math.max(parts.what_how.what_items.length, parts.what_how.how_items.length);
    for (let i = 0; i < len; i++) {
      lines.push(`| [6-${i + 1}]/[7-${i + 1}] | ${parts.what_how.what_items[i] ?? ""} | ${parts.what_how.how_items[i] ?? ""} |`);
    }
    lines.push("");
  }

  // Step 4
  lines.push("## Step 4: 矛盾検証（点検）", "");
  lines.push(`- **整合性**: ${parts.verification.is_consistent ? "✅ 一貫している" : "⚠️ 要確認"}`);
  if (parts.verification.contradictions.length) {
    lines.push("", "### 矛盾・解決");
    parts.verification.contradictions.forEach((c) => {
      lines.push(`- **${c.description}**: ${c.resolution || "（未解決）"}`);
    });
  }
  lines.push("");

  // Step 5
  lines.push("## Step 5: 頭・台座", "");
  lines.push(`- **[0] イントロ（フック）**: ${parts.frame.intro.hook || "（未入力）"}`);
  lines.push(`- **オーディエンス**: ${parts.frame.intro.audience || "（未入力）"}`);
  lines.push(`- **[8] クロージング CTA**: ${parts.frame.closing.cta || "（未入力）"}`);
  if (parts.frame.title) {
    lines.push(`- **タイトル**: ${parts.frame.title}`);
  }
  lines.push("");

  // 合体ロボ図
  lines.push("---", "", "## 合体ロボ図（全体シナリオ）", "", "```mermaid", robotDiagram, "```", "");

  return lines.join("\n");
}

/**
 * セッションを STATUS.md 形式（引き継ぎ用）に変換する。
 */
export function toStatusMd(session) {
  const { title, sessionId, step, parts, nodeStatuses = {} } = session;
  const now = new Date().toLocaleString("ja-JP");
  const robotDiagram = buildRobotDiagram(session);

  const STEP_LABELS = {
    step1_core: "Step 1 / コア（[1][2][3]）",
    step2_drilldown: "Step 2 / ドリルダウン（[4][5]）",
    step3_what_how: "Step 3 / What-How（[6][7]）",
    step4_verify: "Step 4 / 整合性チェック",
    step5_combine: "Step 5 / 頭・台座（[0][8]）",
    complete: "完成",
  };

  const lines = [
    `# セッション状態ファイル — logi-bot`,
    "",
    `> **タイトル**: ${title}  `,
    `> **セッション ID**: \`${sessionId}\`  `,
    `> **現在位置**: ${STEP_LABELS[step] ?? step}  `,
    `> **エクスポート日時**: ${now}`,
    "",
    "---",
    "",
  ];

  // 確定事項
  const confirmed = [];
  const aiDraft = [];
  const unconfirmed = [];

  function categorize(nodeId, value, defaultStatus) {
    if (!value || !value.trim()) return;
    const status = nodeStatuses[nodeId] ?? defaultStatus;
    const entry = `[${nodeId}] ${value.trim()}`;
    if (status === "ai_draft") aiDraft.push(entry);
    else if (status === "unconfirmed") unconfirmed.push(entry);
    else confirmed.push(entry);
  }

  categorize("1", parts.core.reality, "confirmed");
  categorize("2", parts.core.ideal, "confirmed");
  categorize("3", parts.core.proposal, "confirmed");
  parts.drilldown.reality_factors.forEach((f, i) => categorize(`4-${i + 1}`, f, "confirmed"));
  parts.drilldown.ideal_goals.forEach((g, i) => categorize(`5-${i + 1}`, g, "confirmed"));
  parts.what_how.what_items.forEach((w, i) => categorize(`6-${i + 1}`, w, "confirmed"));
  parts.what_how.how_items.forEach((h, i) => categorize(`7-${i + 1}`, h, "confirmed"));
  categorize("0", parts.frame.intro.hook, "confirmed");
  categorize("8", parts.frame.closing.cta, "confirmed");

  if (confirmed.length) {
    lines.push("## 確定事項", "");
    confirmed.forEach((e) => lines.push(`- ${e}`));
    lines.push("");
  }
  if (aiDraft.length) {
    lines.push("## AI案（要確認）", "");
    aiDraft.forEach((e) => lines.push(`- ${e}`));
    lines.push("");
  }
  if (unconfirmed.length) {
    lines.push("## 未確認事項", "");
    unconfirmed.forEach((e) => lines.push(`- ${e}`));
    lines.push("");
  }

  // 合体ロボ図
  lines.push("## 現在の合体ロボ図", "", "```mermaid", robotDiagram, "```", "");

  // 引き継ぎ指示
  lines.push("## 引き継ぎ指示", "");
  lines.push(`このファイルを新しい会話に貼り付け、「logi-botのセッションを ${STEP_LABELS[step] ?? step} から再開してください」と伝えてください。`);
  lines.push("");
  lines.push("上記の確定事項・AI案・未確認事項を参照し、未入力のパーツから対話を再開してください。");
  lines.push("");

  return lines.join("\n");
}

/**
 * Markdown をクリップボードにコピーしてトースト通知を表示する。
 */
export async function copyMarkdown(session) {
  const md = toMarkdown(session);
  try {
    await navigator.clipboard.writeText(md);
    showToast("📋 Markdownをクリップボードにコピーしました");
  } catch {
    showToast("❌ コピーに失敗しました（ブラウザの権限を確認してください）", true);
  }
}

/**
 * Markdown を .md ファイルとしてダウンロードする。
 */
export function downloadMarkdown(session) {
  const md = toMarkdown(session);
  _download(md, `${sanitizeFilename(session.title)}_logi-bot.md`);
}

/**
 * STATUS.md（引き継ぎ用）をダウンロードする。
 */
export function downloadStatusMd(session) {
  const md = toStatusMd(session);
  _download(md, `${sanitizeFilename(session.title)}_STATUS.md`);
  showToast("⬇ STATUS.mdをダウンロードしました");
}

function _download(content, filename) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function sanitizeFilename(name) {
  return name.replace(/[\\/:*?"<>|]/g, "_").slice(0, 50) || "session";
}

function showToast(msg, isError = false) {
  const existing = document.querySelector(".logi-toast");
  if (existing) existing.remove();
  const toastEl = document.createElement("div");
  toastEl.className = "logi-toast" + (isError ? " error" : "");
  toastEl.textContent = msg;
  toastEl.style.cssText = [
    "position:fixed", "bottom:80px", "left:50%", "transform:translateX(-50%)",
    "background:" + (isError ? "#DC2626" : "#1E293B"), "color:#fff",
    "padding:10px 20px", "border-radius:8px", "font-size:.85rem",
    "z-index:9999", "box-shadow:0 4px 16px rgba(0,0,0,.25)",
    "transition:opacity .3s ease",
  ].join(";");
  document.body.appendChild(toastEl);
  setTimeout(() => { toastEl.style.opacity = "0"; setTimeout(() => toastEl.remove(), 350); }, 2500);
}
