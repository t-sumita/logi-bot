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

// ── Step 1: 頭（ヘッド）図 ────────────────────────────────────────

function buildStep1Head(parts: SessionParts): string {
  const { concept, message } = parts.head;
  return [
    "flowchart TB",
    `  H["🧠 ① 頭（ヘッド）\\nコンセプト・結論"]`,
    `  C[${q("コンセプト:\\n" + concept)}]`,
    `  M[${q("メッセージ:\\n" + message)}]`,
    `  H --> C`,
    `  H --> M`,
  ].join("\n");
}

// ── Step 2: 胴体（ボディ）図 ──────────────────────────────────────

function buildStep2Body(parts: SessionParts): string {
  const { core_system } = parts.body;
  return [
    "flowchart TB",
    `  H["🧠 ① 頭\\n${label(parts.head.concept || "コンセプト")}"]`,
    `  B["🫀 ② 胴体（ボディ）\\n${label(core_system)}"]`,
    `  H --> B`,
  ].join("\n");
}

// ── Step 3: 右腕（ライトアーム）図 ──────────────────────────────────

function buildStep3RightArm(parts: SessionParts): string {
  const items = nonEmpty(parts.right_arm.items, 3);
  const itemNodes = items.length > 0
    ? items.map((item, i) => `  RA${i}[${q(item)}]`).join("\n")
    : `  RA0["（未入力）"]`;
  const itemEdges = items.length > 0
    ? items.map((_, i) => `  RA --> RA${i}`).join("\n")
    : `  RA --> RA0`;

  return [
    "flowchart TD",
    `  B["🫀 ② 胴体\\n${label(parts.body.core_system || "コアシステム")}"]`,
    `  RA["💪 ③ 右腕（攻め）"]`,
    itemNodes,
    `  B --> RA`,
    itemEdges,
  ].join("\n");
}

// ── Step 4: 左腕（レフトアーム）図 ──────────────────────────────────

function buildStep4LeftArm(parts: SessionParts): string {
  const rightItems = nonEmpty(parts.right_arm.items, 3);
  const leftItems  = nonEmpty(parts.left_arm.items, 3);

  const raNodes = rightItems.length > 0
    ? rightItems.map((item, i) => `  RA${i}[${q(item)}]`).join("\n")
    : `  RA0["（未入力）"]`;
  const laNodes = leftItems.length > 0
    ? leftItems.map((item, i) => `  LA${i}[${q(item)}]`).join("\n")
    : `  LA0["（未入力）"]`;
  const raEdges = rightItems.length > 0
    ? rightItems.map((_, i) => `  RA --> RA${i}`).join("\n")
    : `  RA --> RA0`;
  const laEdges = leftItems.length > 0
    ? leftItems.map((_, i) => `  LA --> LA${i}`).join("\n")
    : `  LA --> LA0`;

  return [
    "flowchart TD",
    `  B["🫀 ② 胴体\\n${label(parts.body.core_system || "コアシステム")}"]`,
    `  RA["💪 ③ 右腕（攻め）"]`,
    `  LA["🛡️ ④ 左腕（守り）"]`,
    raNodes,
    laNodes,
    `  B --> RA & LA`,
    raEdges,
    laEdges,
  ].join("\n");
}

// ── Final: 合体ロボ図 ─────────────────────────────────────────────

function buildFinal(parts: SessionParts): string {
  const { head, body, right_arm, left_arm, legs } = parts;
  const rightItems = nonEmpty(right_arm.items, 3);
  const leftItems  = nonEmpty(left_arm.items, 3);

  const raLines = rightItems.length > 0
    ? rightItems.map((item, i) => `  RA${i}[${q(item)}]`).join("\n")
    : `  RA0["（未入力）"]`;
  const laLines = leftItems.length > 0
    ? leftItems.map((item, i) => `  LA${i}[${q(item)}]`).join("\n")
    : `  LA0["（未入力）"]`;
  const raEdges = rightItems.length > 0
    ? rightItems.map((_, i) => `  RA --> RA${i}`).join("\n")
    : `  RA --> RA0`;
  const laEdges = leftItems.length > 0
    ? leftItems.map((_, i) => `  LA --> LA${i}`).join("\n")
    : `  LA --> LA0`;

  return [
    "flowchart TD",
    `  H["🧠 ① 頭\\n${label(head.concept)}"]`,
    `  B["🫀 ② 胴体\\n${label(body.core_system)}"]`,
    `  RA["💪 ③ 右腕（攻め）"]`,
    `  LA["🛡️ ④ 左腕（守り）"]`,
    `  FL["🦿 ⑤ 左足\\n${label(legs.foundation)}"]`,
    `  FR["🦿 ⑤ 右足\\n${label(legs.next_action || "ネクストアクション")}"]`,
    raLines,
    laLines,
    `  H --> B`,
    `  B --> RA & LA`,
    raEdges,
    laEdges,
    `  RA --> FL`,
    `  LA --> FR`,
  ].join("\n");
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
    case "step1_head":      return buildStep1Head(parts);
    case "step2_body":      return buildStep2Body(parts);
    case "step3_right_arm": return buildStep3RightArm(parts);
    case "step4_left_arm":  return buildStep4LeftArm(parts);
    case "step5_legs":
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

  if (parts.head.concept || parts.head.message)
    result.step1 = buildStep1Head(parts);
  if (parts.body.core_system)
    result.step2 = buildStep2Body(parts);
  if (parts.right_arm.items.length > 0)
    result.step3 = buildStep3RightArm(parts);
  if (parts.left_arm.items.length > 0)
    result.step4 = buildStep4LeftArm(parts);
  if (parts.legs.foundation || parts.legs.next_action)
    result.step5 = buildFinal(parts);

  return result;
}
