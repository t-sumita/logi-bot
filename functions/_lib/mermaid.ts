// Mermaid ソース生成（唯一の実装）。セッション JSON → Mermaid 文字列

import type { LogiSession, SessionParts, StepName } from "./types.js";

// ── ユーティリティ ────────────────────────────────────────────────

/** 30文字超のラベルを改行する。Mermaid ノードラベル用 */
function wrapLabel(text: string, maxLen = 28): string {
  if (!text || text === "") return "（未入力）";
  if (text.length <= maxLen) return text;
  // 日本語は文字単位で折り返す
  const lines: string[] = [];
  let cur = "";
  for (const ch of text) {
    cur += ch;
    if (cur.length >= maxLen) {
      lines.push(cur);
      cur = "";
    }
  }
  if (cur) lines.push(cur);
  return lines.join("\n");
}

/** Mermaid ノードラベルを安全にクォートする */
function q(text: string): string {
  return `"${wrapLabel(text).replace(/"/g, "'")}"`;
}

/** 配列から非空要素のみ取り出す（最大 max 個）*/
function nonEmpty(arr: string[], max = 4): string[] {
  return arr.filter((s) => s.trim()).slice(0, max);
}

// ── Step 1: コア図 ────────────────────────────────────────────────

function buildStep1(parts: SessionParts): string {
  const { reality, ideal, proposal } = parts.core;
  return [
    "flowchart TB",
    `  R[${q("🔴 現実\\n" + reality)}]`,
    `  I[${q("🟢 理想\\n" + ideal)}]`,
    `  P[${q("💡 提案\\n" + proposal)}]`,
    `  R -->|"ギャップ"| I`,
    `  P -->|"橋渡し"| I`,
    `  R -.->|"課題の源"| P`,
  ].join("\n");
}

// ── Step 2: ドリルダウン図 ────────────────────────────────────────

function buildStep2(parts: SessionParts): string {
  const factors = nonEmpty(parts.drilldown.reality_factors);
  const goals = nonEmpty(parts.drilldown.ideal_goals);
  const gap = parts.drilldown.gap_summary || "変革";

  const rfNodes = factors.length > 0
    ? factors.map((f, i) => `    RF${i}[${q(f)}]`).join("\n")
    : `    RF0[${q("（未入力）")}]`;

  const igNodes = goals.length > 0
    ? goals.map((g, i) => `    IG${i}[${q(g)}]`).join("\n")
    : `    IG0[${q("（未入力）")}]`;

  return [
    "flowchart LR",
    "  subgraph 現実の要因",
    "    direction TB",
    rfNodes,
    "  end",
    "  subgraph 理想の成果",
    "    direction TB",
    igNodes,
    "  end",
    `  現実の要因 -->|${q(gap)}| 理想の成果`,
  ].join("\n");
}

// ── Step 3: What/How 図 ───────────────────────────────────────────

function buildStep3(parts: SessionParts): string {
  const whats = nonEmpty(parts.what_how.what_items);
  const hows = nonEmpty(parts.what_how.how_items);
  const len = Math.min(whats.length, hows.length);

  if (len === 0) {
    return [
      "flowchart TB",
      `  W[${q("What（何を）")}] --> H[${q("How（どうやって）")}]`,
    ].join("\n");
  }

  const wNodes = whats.slice(0, len).map((w, i) => `    W${i}[${q(w)}]`).join("\n");
  const hNodes = hows.slice(0, len).map((h, i) => `    H${i}[${q(h)}]`).join("\n");
  const edges = Array.from({ length: len }, (_, i) => `  W${i} --> H${i}`).join("\n");

  return [
    "flowchart TB",
    `  subgraph "What（何を）"`,
    wNodes,
    "  end",
    `  subgraph "How（どうやって）"`,
    hNodes,
    "  end",
    edges,
  ].join("\n");
}

// ── Step 4: 検証図 ────────────────────────────────────────────────

function buildStep4(parts: SessionParts): string {
  const contradictions = parts.verification.contradictions.filter(
    (c) => c.description.trim()
  );

  if (contradictions.length === 0) {
    return [
      "flowchart LR",
      `  S1[${q("Step 1\\nコア")}] --> S2[${q("Step 2\\nドリルダウン")}]`,
      `  S2 --> S3[${q("Step 3\\nWhat/How")}]`,
      `  S3 --> OK[${q("✅ 論理一貫\\n整合性確認済み")}]`,
    ].join("\n");
  }

  const c = contradictions[0];
  return [
    "flowchart TB",
    `  C{${q("🔍 矛盾検出\\n" + c.description)}}`,
    `  S1[${q("Step 1\\nコア")}] --> C`,
    `  S3[${q("Step 3\\nWhat/How")}] --> C`,
    c.resolution.trim()
      ? `  C -->|${q("解決: " + c.resolution)}| OK[${q("✅ 解決済み")}]`
      : `  C --> UNRESOLVED[${q("⚠️ 未解決")}]`,
  ].join("\n");
}

// ── Step 5 / Final: 合体ロボ図 ────────────────────────────────────

function buildFinal(parts: SessionParts): string {
  const { core, what_how, frame } = parts;
  const firstWhat = nonEmpty(what_how.what_items)[0] ?? "What";
  const firstHow = nonEmpty(what_how.how_items)[0] ?? "How";

  const lines = ["flowchart TB"];

  if (frame.title) {
    lines.unshift(`---\ntitle: ${frame.title}\n---`);
  }

  lines.push(
    `  subgraph "🎯 イントロ"`,
    `    H[${q("フック:\\n" + frame.intro.hook)}]`,
    "  end",
    `  subgraph "⚙️ コア"`,
    `    R[${q("🔴 現実\\n" + core.reality)}] -->|"ギャップ"| ID[${q("🟢 理想\\n" + core.ideal)}]`,
    `    P[${q("💡 提案\\n" + core.proposal)}] --> ID`,
    "  end",
    `  subgraph "🔬 展開"`,
    "    direction LR",
    `    W[${q("What:\\n" + firstWhat)}] --> HW[${q("How:\\n" + firstHow)}]`,
    "  end",
    `  subgraph "🏁 クロージング"`,
    `    CTA[${q("行動促進:\\n" + frame.closing.cta)}]`,
    "  end",
    "  イントロ --> コア --> 展開 --> クロージング"
  );

  return lines.join("\n");
}

// ── 公開 API ─────────────────────────────────────────────────────

/**
 * 指定ステップの Mermaid ソースを生成する。
 * @param step  生成対象のステップ（"final" は合体ロボ図）
 * @param session  現在のセッション状態
 */
export function buildDiagram(
  step: StepName | "final",
  session: LogiSession
): string {
  const { parts } = session;
  switch (step) {
    case "step1_core":
      return buildStep1(parts);
    case "step2_drilldown":
      return buildStep2(parts);
    case "step3_what_how":
      return buildStep3(parts);
    case "step4_verify":
      return buildStep4(parts);
    case "step5_combine":
    case "final":
      return buildFinal(parts);
    default:
      return `flowchart TB\n  A["（図なし: ${step}）"]`;
  }
}

/**
 * バルク抽出後の仮組み図を一括生成して返す。
 * 抽出済みのステップのみ生成する。
 */
export function buildBulkDiagrams(
  session: LogiSession
): Partial<Record<"step1" | "step2" | "step3" | "step4" | "step5" | "final", string>> {
  const { parts } = session;
  const result: ReturnType<typeof buildBulkDiagrams> = {};

  if (parts.core.reality || parts.core.ideal || parts.core.proposal)
    result.step1 = buildStep1(parts);
  if (parts.drilldown.reality_factors.length > 0 || parts.drilldown.ideal_goals.length > 0)
    result.step2 = buildStep2(parts);
  if (parts.what_how.what_items.length > 0 || parts.what_how.how_items.length > 0)
    result.step3 = buildStep3(parts);
  if (parts.verification.contradictions.length > 0 || parts.verification.is_consistent)
    result.step4 = buildStep4(parts);
  if (parts.frame.intro.hook || parts.frame.closing.cta)
    result.step5 = buildFinal(parts);

  return result;
}
