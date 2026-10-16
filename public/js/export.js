// Markdown エクスポート — コピー＆ダウンロード

/**
 * セッションを Markdown 文字列に変換する。
 */
export function toMarkdown(session) {
  const { title, sessionId, createdAt, parts, diagrams } = session;
  const now = new Date().toLocaleString("ja-JP");
  const created = createdAt ? new Date(createdAt).toLocaleString("ja-JP") : "不明";

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
  lines.push(`- **現実**: ${parts.core.reality || "（未入力）"}`);
  lines.push(`- **理想**: ${parts.core.ideal || "（未入力）"}`);
  lines.push(`- **提案**: ${parts.core.proposal || "（未入力）"}`);
  if (diagrams.step1) {
    lines.push("", "```mermaid", diagrams.step1, "```");
  }
  lines.push("");

  // Step 2
  lines.push("## Step 2: ドリルダウン（両腕）", "");
  if (parts.drilldown.reality_factors.length) {
    lines.push("### 現実の要因");
    parts.drilldown.reality_factors.forEach((f) => lines.push(`- ${f}`));
    lines.push("");
  }
  if (parts.drilldown.ideal_goals.length) {
    lines.push("### 理想の成果");
    parts.drilldown.ideal_goals.forEach((g) => lines.push(`- ${g}`));
    lines.push("");
  }
  if (parts.drilldown.gap_summary) {
    lines.push(`**ギャップ**: ${parts.drilldown.gap_summary}`, "");
  }
  if (diagrams.step2) {
    lines.push("```mermaid", diagrams.step2, "```", "");
  }

  // Step 3
  lines.push("## Step 3: What / How（両脚）", "");
  if (parts.what_how.what_items.length) {
    lines.push("| What（何を）| How（どうやって）|");
    lines.push("|---|---|");
    const len = Math.max(parts.what_how.what_items.length, parts.what_how.how_items.length);
    for (let i = 0; i < len; i++) {
      lines.push(`| ${parts.what_how.what_items[i] ?? ""} | ${parts.what_how.how_items[i] ?? ""} |`);
    }
    lines.push("");
  }
  if (diagrams.step3) {
    lines.push("```mermaid", diagrams.step3, "```", "");
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
  if (diagrams.step4) {
    lines.push("", "```mermaid", diagrams.step4, "```");
  }
  lines.push("");

  // Step 5
  lines.push("## Step 5: 頭・台座", "");
  lines.push(`- **フック**: ${parts.frame.intro.hook || "（未入力）"}`);
  lines.push(`- **オーディエンス**: ${parts.frame.intro.audience || "（未入力）"}`);
  lines.push(`- **クロージング CTA**: ${parts.frame.closing.cta || "（未入力）"}`);
  if (parts.frame.title) {
    lines.push(`- **タイトル**: ${parts.frame.title}`);
  }
  if (diagrams.step5) {
    lines.push("", "```mermaid", diagrams.step5, "```");
  }
  lines.push("");

  // Final
  if (diagrams.final) {
    lines.push("---", "", "## 合体ロボ図（全体シナリオ）", "", "```mermaid", diagrams.final, "```", "");
  }

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
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitizeFilename(session.title)}_logi-bot.md`;
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
  const el = document.createElement("div");
  el.className = "logi-toast" + (isError ? " error" : "");
  el.textContent = msg;
  el.style.cssText = [
    "position:fixed", "bottom:80px", "left:50%", "transform:translateX(-50%)",
    "background:" + (isError ? "#DC2626" : "#1E293B"), "color:#fff",
    "padding:10px 20px", "border-radius:8px", "font-size:.85rem",
    "z-index:9999", "box-shadow:0 4px 16px rgba(0,0,0,.25)",
    "transition:opacity .3s ease",
  ].join(";");
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; setTimeout(() => el.remove(), 350); }, 2500);
}
