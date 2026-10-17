// Mermaid ソース生成（唯一の実装）。セッション JSON → Mermaid 文字列（サーバーサイド専用）

import type { LogiSession, SessionParts, StepName } from "./types.js";

// ── サニタイズ ────────────────────────────────────────────────────

/**
 * Mermaid ノードラベルに埋め込む文字列をサニタイズする。
 * - 実際の改行 → スペース（`\n` はラベル内改行に使うため区別）
 * - ダブルクォート → シングルクォート（ラベル境界を壊さないため必須）
 * - 長さ上限 200 文字
 */
function sanitize(raw: string): string {
  if (!raw || raw.trim() === "") return "";
  return raw
    .trim()
    .replace(/[\r\n]+/g, " ")     // 実際の改行 → スペース
    .replace(/"/g, "'")            // " → ' (ラベル境界保護)
    .slice(0, 200);
}

/** 30 文字超のラベルを `\n` で折り返す（Mermaid のノード内改行）*/
function wrap(text: string, maxLen = 28): string {
  if (text.length <= maxLen) return text;
  const chunks: string[] = [];
  let cur = "";
  for (const ch of text) {
    cur += ch;
    if (cur.length >= maxLen) { chunks.push(cur); cur = ""; }
  }
  if (cur) chunks.push(cur);
  return chunks.join("\\n");
}

/** テキストをサニタイズ → 折り返し → Mermaid ラベル文字列にする */
function label(raw: string, fallback = "（未入力）"): string {
  const s = sanitize(raw);
  return s ? wrap(s) : fallback;
}

/** ノードラベルをダブルクォートで囲む */
function q(raw: string, fallback = "（未入力）"): string {
  return `"${label(raw, fallback)}"`;
}

/** 配列から非空要素のみ取り出す（最大 max 個）*/
function nonEmpty(arr: string[], max = 4): string[] {
  return arr.filter((s) => s.trim()).slice(0, max);
}

// ── Step 1: 胴体（コア）図 ────────────────────────────────────────

function buildStep1(parts: SessionParts): string {
  const { reality, ideal, proposal } = parts.core;
  return [
    "flowchart TB",
    `  R[${q("🔴 現実\\n" + reality, "（未入力）")}]`,
    `  I[${q("🟢 理想\\n" + ideal, "（未入力）")}]`,
    `  P[${q("💡 提案\\n" + proposal, "（未入力）")}]`,
    `  R -->|"ギャップ"| I`,
    `  P -->|"橋渡し"| I`,
    `  R -.->|"課題の源"| P`,
  ].join("\n");
}

// ── Step 2: 左腕・右腕（ドリルダウン）図 ─────────────────────────

function buildStep2(parts: SessionParts): string {
  const factors = nonEmpty(parts.drilldown.reality_factors);
  const goals   = nonEmpty(parts.drilldown.ideal_goals);
  const gap     = sanitize(parts.drilldown.gap_summary) || "変革";

  const rfNodes = factors.length > 0
    ? factors.map((f, i) => `    RF${i}[${q(f)}]`).join("\n")
    : `    RF0["（未入力）"]`;

  const igNodes = goals.length > 0
    ? goals.map((g, i) => `    IG${i}[${q(g)}]`).join("\n")
    : `    IG0["（未入力）"]`;

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

// ── Step 3: 両足（What/How）図 ────────────────────────────────────

function buildStep3(parts: SessionParts): string {
  const whats = nonEmpty(parts.what_how.what_items);
  const hows  = nonEmpty(parts.what_how.how_items);
  const len   = Math.min(whats.length, hows.length);

  if (len === 0) {
    return [
      "flowchart TB",
      `  W["What（何を）"] --> H["How（どうやって）"]`,
    ].join("\n");
  }

  const wNodes = whats.slice(0, len).map((w, i) => `    W${i}[${q(w)}]`).join("\n");
  const hNodes = hows.slice(0,  len).map((h, i) => `    H${i}[${q(h)}]`).join("\n");
  const edges  = Array.from({ length: len }, (_, i) => `  W${i} --> H${i}`).join("\n");

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

// ── Step 4: 合体前の点検（検証）図 ───────────────────────────────

function buildStep4(parts: SessionParts): string {
  const cs = parts.verification.contradictions.filter((c) => c.description.trim());

  if (cs.length === 0) {
    return [
      "flowchart LR",
      `  S1["Step 1\\n胴体（コア）"] --> S2["Step 2\\n左腕・右腕"]`,
      `  S2 --> S3["Step 3\\n両足（2本柱）"]`,
      `  S3 --> OK["✅ 論理一貫\\n整合性確認済み"]`,
    ].join("\n");
  }

  const c = cs[0];
  const resolvedEdge = c.resolution.trim()
    ? `  C -->|${q("解決: " + c.resolution)}| OK["✅ 解決済み"]`
    : `  C --> UNRESOLVED["⚠️ 未解決"]`;

  return [
    "flowchart TB",
    `  C{${q("🔍 矛盾\\n" + c.description)}}`,
    `  S1["Step 1\\n胴体（コア）"] --> C`,
    `  S3["Step 3\\n両足（2本柱）"] --> C`,
    resolvedEdge,
  ].join("\n");
}

// ── Step 5 / Final: 合体ロボ図 ────────────────────────────────────

function buildFinal(parts: SessionParts): string {
  const { core, what_how, frame } = parts;
  const firstWhat = nonEmpty(what_how.what_items)[0] ?? "What";
  const firstHow  = nonEmpty(what_how.how_items)[0]  ?? "How";

  const header = frame.title
    ? `---\ntitle: ${sanitize(frame.title)}\n---\n`
    : "";

  const lines = [
    `${header}flowchart TB`,
    `  subgraph "🎯 頭（イントロ）"`,
    `    H[${q("フック:\\n" + frame.intro.hook)}]`,
    "  end",
    `  subgraph "🫀 胴体（コア）"`,
    `    R[${q("🔴 現実\\n" + core.reality)}] -->|"ギャップ"| ID[${q("🟢 理想\\n" + core.ideal)}]`,
    `    P[${q("💡 提案\\n" + core.proposal)}] --> ID`,
    "  end",
    `  subgraph "💪🛡️ 両腕（展開）"`,
    "    direction LR",
    `    W[${q("What:\\n" + firstWhat)}] --> HW[${q("How:\\n" + firstHow)}]`,
    "  end",
    `  subgraph "🗂️ 台座（クロージング）"`,
    `    CTA[${q("行動促進:\\n" + frame.closing.cta)}]`,
    "  end",
    "  頭（イントロ） --> 胴体（コア） --> 両腕（展開） --> 台座（クロージング）",
  ];

  return lines.join("\n");
}

// ── 公開 API ─────────────────────────────────────────────────────

/**
 * 指定ステップの Mermaid ソースを生成する（サーバーサイド唯一の実装）。
 * @param step  生成対象ステップ（"final" = 合体ロボ図）
 * @param session  現在のセッション状態
 */
export function buildDiagram(
  step: StepName | "final",
  session: LogiSession
): string {
  const { parts } = session;
  switch (step) {
    case "step1_core":      return buildStep1(parts);
    case "step2_drilldown": return buildStep2(parts);
    case "step3_what_how":  return buildStep3(parts);
    case "step4_verify":    return buildStep4(parts);
    case "step5_combine":
    case "final":           return buildFinal(parts);
    default:
      return `flowchart TB\n  A["（図なし: ${step})"]`;
  }
}

/**
 * バルク抽出後の仮組み図を一括生成する。
 * 抽出済みデータが存在するステップのみ生成する。
 */
export function buildBulkDiagrams(
  session: LogiSession
): Partial<Record<"step1" | "step2" | "step3" | "step4" | "step5", string>> {
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
