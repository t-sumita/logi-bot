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
 * ノード番号 → 値の Map を parts の該当位置へ割り当てる（番号体系の正本）。
 * 単一ノード: 0=hook / 1=reality / 2=ideal / 3=proposal / 8=cta
 * 配列ノード: 4-N=reality_factors / 5-N=ideal_goals / 6-N=what_items / 7-N=how_items
 * @param {Map<string,string>} nodeMap
 * @param {object} parts
 */
function assignNodesToParts(nodeMap, parts) {
  if (nodeMap.has("0")) parts.frame.intro.hook  = nodeMap.get("0");
  if (nodeMap.has("1")) parts.core.reality       = nodeMap.get("1");
  if (nodeMap.has("2")) parts.core.ideal         = nodeMap.get("2");
  if (nodeMap.has("3")) parts.core.proposal      = nodeMap.get("3");
  if (nodeMap.has("8")) parts.frame.closing.cta  = nodeMap.get("8");

  // 配列系は番号順に並べてから push する
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
  assignNodesToParts(nodeMap, parts);
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
 * Mermaid コードらしきテキストか判定する。
 * flowchart 宣言・```mermaid フェンス・番号付きノードラベル（["[N] …"]）を手掛かりにする。
 */
function isMermaidLike(text) {
  if (/```mermaid/.test(text)) return true;
  if (/\bflowchart\s+(TB|TD|BT|RL|LR)\b/.test(text)) return true;
  // ["[N] …"] / [[N] …] のような番号付きノードラベル
  if (/\[\s*["[]?\s*\[\d+(?:-\d+)?\]/.test(text)) return true;
  return false;
}

/**
 * Mermaid ノードラベルから抽出した生テキストを実データに整形する。
 * 書式例: "🫀 [1] 現実\n現実の本文" のように「ラベル語\n値」で来る場合は値だけを採る。
 * "（未入力）" を含む場合は空、"（AI案）"/"（未確認）" マーカーは除去する。
 * @param {string} raw - `[N]` 直後に続く捕捉文字列（リテラル \n を含みうる）
 * @returns {string}
 */
function cleanMermaidValue(raw) {
  // mermaid-builder はラベル内改行を literal な "\n"（バックスラッシュ+n）で埋め込む
  const segs = raw.split(/\\n/).map((s) => s.trim()).filter(Boolean);
  if (segs.some((s) => s === "（未入力）")) return "";
  const meaningful = segs.filter((s) => !/^（(AI案|未確認)）$/.test(s));
  if (meaningful.length === 0) return "";
  // 複数セグメントなら先頭はパーツ見出し（例: "現実"）とみなし、残りを値とする
  if (meaningful.length === 1) return meaningful[0];
  return meaningful.slice(1).join(" ").trim();
}

/**
 * Mermaid テキストからナンバリング記号（[N] / [N-M]）付きのノードを正規表現で抽出し、
 * parts に復元する（AI 不使用）。
 * @param {string} text
 * @param {object} parts
 * @returns {number} 復元できたノード数
 */
function parseMermaidInto(text, parts) {
  const nodeMap = new Map();
  // [N] または [N-M] の直後から、クォート/角括弧/実改行までの文字列を捕捉（literal \n は許容）
  const re = /\[(\d+(?:-\d+)?)\]\s*((?:\\n|[^"\]\n])*)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const id = m[1];
    if (nodeMap.has(id)) continue; // 最初出現値を優先
    const value = cleanMermaidValue(m[2]);
    if (value) nodeMap.set(id, value);
  }
  assignNodesToParts(nodeMap, parts);
  return nodeMap.size;
}

/**
 * テキストをパースして SessionParts とタイトルを返す。
 * STATUS.md 形式 / Markdown エクスポート形式 / Mermaid コードを順に試す。
 * いずれにも該当しなければ null を返し、呼び出し元は API バルク抽出にフォールバックする。
 *
 * @param {string} text
 * @returns {{ parts: object, title: string } | null}
 */
export function parseImportText(text) {
  const isStatus   = isStatusMdLike(text);
  const isMdExport = !isStatus && isMdExportLike(text);

  if (isStatus || isMdExport) {
    const title = extractTitle(text) || "読み込んだセッション";
    const parts = emptyParts();
    if (isStatus) parseStatusMdInto(text, parts);
    else          parseMdExportInto(text, parts);
    return { parts, title };
  }

  // Mermaid 逆インポート（番号付きノードを正規表現で抽出）
  if (isMermaidLike(text)) {
    const parts = emptyParts();
    const count = parseMermaidInto(text, parts);
    if (count > 0) return { parts, title: extractTitle(text) || "インポートした図" };
  }

  return null;
}
