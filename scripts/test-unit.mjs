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
    step: "idle", status: "in_progress",
    fast_track: false, onboarding_complete: false,
    createdAt: now, updatedAt: now,
    parts: {
      core:         { reality: "", ideal: "", proposal: "" },
      drilldown:    { reality_factors: [], ideal_goals: [], gap_summary: "" },
      what_how:     { what_items: [], how_items: [], who_when: [] },
      verification: { contradictions: [], is_consistent: false },
      frame: { intro: { audience: "", hook: "" }, closing: { cta: "" }, title: "" },
    },
    diagrams: {},
    history: [],
  };
}

function guardStep1(parts) {
  const missing = [];
  if (!parts.core.reality.trim())  missing.push("core.reality");
  if (!parts.core.ideal.trim())    missing.push("core.ideal");
  if (!parts.core.proposal.trim()) missing.push("core.proposal");
  return missing;
}
function guardStep2(parts) {
  const missing = [];
  if (parts.drilldown.reality_factors.length < 1) missing.push("reality_factors");
  if (parts.drilldown.ideal_goals.length < 1)     missing.push("ideal_goals");
  return missing;
}
function guardStep3(parts) {
  const missing = [];
  if (parts.what_how.what_items.length < 1) missing.push("what_items");
  if (parts.what_how.how_items.length < 1)  missing.push("how_items");
  if (parts.what_how.what_items.length !== parts.what_how.how_items.length)
    missing.push("how_items (what と数が不一致)");
  return missing;
}
function guardStep4(parts) {
  if (!parts.verification.is_consistent) return ["is_consistent"];
  return parts.verification.contradictions.filter((c) => !c.resolution.trim())
    .map((_, i) => `contradictions[${i}].resolution`);
}
function guardStep5(parts) {
  const missing = [];
  if (!parts.frame.intro.hook.trim())   missing.push("intro.hook");
  if (!parts.frame.closing.cta.trim())  missing.push("closing.cta");
  return missing;
}

function firstIncompleteStep(parts) {
  if (guardStep1(parts).length > 0) return "step1_core";
  if (guardStep2(parts).length > 0) return "step2_drilldown";
  if (guardStep3(parts).length > 0) return "step3_what_how";
  if (guardStep4(parts).length > 0) return "step4_verify";
  if (guardStep5(parts).length > 0) return "step5_combine";
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
      core: {
        reality:  e.core?.reality?.trim()  || p.core.reality,
        ideal:    e.core?.ideal?.trim()    || p.core.ideal,
        proposal: e.core?.proposal?.trim() || p.core.proposal,
      },
      drilldown: {
        reality_factors: e.drilldown?.reality_factors?.length ? e.drilldown.reality_factors : p.drilldown.reality_factors,
        ideal_goals:     e.drilldown?.ideal_goals?.length     ? e.drilldown.ideal_goals     : p.drilldown.ideal_goals,
        gap_summary:     e.drilldown?.gap_summary?.trim()     || p.drilldown.gap_summary,
      },
      what_how: {
        what_items: e.what_how?.what_items?.length ? e.what_how.what_items : p.what_how.what_items,
        how_items:  e.what_how?.how_items?.length  ? e.what_how.how_items  : p.what_how.how_items,
        who_when:   e.what_how?.who_when?.length   ? e.what_how.who_when   : p.what_how.who_when,
      },
      verification: {
        contradictions: e.verification?.contradictions?.length
          ? e.verification.contradictions : p.verification.contradictions,
        is_consistent: e.verification?.is_consistent !== undefined
          ? e.verification.is_consistent : p.verification.is_consistent,
      },
      frame: {
        intro:   { audience: e.frame?.intro?.audience?.trim() || p.frame.intro.audience,
                   hook:     e.frame?.intro?.hook?.trim()     || p.frame.intro.hook },
        closing: { cta: e.frame?.closing?.cta?.trim() || p.frame.closing.cta },
        title:   e.frame?.title?.trim() || p.frame.title,
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

test("createSession — idle 状態で生成される", () => {
  const s = createSession("test-id", "テストセッション");
  assert.equal(s.step, "idle");
  assert.equal(s.status, "in_progress");
  assert.equal(s.fast_track, false);
  assert.equal(s.onboarding_complete, false);
  assert.deepEqual(s.diagrams, {});
  assert.deepEqual(s.history, []);
});

test("guardStep1 — 全フィールド空の場合は全て missing", () => {
  const s = createSession("x", "x");
  const missing = guardStep1(s.parts);
  assert.equal(missing.length, 3);
});

test("guardStep1 — 全フィールド入力済みの場合は通過", () => {
  const s = createSession("x", "x");
  s.parts.core.reality  = "現状の課題がある";
  s.parts.core.ideal    = "理想の状態がある";
  s.parts.core.proposal = "解決策がある";
  const missing = guardStep1(s.parts);
  assert.equal(missing.length, 0);
});

test("guardStep2 — reality_factors が空の場合は missing", () => {
  const s = createSession("x", "x");
  s.parts.drilldown.ideal_goals = ["成果1"];
  const missing = guardStep2(s.parts);
  assert.ok(missing.some((m) => m.includes("reality_factors")));
});

test("guardStep3 — what と how の数が不一致の場合は missing", () => {
  const s = createSession("x", "x");
  s.parts.what_how.what_items = ["W1", "W2"];
  s.parts.what_how.how_items  = ["H1"];
  const missing = guardStep3(s.parts);
  assert.ok(missing.some((m) => m.includes("不一致")));
});

test("guardStep3 — what/how が同数で揃っていれば通過", () => {
  const s = createSession("x", "x");
  s.parts.what_how.what_items = ["W1"];
  s.parts.what_how.how_items  = ["H1"];
  assert.equal(guardStep3(s.parts).length, 0);
});

test("guardStep4 — is_consistent = false の場合は missing", () => {
  const s = createSession("x", "x");
  assert.ok(guardStep4(s.parts).length > 0);
});

test("guardStep4 — contradictions に未解決があると missing", () => {
  const s = createSession("x", "x");
  s.parts.verification.is_consistent = true;
  s.parts.verification.contradictions = [
    { description: "矛盾A", location: "step1↔step2", resolution: "" },
  ];
  assert.ok(guardStep4(s.parts).length > 0);
});

test("guardStep5 — hook / cta が空の場合は missing", () => {
  const s = createSession("x", "x");
  assert.equal(guardStep5(s.parts).length, 2);
});

test("firstIncompleteStep — 全て空の場合は step1_core", () => {
  const s = createSession("x", "x");
  assert.equal(firstIncompleteStep(s.parts), "step1_core");
});

test("firstIncompleteStep — step1 埋まっていると step2_drilldown", () => {
  const s = createSession("x", "x");
  s.parts.core = { reality: "R", ideal: "I", proposal: "P" };
  assert.equal(firstIncompleteStep(s.parts), "step2_drilldown");
});

test("firstIncompleteStep — 全て埋まっていると complete", () => {
  const s = createSession("x", "x");
  s.parts.core = { reality: "R", ideal: "I", proposal: "P" };
  s.parts.drilldown = { reality_factors: ["f1"], ideal_goals: ["g1"], gap_summary: "gap" };
  s.parts.what_how  = { what_items: ["w1"], how_items: ["h1"], who_when: [] };
  s.parts.verification = { is_consistent: true, contradictions: [] };
  s.parts.frame = {
    intro:   { audience: "a", hook: "h" },
    closing: { cta: "c" },
    title:   "t",
  };
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
  s.parts.core.reality = "既存の現実";
  const merged = mergeExtracted(s, undefined);
  assert.equal(merged.parts.core.reality, "既存の現実");
});

test("mergeExtracted — 新しい値で既存フィールドを上書きする", () => {
  const s = createSession("x", "x");
  s.parts.core.reality = "古い現実";
  const merged = mergeExtracted(s, { core: { reality: "新しい現実", ideal: "", proposal: "" } });
  assert.equal(merged.parts.core.reality, "新しい現実");
});

test("mergeExtracted — 空文字列では上書きしない", () => {
  const s = createSession("x", "x");
  s.parts.core.reality = "保持すべき現実";
  const merged = mergeExtracted(s, { core: { reality: "", ideal: "", proposal: "" } });
  assert.equal(merged.parts.core.reality, "保持すべき現実");
});

test("mergeExtracted — 配列は空配列では上書きしない", () => {
  const s = createSession("x", "x");
  s.parts.drilldown.reality_factors = ["既存の要因"];
  const merged = mergeExtracted(s, { drilldown: { reality_factors: [], ideal_goals: [], gap_summary: "" } });
  assert.deepEqual(merged.parts.drilldown.reality_factors, ["既存の要因"]);
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
  // クォートされているので Mermaid の shape 構文と衝突しない
  assert.ok(result.startsWith('"'));
  assert.ok(result.endsWith('"'));
  // ダブルクォートが含まれていないこと（ラベル境界が破損しない）
  const inner = result.slice(1, -1);
  assert.ok(!inner.includes('"'));
});

// ── テスト: firstIncompleteStep の境界ケース ─────────────────────

test("firstIncompleteStep — step3 のみ不足の場合は step3_what_how", () => {
  const s = createSession("x", "x");
  s.parts.core = { reality: "R", ideal: "I", proposal: "P" };
  s.parts.drilldown = { reality_factors: ["f1"], ideal_goals: ["g1"], gap_summary: "" };
  // what_how は空のまま
  assert.equal(firstIncompleteStep(s.parts), "step3_what_how");
});

test("firstIncompleteStep — verification 未設定の場合は step4_verify", () => {
  const s = createSession("x", "x");
  s.parts.core = { reality: "R", ideal: "I", proposal: "P" };
  s.parts.drilldown = { reality_factors: ["f1"], ideal_goals: ["g1"], gap_summary: "" };
  s.parts.what_how  = { what_items: ["w1"], how_items: ["h1"], who_when: [] };
  // verification は初期値（is_consistent: false）
  assert.equal(firstIncompleteStep(s.parts), "step4_verify");
});

console.log("\n✅ 全テスト完了");
