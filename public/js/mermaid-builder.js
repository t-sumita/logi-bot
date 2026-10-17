// クライアントサイド合体ロボ Mermaid ビルダー
// セッション状態から全パーツ ([0]〜[8]) を含む flowchart TB を生成する。
// AI が生成した文字列に依存しないため構文エラーが発生しない。

// ── サニタイズ ────────────────────────────────────────────────────

/**
 * Mermaid ノードラベルに埋め込む文字列を安全な形に変換する。
 * - 実際の改行 → スペース
 * - " → ' (ラベル境界保護)
 * - ` → ' (バックティック保護)
 * - 長さ上限 maxLen 文字
 */
function sanitizeNode(text, maxLen = 28) {
  if (!text || !text.trim()) return "";
  return text.trim()
    .replace(/[\r\n\t]+/g, " ")
    .replace(/"/g, "'")
    .replace(/`/g, "'")
    .slice(0, maxLen);
}

// ── ノードラベル生成 ──────────────────────────────────────────────

/**
 * 番号付きノードラベルを生成する。
 * @param {string} nodeId  - 番号文字列 ("0"〜"8" または "4-1" 等)
 * @param {string} label   - 日本語ラベル
 * @param {string} value   - 現在の値（空なら"未入力"表示）
 * @param {string} status  - NodeStatus
 * @returns {string}       - Mermaid ノードラベル文字列（ダブルクォート含む）
 */
function nodeLabel(nodeId, label, value, status) {
  const prefix = `[${nodeId}] ${sanitizeNode(label, 10)}`;
  let body = value ? sanitizeNode(value, 22) : "（未入力）";
  if (status === "ai_draft")    body += "\\n（AI案）";
  if (status === "unconfirmed") body += "\\n（未確認）";
  return `"${prefix}\\n${body}"`;
}

// ── 現在ターゲットノードの計算 ────────────────────────────────────

/**
 * 現在質問中のノード番号 Set を返す。
 * @param {string} step - StepName
 * @param {object} parts - SessionParts
 * @returns {Set<string>}
 */
function getCurrentTargetSet(step, parts) {
  const s = new Set();
  switch (step) {
    case "step1_core": {
      const { reality, ideal, proposal } = parts.core;
      if (!reality.trim())  { s.add("1"); return s; }
      if (!ideal.trim())    { s.add("2"); return s; }
      if (!proposal.trim()) { s.add("3"); return s; }
      s.add("1"); s.add("2"); s.add("3");
      return s;
    }
    case "step2_drilldown": {
      const rf = parts.drilldown.reality_factors.filter((x) => x.trim());
      const ig = parts.drilldown.ideal_goals.filter((x) => x.trim());
      if (rf.length === 0) s.add("4"); else rf.forEach((_, i) => s.add(`4-${i + 1}`));
      if (ig.length === 0) s.add("5"); else ig.forEach((_, i) => s.add(`5-${i + 1}`));
      return s;
    }
    case "step3_what_how": {
      const wh = parts.what_how.what_items.filter((x) => x.trim());
      const hw = parts.what_how.how_items.filter((x) => x.trim());
      if (wh.length === 0) s.add("6"); else wh.forEach((_, i) => s.add(`6-${i + 1}`));
      if (hw.length === 0) s.add("7"); else hw.forEach((_, i) => s.add(`7-${i + 1}`));
      return s;
    }
    case "step4_verify":
      return s;
    case "step5_combine": {
      if (!parts.frame.intro.hook.trim())  s.add("0");
      if (!parts.frame.closing.cta.trim()) s.add("8");
      if (s.size === 0) { s.add("0"); s.add("8"); }
      return s;
    }
    default:
      return s;
  }
}

// ── ステータス解決 ────────────────────────────────────────────────

/**
 * ノードのステータスを解決する。
 */
function resolveStatus(nodeId, hasValue, currentSet, nodeStatuses) {
  if (currentSet.has(nodeId)) return "current";
  const explicit = nodeStatuses[nodeId];
  if (explicit) return explicit;
  return hasValue ? "confirmed" : "unset";
}

// ── メインビルダー ────────────────────────────────────────────────

/**
 * セッション状態から合体ロボの完全な Mermaid flowchart TB を生成する。
 * 配置ルール:
 *   - [0] 頭（最上部）
 *   - CORE サブグラフ（direction LR）: [1]現実 --なぜ?--> [2]理想（横並び）
 *   - [4-N] 左腕: CORE の外側左に配置, [1]現実に直接 --- 接続
 *   - [5-N] 右腕: CORE の外側右に配置, [2]理想に直接 --- 接続
 *   - [3] 提案: CORE の下から縦に接続
 *   - LLEG（[6-N] What）と RLEG（[7-N] How）: [3]から二股
 *   - [8] 台座: LLEG・RLEG の最下部から接続
 * @param {object} session - LogiSession
 * @returns {string} Mermaid ソース
 */
export function buildRobotDiagram(session) {
  const { parts, step, nodeStatuses = {} } = session;
  const cur = getCurrentTargetSet(step, parts);

  function st(nodeId, hasValue) {
    return resolveStatus(nodeId, hasValue, cur, nodeStatuses);
  }

  const L = [];

  // ── ヘッダー ──
  L.push("flowchart TB");
  L.push("");
  L.push("classDef unset fill:#F1F5F9,stroke:#CBD5E1,stroke-dasharray:5 5,color:#94A3B8");
  L.push("classDef ai_draft fill:#FFFBEB,stroke:#D97706,stroke-width:2px,color:#92400E");
  L.push("classDef unconfirmed fill:#FFF7ED,stroke:#EA580C,stroke-dasharray:5 5,stroke-width:2px,color:#9A3412");
  L.push("classDef confirmed fill:#DBEAFE,stroke:#2563EB,stroke-width:2px,color:#1E40AF");
  L.push("classDef done fill:#DCFCE7,stroke:#16A34A,stroke-width:2px,color:#15803D");
  L.push("classDef current fill:#EEF2FF,stroke:#4F46E5,stroke-width:3px,color:#3730A3");
  L.push("");

  // ── [0] 頭（イントロ）── standalone（サブグラフなし）
  const hook = parts.frame.intro.hook;
  const s0 = st("0", !!hook.trim());
  L.push(`  nn0[${nodeLabel("0", "🧠イントロ", hook, s0)}]:::${s0}`);
  L.push("");

  // ── [4-N] 左腕（現実の詳細）── CORE の前に宣言してサブグラフ外を保証
  const rf = parts.drilldown.reality_factors.filter((x) => x.trim());
  if (rf.length === 0) {
    const s4 = st("4", false);
    L.push(`  nn4_0[${nodeLabel("4", "現実の詳細", "", s4)}]:::${s4}`);
  } else {
    rf.forEach((f, i) => {
      const nid = `4-${i + 1}`;
      const s4i = st(nid, true);
      L.push(`  nn4_${i + 1}[${nodeLabel(nid, "現実の詳細", f, s4i)}]:::${s4i}`);
    });
  }
  L.push("");

  // ── [5-N] 右腕（理想の詳細）── CORE の前に宣言してサブグラフ外を保証
  const ig = parts.drilldown.ideal_goals.filter((x) => x.trim());
  if (ig.length === 0) {
    const s5 = st("5", false);
    L.push(`  nn5_0[${nodeLabel("5", "理想の詳細", "", s5)}]:::${s5}`);
  } else {
    ig.forEach((g, i) => {
      const nid = `5-${i + 1}`;
      const s5i = st(nid, true);
      L.push(`  nn5_${i + 1}[${nodeLabel(nid, "理想の詳細", g, s5i)}]:::${s5i}`);
    });
  }
  L.push("");

  // ── [3] 提案 ── standalone（CORE の下 T 字接続）
  const proposal = parts.core.proposal;
  const s3 = st("3", !!proposal.trim());
  L.push(`  nn3[${nodeLabel("3", "提案", proposal, s3)}]:::${s3}`);
  L.push("");

  // ── [8] 台座（クロージング）── standalone
  const cta = parts.frame.closing.cta;
  const s8 = st("8", !!cta.trim());
  L.push(`  nn8[${nodeLabel("8", "🗂️台座", cta, s8)}]:::${s8}`);
  L.push("");

  // ── CORE サブグラフ: direction LR で [1][2] を横並びに ──
  const reality = parts.core.reality;
  const ideal   = parts.core.ideal;
  const s1 = st("1", !!reality.trim());
  const s2 = st("2", !!ideal.trim());
  L.push('subgraph CORE["🫀 胴体（コア）"]');
  L.push("  direction LR");
  L.push(`  nn1[${nodeLabel("1", "現実", reality, s1)}]:::${s1}`);
  L.push(`  nn2[${nodeLabel("2", "理想", ideal, s2)}]:::${s2}`);
  L.push('  nn1 -->|"なぜ？"| nn2');
  L.push("end");
  L.push("");

  // ── [6-N] 左足（What）サブグラフ ──
  const wh = parts.what_how.what_items.filter((x) => x.trim());
  L.push('subgraph LLEG["🦿 左足（What）"]');
  L.push("  direction TB");
  if (wh.length === 0) {
    const s6 = st("6", false);
    L.push(`  nn6_0[${nodeLabel("6", "What", "", s6)}]:::${s6}`);
  } else {
    wh.forEach((w, i) => {
      const nid = `6-${i + 1}`;
      const s6i = st(nid, true);
      L.push(`  nn6_${i + 1}[${nodeLabel(nid, "What", w, s6i)}]:::${s6i}`);
    });
  }
  L.push("end");
  L.push("");

  // ── [7-N] 右足（How）サブグラフ ──
  const hw = parts.what_how.how_items.filter((x) => x.trim());
  L.push('subgraph RLEG["⚡ 右足（How）"]');
  L.push("  direction TB");
  if (hw.length === 0) {
    const s7 = st("7", false);
    L.push(`  nn7_0[${nodeLabel("7", "How", "", s7)}]:::${s7}`);
  } else {
    hw.forEach((h, i) => {
      const nid = `7-${i + 1}`;
      const s7i = st(nid, true);
      L.push(`  nn7_${i + 1}[${nodeLabel(nid, "How", h, s7i)}]:::${s7i}`);
    });
  }
  L.push("end");
  L.push("");

  // ── 接続 ──
  // 頭 → 胴体
  L.push("nn0 --> CORE");
  // 胴体 → 提案（T字下方向）
  L.push('CORE -->|"解決策"| nn3');
  // 左腕 → [1]現実（左外側から接続）
  if (rf.length === 0) {
    L.push("nn4_0 --- nn1");
  } else {
    rf.forEach((_, i) => L.push(`nn4_${i + 1} --- nn1`));
  }
  // [2]理想 → 右腕（右外側へ接続）
  if (ig.length === 0) {
    L.push("nn2 --- nn5_0");
  } else {
    ig.forEach((_, i) => L.push(`nn2 --- nn5_${i + 1}`));
  }
  // 提案 → 両足（二股）
  L.push("nn3 --> LLEG");
  L.push("nn3 --> RLEG");
  // 両足 → 台座
  L.push("LLEG --> nn8");
  L.push("RLEG --> nn8");

  return L.join("\n");
}

// ── SVGノードクリックハンドラー ───────────────────────────────────

/**
 * Mermaid ID → logi-bot 番号ID に変換する。
 * nn0 → "0", nn4_1 → "4-1", nn4_0 → "4" (プレースホルダー)
 */
function mermaidIdToNodeId(mId) {
  const simple = mId.match(/^nn(\d)$/);
  if (simple) return simple[1];
  const compound = mId.match(/^nn(\d+)_(\d+)$/);
  if (compound) {
    const group = compound[1];
    const idx   = parseInt(compound[2], 10);
    return idx === 0 ? group : `${group}-${idx}`;
  }
  return null;
}

/** 番号ID → 日本語ラベル */
const NODE_ID_LABELS = {
  "0": "イントロ",
  "1": "現実",
  "2": "理想",
  "3": "提案",
  "4": "現実の詳細",
  "5": "理想の詳細",
  "6": "What",
  "7": "How",
  "8": "クロージング",
};
function nodeIdToLabel(nodeId) {
  if (NODE_ID_LABELS[nodeId]) return NODE_ID_LABELS[nodeId];
  const m = nodeId.match(/^(\d+)-(\d+)$/);
  if (m) return `${NODE_ID_LABELS[m[1]] ?? `グループ${m[1]}`} ${m[2]}番目`;
  return nodeId;
}

/**
 * レンダリングされた SVG にクリックリスナーを付与する。
 * クリックすると onNodeClick(nodeId, label) が呼ばれる。
 * @param {Element} container - diagramContent の DOM 要素
 * @param {function} onNodeClick
 */
export function attachNodeClickHandlers(container, onNodeClick) {
  const svgEl = container.querySelector("svg");
  if (!svgEl) return;

  svgEl.querySelectorAll(".node").forEach((nodeEl) => {
    const id = nodeEl.getAttribute("id") || "";
    // Mermaid v11 flowchart: id = "flowchart-<nodeId>-<num>"
    const m = id.match(/^flowchart-([^-]+(?:_\d+)?)-\d+$/);
    if (!m) return;

    const logiBotId = mermaidIdToNodeId(m[1]);
    if (!logiBotId) return;

    nodeEl.style.cursor = "pointer";
    nodeEl.classList.add("logi-clickable-node");
    nodeEl.setAttribute("title", `[${logiBotId}] をクリックして修正`);
    nodeEl.addEventListener("click", (ev) => {
      ev.stopPropagation();
      onNodeClick(logiBotId, nodeIdToLabel(logiBotId));
    });
  });
}
