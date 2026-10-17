// クライアントサイド合体ロボ Mermaid ビルダー
// セッション状態から全パーツ ([0]〜[8]) を含む flowchart TB を生成する。
// AI が生成した文字列に依存しないため構文エラーが発生しない。

// ── サニタイズ ────────────────────────────────────────────────────

/**
 * Mermaid ノードラベルに埋め込む文字列を安全な形に変換する。
 * - 実際の改行 → スペース
 * - " → ' (ラベル境界保護)
 * - ` → ' (バックティック保護)
 * - [ ] { } → 全角に変換（Mermaid パーサー干渉回避）
 * - 長さ上限 maxLen 文字
 */
function sanitizeNode(text, maxLen = 28) {
  if (!text || !text.trim()) return "";
  return text.trim()
    .replace(/[\r\n\t]+/g, " ")
    .replace(/"/g, "'")
    .replace(/`/g, "'")
    .replace(/\[/g, "［").replace(/\]/g, "］")
    .replace(/\{/g, "｛").replace(/\}/g, "｝")
    .slice(0, maxLen);
}

/**
 * 番号付きノードラベルを ["..."] 形式で生成する。
 * @param {string} nodeId  - 番号文字列 ("0"〜"8" または "4-1" 等)
 * @param {string} label   - 日本語ラベル
 * @param {string} value   - 現在の値（空なら"未入力"表示）
 * @param {string} status  - NodeStatus
 * @returns {string} Mermaid ノード定義文字列 ["..."]
 */
function nodeLabel(nodeId, label, value, status) {
  const prefix = `[${nodeId}] ${sanitizeNode(label, 8)}`;
  let body = value ? sanitizeNode(value, 20) : "（未入力）";
  if (status === "ai_draft")    body += "\\n（AI案）";
  if (status === "unconfirmed") body += "\\n（未確認）";
  return `["${prefix}\\n${body}"]`;
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
 *
 * 構造:
 *   INTRO（頭）
 *     └─ UPPER_BODY（透明枠）
 *          ├─ LEFT_ARM（左腕: [4-x]）─── REAL
 *          ├─ CORE: REAL──>[2]IDEAL, REAL/IDEAL─.─>PROP
 *          └─ IDEAL ─── RIGHT_ARM（右腕: [5-x]）
 *     └─ PROP → LEGS（透明枠）
 *          ├─ LEFT_LEG（左足: [6-x]）
 *          └─ RIGHT_LEG（右足: [7-x]）
 *     └─ BASE（台座: [8]）
 *
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
  L.push('classDef unset fill:#F1F5F9,stroke:#CBD5E1,stroke-dasharray:5 5,color:#94A3B8');
  L.push('classDef ai_draft fill:#FFFBEB,stroke:#D97706,stroke-width:2px,color:#92400E');
  L.push('classDef unconfirmed fill:#FFF7ED,stroke:#EA580C,stroke-dasharray:5 5,stroke-width:2px,color:#9A3412');
  L.push('classDef confirmed fill:#DBEAFE,stroke:#2563EB,stroke-width:2px,color:#1E40AF');
  L.push('classDef done fill:#DCFCE7,stroke:#16A34A,stroke-width:2px,color:#15803D');
  L.push('classDef current fill:#EEF2FF,stroke:#4F46E5,stroke-width:3px,color:#3730A3');
  L.push("");

  // ── [0] 頭（イントロ）──
  const hook = parts.frame.intro.hook;
  const s0 = st("0", !!hook.trim());
  L.push(`    INTRO${nodeLabel("0", "🧠 イントロ", hook, s0)}:::${s0}`);
  L.push("");

  // ── UPPER_BODY（透明外枠: 胴体と左右の腕を横並びに）──
  L.push('    subgraph UPPER_BODY[" "]');
  L.push("        direction LR");

  // LEFT_ARM（左腕: 現実の詳細 [4-x]）
  L.push('        subgraph LEFT_ARM["💪 左腕"]');
  L.push("            direction TB");
  const rf = parts.drilldown.reality_factors.filter((x) => x.trim());
  if (rf.length === 0) {
    const s4 = st("4", false);
    L.push(`            nn4_0${nodeLabel("4", "現実詳細", "", s4)}:::${s4}`);
  } else {
    rf.forEach((f, i) => {
      const nid = `4-${i + 1}`;
      const s4i = st(nid, true);
      L.push(`            nn4_${i + 1}${nodeLabel(nid, "現実詳細", f, s4i)}:::${s4i}`);
    });
    // 縦直列接続
    for (let i = 1; i < rf.length; i++) {
      L.push(`            nn4_${i} --> nn4_${i + 1}`);
    }
  }
  L.push("        end");

  // CORE（胴体）
  const reality  = parts.core.reality;
  const ideal    = parts.core.ideal;
  const proposal = parts.core.proposal;
  const s1 = st("1", !!reality.trim());
  const s2 = st("2", !!ideal.trim());
  const s3 = st("3", !!proposal.trim());
  L.push('        subgraph CORE["🫀 胴体（コア）"]');
  L.push("            direction TB");
  L.push(`            REAL${nodeLabel("1", "現実", reality, s1)}:::${s1}`);
  L.push(`            IDEAL${nodeLabel("2", "理想", ideal, s2)}:::${s2}`);
  L.push(`            PROP${nodeLabel("3", "提案", proposal, s3)}:::${s3}`);
  L.push('            REAL -->|"なぜ？"| IDEAL');
  L.push("            REAL -.-> PROP");
  L.push("            IDEAL -.-> PROP");
  L.push("        end");

  // RIGHT_ARM（右腕: 理想の詳細 [5-x]）
  L.push('        subgraph RIGHT_ARM["🛡️ 右腕"]');
  L.push("            direction TB");
  const ig = parts.drilldown.ideal_goals.filter((x) => x.trim());
  if (ig.length === 0) {
    const s5 = st("5", false);
    L.push(`            nn5_0${nodeLabel("5", "理想詳細", "", s5)}:::${s5}`);
  } else {
    ig.forEach((g, i) => {
      const nid = `5-${i + 1}`;
      const s5i = st(nid, true);
      L.push(`            nn5_${i + 1}${nodeLabel(nid, "理想詳細", g, s5i)}:::${s5i}`);
    });
    for (let i = 1; i < ig.length; i++) {
      L.push(`            nn5_${i} --> nn5_${i + 1}`);
    }
  }
  L.push("        end");

  // UPPER_BODY 内の腕接続
  L.push("        LEFT_ARM --- REAL");
  L.push("        IDEAL --- RIGHT_ARM");
  L.push("    end");
  L.push("");

  // INTRO → CORE
  L.push("    INTRO --> CORE");
  L.push("");

  // ── LEGS（透明外枠: 両足を横並びに）──
  L.push('    subgraph LEGS[" "]');
  L.push("        direction LR");

  // LEFT_LEG（左足: What [6-x]）
  L.push('        subgraph LEFT_LEG["🦿 左足（What）"]');
  L.push("            direction TB");
  const wh = parts.what_how.what_items.filter((x) => x.trim());
  if (wh.length === 0) {
    const s6 = st("6", false);
    L.push(`            nn6_0${nodeLabel("6", "What", "", s6)}:::${s6}`);
  } else {
    wh.forEach((w, i) => {
      const nid = `6-${i + 1}`;
      const s6i = st(nid, true);
      L.push(`            nn6_${i + 1}${nodeLabel(nid, "What", w, s6i)}:::${s6i}`);
    });
    for (let i = 1; i < wh.length; i++) {
      L.push(`            nn6_${i} --> nn6_${i + 1}`);
    }
  }
  L.push("        end");

  // RIGHT_LEG（右足: How [7-x]）
  L.push('        subgraph RIGHT_LEG["⚡ 右足（How）"]');
  L.push("            direction TB");
  const hw = parts.what_how.how_items.filter((x) => x.trim());
  if (hw.length === 0) {
    const s7 = st("7", false);
    L.push(`            nn7_0${nodeLabel("7", "How", "", s7)}:::${s7}`);
  } else {
    hw.forEach((h, i) => {
      const nid = `7-${i + 1}`;
      const s7i = st(nid, true);
      L.push(`            nn7_${i + 1}${nodeLabel(nid, "How", h, s7i)}:::${s7i}`);
    });
    for (let i = 1; i < hw.length; i++) {
      L.push(`            nn7_${i} --> nn7_${i + 1}`);
    }
  }
  L.push("        end");

  L.push("    end");
  L.push("");

  // PROP → 両足
  L.push("    PROP --> LEFT_LEG");
  L.push("    PROP --> RIGHT_LEG");
  L.push("");

  // ── [8] 台座（クロージング）──
  const cta = parts.frame.closing.cta;
  const s8 = st("8", !!cta.trim());
  L.push(`    BASE${nodeLabel("8", "🗂️ 台座", cta, s8)}:::${s8}`);
  L.push("    LEFT_LEG --> BASE");
  L.push("    RIGHT_LEG --> BASE");
  L.push("");

  // 外枠を非表示（純粋なロボットシルエットのみ表示）
  L.push("    style UPPER_BODY fill:none,stroke:none");
  L.push("    style LEGS fill:none,stroke:none");

  return L.join("\n");
}

// ── SVGノードクリックハンドラー ───────────────────────────────────

/**
 * Mermaid ノード DOM ID → logi-bot 番号ID に変換する。
 * 対応: INTRO→"0", REAL→"1", IDEAL→"2", PROP→"3", BASE→"8"
 *      nn4_1→"4-1", nn4_0→"4", nn5_2→"5-2", nn6_1→"6-1", nn7_1→"7-1"
 */
function mermaidIdToNodeId(mId) {
  const namedMap = { INTRO: "0", REAL: "1", IDEAL: "2", PROP: "3", BASE: "8" };
  if (namedMap[mId]) return namedMap[mId];
  // nn4_1 → "4-1", nn4_0 → "4"（プレースホルダー）
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
