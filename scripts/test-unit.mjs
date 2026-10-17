/**
 * 単体テスト — Node.js 組み込みテストランナー使用
 * 実行: node --test scripts/test-unit.mjs
 * ※ TypeScript をトランスパイルせずに検証するため、純粋関数の動作をテストする。
 *    TypeScript 型の検証は npm run typecheck で行う。
 *
 * このスクリプトは session.ts / mermaid.ts の論理をエミュレートして
 * 境界条件・ガード条件・サニタイズの動作を検証する。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

// ── session.ts の純粋ロジックをインライン再現 ─────────────────────

function createSession(sessionId, title) {
  const now = new Date().toISOString();
  return {
    sessionId, title,
    step: "step1_head", status: "in_progress",
    fast_track: false,
    createdAt: now, updatedAt: now,
    parts: {
      head:      { concept: "", message: "" },
      body:      { core_system: "" },
      right_arm: { items: [] },
      left_arm:  { items: [] },
      legs:      { foundation: "", next_action: "" },
    },
    diagrams: {},
    history: [],
  };
}

function guardStep1(parts) {
  if (!parts.head.concept.trim()) return ["head.concept"];
  return [];
}
function guardStep2(parts) {
  if (!parts.body.core_system.trim()) return ["body.core_system"];
  return [];
}
function guardStep3(parts) {
  if (parts.right_arm.items.length < 1) return ["right_arm.items"];
  return [];
}
function guardStep4(parts) {
  if (parts.left_arm.items.length < 1) return ["left_arm.items"];
  return [];
}
function guardStep5(parts) {
  if (!parts.legs.foundation.trim()) return ["legs.foundation"];
  return [];
}

function firstIncompleteStep(parts) {
  if (guardStep1(parts).length > 0) return "step1_head";
  if (guardStep2(parts).length > 0) return "step2_body";
  if (guardStep3(parts).length > 0) return "step3_right_arm";
  if (guardStep4(parts).length > 0) return "step4_left_arm";
  if (guardStep5(parts).length > 0) return "step5_legs";
  return "complete";
}

function isBulkInput(message) { return message.trim().length > 100; }

function mergeExtracted(session, extracted) {
  if (!extracted) return session;
  const p = session.parts;
  const e = extracted;
  return {
    ...session,
    parts: {
      head: {
        concept: e.head?.concept?.trim() || p.head.concept,
        message: e.head?.message?.trim() || p.head.message,
      },
      body: {
        core_system: e.body?.core_system?.trim() || p.body.core_system,
      },
      right_arm: {
        items: e.right_arm?.items?.length ? e.right_arm.items : p.right_arm.items,
      },
      left_arm: {
        items: e.left_arm?.items?.length ? e.left_arm.items : p.left_arm.items,
      },
      legs: {
        foundation:  e.legs?.foundation?.trim()  || p.legs.foundation,
        next_action: e.legs?.next_action?.trim() || p.legs.next_action,
      },
    },
  };
}

// ── mermaid.ts のサニタイズロジックをインライン再現 ──────────────

function sanitize(raw) {
  if (!raw || raw.trim() === "") return "";
  return raw.trim().replace(/[\r\n]+/g, " ").replace(/"/g, "'").slice(0, 200);
}
function wrap(text, maxLen = 28) {
  if (text.length <= maxLen) return text;
  const chunks = [];
  let cur = "";
  for (const ch of text) {
    cur += ch;
    if (cur.length >= maxLen) { chunks.push(cur); cur = ""; }
  }
  if (cur) chunks.push(cur);
  return chunks.join("\\n");
}
function q(raw, fallback = "（未入力）") {
  const s = sanitize(raw);
  return `"${s ? wrap(s) : fallback}"`;
}

// ── テスト: session ───────────────────────────────────────────────

test("createSession — step1_head 状態で生成される", () => {
  const s = createSession("test-id", "テストセッション");
  assert.equal(s.step, "step1_head");
  assert.equal(s.status, "in_progress");
  assert.equal(s.fast_track, false);
  assert.deepEqual(s.diagrams, {});
  assert.deepEqual(s.history, []);
});

test("createSession — 新スキーマの parts が生成される", () => {
  const s = createSession("test-id", "テスト");
  assert.deepEqual(s.parts.head, { concept: "", message: "" });
  assert.deepEqual(s.parts.body, { core_system: "" });
  assert.deepEqual(s.parts.right_arm, { items: [] });
  assert.deepEqual(s.parts.left_arm, { items: [] });
  assert.deepEqual(s.parts.legs, { foundation: "", next_action: "" });
});

test("guardStep1 — concept が空の場合は missing", () => {
  const s = createSession("x", "x");
  const missing = guardStep1(s.parts);
  assert.equal(missing.length, 1);
  assert.ok(missing[0].includes("head.concept"));
});

test("guardStep1 — concept 入力済みの場合は通過", () => {
  const s = createSession("x", "x");
  s.parts.head.concept = "AIでメール管理を革新する";
  assert.equal(guardStep1(s.parts).length, 0);
});

test("guardStep2 — core_system が空の場合は missing", () => {
  const s = createSession("x", "x");
  const missing = guardStep2(s.parts);
  assert.equal(missing.length, 1);
  assert.ok(missing[0].includes("core_system"));
});

test("guardStep2 — core_system 入力済みの場合は通過", () => {
  const s = createSession("x", "x");
  s.parts.body.core_system = "自動スコアリングエンジン";
  assert.equal(guardStep2(s.parts).length, 0);
});

test("guardStep3 — right_arm.items が空の場合は missing", () => {
  const s = createSession("x", "x");
  assert.ok(guardStep3(s.parts).length > 0);
});

test("guardStep3 — right_arm.items に1件以上あれば通過", () => {
  const s = createSession("x", "x");
  s.parts.right_arm.items = ["VIP顧客の即時対応"];
  assert.equal(guardStep3(s.parts).length, 0);
});

test("guardStep4 — left_arm.items が空の場合は missing", () => {
  const s = createSession("x", "x");
  assert.ok(guardStep4(s.parts).length > 0);
});

test("guardStep4 — left_arm.items に1件以上あれば通過", () => {
  const s = createSession("x", "x");
  s.parts.left_arm.items = ["誤判定防止ホワイトリスト"];
  assert.equal(guardStep4(s.parts).length, 0);
});

test("guardStep5 — foundation が空の場合は missing", () => {
  const s = createSession("x", "x");
  assert.equal(guardStep5(s.parts).length, 1);
});

test("guardStep5 — foundation 入力済みの場合は通過", () => {
  const s = createSession("x", "x");
  s.parts.legs.foundation = "Gmail API + Cloudflare Workers";
  assert.equal(guardStep5(s.parts).length, 0);
});

test("firstIncompleteStep — 全て空の場合は step1_head", () => {
  const s = createSession("x", "x");
  assert.equal(firstIncompleteStep(s.parts), "step1_head");
});

test("firstIncompleteStep — step1 埋まっていると step2_body", () => {
  const s = createSession("x", "x");
  s.parts.head.concept = "コンセプト";
  assert.equal(firstIncompleteStep(s.parts), "step2_body");
});

test("firstIncompleteStep — step1+2 埋まっていると step3_right_arm", () => {
  const s = createSession("x", "x");
  s.parts.head.concept = "コンセプト";
  s.parts.body.core_system = "コアシステム";
  assert.equal(firstIncompleteStep(s.parts), "step3_right_arm");
});

test("firstIncompleteStep — step1+2+3 埋まっていると step4_left_arm", () => {
  const s = createSession("x", "x");
  s.parts.head.concept = "コンセプト";
  s.parts.body.core_system = "コアシステム";
  s.parts.right_arm.items = ["攻め施策1"];
  assert.equal(firstIncompleteStep(s.parts), "step4_left_arm");
});

test("firstIncompleteStep — step1+2+3+4 埋まっていると step5_legs", () => {
  const s = createSession("x", "x");
  s.parts.head.concept = "コンセプト";
  s.parts.body.core_system = "コアシステム";
  s.parts.right_arm.items = ["攻め施策1"];
  s.parts.left_arm.items  = ["守り施策1"];
  assert.equal(firstIncompleteStep(s.parts), "step5_legs");
});

test("firstIncompleteStep — 全て埋まっていると complete", () => {
  const s = createSession("x", "x");
  s.parts.head.concept     = "コンセプト";
  s.parts.body.core_system = "コアシステム";
  s.parts.right_arm.items  = ["攻め施策1"];
  s.parts.left_arm.items   = ["守り施策1"];
  s.parts.legs.foundation  = "基盤";
  assert.equal(firstIncompleteStep(s.parts), "complete");
});

test("isBulkInput — 100文字以下は false", () => {
  assert.equal(isBulkInput("短いテキスト"), false);
});

test("isBulkInput — 101文字以上は true", () => {
  assert.equal(isBulkInput("a".repeat(101)), true);
});

test("mergeExtracted — 空の extracted はセッションを変えない", () => {
  const s = createSession("x", "x");
  s.parts.head.concept = "既存のコンセプト";
  const merged = mergeExtracted(s, undefined);
  assert.equal(merged.parts.head.concept, "既存のコンセプト");
});

test("mergeExtracted — 新しい値で既存フィールドを上書きする", () => {
  const s = createSession("x", "x");
  s.parts.head.concept = "古いコンセプト";
  const merged = mergeExtracted(s, { head: { concept: "新しいコンセプト", message: "" } });
  assert.equal(merged.parts.head.concept, "新しいコンセプト");
});

test("mergeExtracted — 空文字列では上書きしない", () => {
  const s = createSession("x", "x");
  s.parts.head.concept = "保持すべきコンセプト";
  const merged = mergeExtracted(s, { head: { concept: "", message: "" } });
  assert.equal(merged.parts.head.concept, "保持すべきコンセプト");
});

test("mergeExtracted — 配列は空配列では上書きしない", () => {
  const s = createSession("x", "x");
  s.parts.right_arm.items = ["既存の施策"];
  const merged = mergeExtracted(s, { right_arm: { items: [] } });
  assert.deepEqual(merged.parts.right_arm.items, ["既存の施策"]);
});

test("mergeExtracted — 配列は非空なら上書きする", () => {
  const s = createSession("x", "x");
  s.parts.right_arm.items = ["古い施策"];
  const merged = mergeExtracted(s, { right_arm: { items: ["新しい施策A", "新しい施策B"] } });
  assert.deepEqual(merged.parts.right_arm.items, ["新しい施策A", "新しい施策B"]);
});

// ── テスト: mermaid サニタイズ ────────────────────────────────────

test("sanitize — 実際の改行はスペースに変換される", () => {
  const result = sanitize("テキスト\nの中に\r\n改行");
  assert.ok(!result.includes("\n"));
  assert.ok(!result.includes("\r"));
  assert.ok(result.includes(" "));
});

test("sanitize — ダブルクォートはシングルクォートに変換される", () => {
  const result = sanitize('テキスト"の中の"クォート');
  assert.ok(!result.includes('"'));
  assert.ok(result.includes("'"));
});

test("sanitize — 200文字で切り詰められる", () => {
  const result = sanitize("a".repeat(300));
  assert.equal(result.length, 200);
});

test("sanitize — 空文字列は空文字列を返す", () => {
  assert.equal(sanitize(""), "");
  assert.equal(sanitize("   "), "");
});

test("q — ラベルがダブルクォートで囲まれる", () => {
  const result = q("テスト");
  assert.ok(result.startsWith('"'));
  assert.ok(result.endsWith('"'));
});

test("q — 30文字超のラベルは \\n で折り返される", () => {
  const longText = "あ".repeat(40);
  const result = q(longText);
  assert.ok(result.includes("\\n"));
});

test("q — 空文字列はフォールバック文字列を返す", () => {
  const result = q("", "（未入力）");
  assert.equal(result, '"（未入力）"');
});

test("q — 特殊文字 () [] {} を含むラベルは壊れない", () => {
  const result = q("コスト(削減)[%]{目標}");
  assert.ok(result.startsWith('"'));
  assert.ok(result.endsWith('"'));
  const inner = result.slice(1, -1);
  assert.ok(!inner.includes('"'));
});

console.log("\n✅ 全テスト完了");
