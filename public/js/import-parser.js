// STATUS.md / Markdown エクスポートのクライアントサイドパーサー
// AI なしで logi-bot エクスポート形式から SessionParts を復元する。

/** 空の SessionParts を生成する */
function emptyParts() {
  return {
    core:         { reality: "", ideal: "", proposal: "" },
    drilldown:    { reality_factors: [], ideal_goals: [], gap_summary: "" },
    what_how:     { what_items: [], how_items: [], who_when: [] },
    verification: { contradictions: [], is_consistent: false },
    frame:        { intro: { audience: "", hook: "" }, closing: { cta: "" }, title: "" },
  };
}

/** STATUS.md 形式（logi-bot 引き継ぎ形式）かどうかを判定する */
function isStatusMdLike(text) {
  return (
    text.includes("セッション状態ファイル — logi-bot") ||
    (text.includes("## 確定事項") && /- \[\d/.test(text)) ||
    (text.includes("## AI案") && /- \[\d/.test(text))
  );
}

/** Markdown エクスポート形式（logi-bot 通常 MD 出力）かどうかを判定する */
function isMdExportLike(text) {
  return (
    text.includes("## Step 1: コア") ||
    /\*\*\[1\] 現実\*\*:/.test(text)
  );
}

/** テキストからタイトルを抽出する */
function extractTitle(text) {
  // STATUS.md: "> **タイトル**: {title}"
  const statusMatch = text.match(/>\s*\*\*タイトル\*\*:\s*(.+)/);
  if (statusMatch) return statusMatch[1].trim();
  // Markdown export: "# {title}" (first heading, excluding system headers)
  const mdMatch = text.match(/^#\s+(?!セッション状態)(.+)/m);
  if (mdMatch) return mdMatch[1].trim();
  return "";
}

/**
 * STATUS.md 形式のテキストから parts に値を読み込む。
 * 書式: `- [N] text` または `- [N-M] text`
 * 確定事項・AI案・未確認すべてのセクションを対象にする。
 */
function parseStatusMdInto(text, parts) {
  const nodeMap = new Map();
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*-\s*\[(\d+(?:-\d+)?)\]\s+(.+)/);
    if (!m) continue;
    const id = m[1];
    const content = m[2].trim();
    if (!nodeMap.has(id)) nodeMap.set(id, content); // 最初出現値を優先
  }

  if (nodeMap.has("0")) parts.frame.intro.hook    = nodeMap.get("0");
  if (nodeMap.has("1")) parts.core.reality         = nodeMap.get("1");
  if (nodeMap.has("2")) parts.core.ideal           = nodeMap.get("2");
  if (nodeMap.has("3")) parts.core.proposal        = nodeMap.get("3");
  if (nodeMap.has("8")) parts.frame.closing.cta    = nodeMap.get("8");

  // 配列系: [4-N] [5-N] [6-N] [7-N]
  const sorted = [...nodeMap.keys()].sort((a, b) => {
    const [am, an] = a.split("-").map(Number);
    const [bm, bn] = b.split("-").map(Number);
    return am !== bm ? am - bm : (an || 0) - (bn || 0);
  });
  for (const id of sorted) {
    const v = nodeMap.get(id);
    if (/^4-\d+$/.test(id)) parts.drilldown.reality_factors.push(v);
    else if (/^5-\d+$/.test(id)) parts.drilldown.ideal_goals.push(v);
    else if (/^6-\d+$/.test(id)) parts.what_how.what_items.push(v);
    else if (/^7-\d+$/.test(id)) parts.what_how.how_items.push(v);
  }
}

/**
 * Markdown エクスポート形式のテキストから parts に値を読み込む。
 * 書式: `- **[N] label**: text` / 箇条書き / テーブル行
 */
function parseMdExportInto(text, parts) {
  const pick = (re) => { const m = text.match(re); return m ? m[1].trim() : ""; };

  parts.core.reality         = pick(/\*\*\[1\][^*]*\*\*:\s*(.+)/);
  parts.core.ideal           = pick(/\*\*\[2\][^*]*\*\*:\s*(.+)/);
  parts.core.proposal        = pick(/\*\*\[3\][^*]*\*\*:\s*(.+)/);
  parts.frame.intro.hook     = pick(/\*\*\[0\][^*]*\*\*:\s*(.+)/);
  parts.frame.closing.cta    = pick(/\*\*\[8\][^*]*\*\*:\s*(.+)/);

  // Step 2: ### [4-N] / [5-N] セクション内の箇条書き
  let section = "";
  for (const line of text.split("\n")) {
    if (/###.+\[4/.test(line)) { section = "4"; continue; }
    if (/###.+\[5/.test(line)) { section = "5"; continue; }
    if (line.startsWith("##")) { section = ""; continue; }
    if (section === "4") {
      const m = line.match(/^\s*-\s*\[\d+-\d+\]\s+(.+)/);
      if (m) parts.drilldown.reality_factors.push(m[1].trim());
    } else if (section === "5") {
      const m = line.match(/^\s*-\s*\[\d+-\d+\]\s+(.+)/);
      if (m) parts.drilldown.ideal_goals.push(m[1].trim());
    }
  }

  // Step 3: テーブル行 `| [6-N]/[7-N] | what | how |`
  for (const m of text.matchAll(/\|\s*\[[\d-]+\]\/\[[\d-]+\]\s*\|\s*([^|]+)\|\s*([^|]+)\|/g)) {
    const what = m[1].trim();
    const how  = m[2].trim();
    if (what) parts.what_how.what_items.push(what);
    if (how)  parts.what_how.how_items.push(how);
  }
}

/**
 * テキストをパースして SessionParts とタイトルを返す。
 * STATUS.md 形式または Markdown エクスポート形式の場合に結果を返す。
 * それ以外は null を返し、呼び出し元は API バルク抽出にフォールバックする。
 *
 * @param {string} text
 * @returns {{ parts: object, title: string } | null}
 */
export function parseImportText(text) {
  const isStatus   = isStatusMdLike(text);
  const isMdExport = !isStatus && isMdExportLike(text);
  if (!isStatus && !isMdExport) return null;

  const title = extractTitle(text) || "読み込んだセッション";
  const parts = emptyParts();
  if (isStatus) {
    parseStatusMdInto(text, parts);
  } else {
    parseMdExportInto(text, parts);
  }
  return { parts, title };
}
