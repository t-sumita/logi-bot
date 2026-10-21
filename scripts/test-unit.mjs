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
import { buildRobotDiagram } from "../public/js/mermaid-builder.js";
import { buildDiagramMarkup } from "../public/js/html-diagram.js";
import { classifyNode, getNodeText, setNodeText, addDetail, removeDetail } from "../public/js/node-edit.js";
import { resolveOwnerLlm, DEFAULT_MODELS } from "../functions/_lib/ai-config.ts";

// ── resolveOwnerLlm（オーナーモードの環境変数解決）─────────────────

test("resolveOwnerLlm — 既定は gemini / gemini-3.8-flash（従来キー）", () => {
  const r = resolveOwnerLlm({ GEMINI_API_KEY: "g-key" });
  assert.deepEqual(r, { ok: true, provider: "gemini", model: "gemini-3.8-flash", apiKey: "g-key" });
});

test("resolveOwnerLlm — AI_API_KEY が従来キーより優先される", () => {
  const r = resolveOwnerLlm({ AI_API_KEY: "generic", GEMINI_API_KEY: "legacy" });
  assert.equal(r.ok && r.apiKey, "generic");
});

test("resolveOwnerLlm — AI_PROVIDER / AI_MODEL で切り替え（大文字・空白は無視）", () => {
  const r = resolveOwnerLlm({ AI_PROVIDER: " OpenAI ", AI_MODEL: "gpt-x", AI_API_KEY: "k" });
  assert.deepEqual(r, { ok: true, provider: "openai", model: "gpt-x", apiKey: "k" });
});

test("resolveOwnerLlm — AI_MODEL 未指定はプロバイダ別の既定モデル", () => {
  const r = resolveOwnerLlm({ AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "a" });
  assert.equal(r.ok && r.model, DEFAULT_MODELS.anthropic);
});

test("resolveOwnerLlm — プロバイダに対応しない従来キーは使わない", () => {
  const r = resolveOwnerLlm({ AI_PROVIDER: "openai", GEMINI_API_KEY: "g" });
  assert.equal(r.ok, false);
  assert.equal(r.message, "サーバーに OPENAI_API_KEY が設定されていません");
});

test("resolveOwnerLlm — キー未設定は server_misconfigured", () => {
  const r = resolveOwnerLlm({});
  assert.equal(r.ok, false);
  assert.equal(r.status, 500);
  assert.equal(r.code, "server_misconfigured");
  assert.equal(r.message, "サーバーに GEMINI_API_KEY が設定されていません");
});

test("resolveOwnerLlm — 不正な AI_PROVIDER はエラー", () => {
  const r = resolveOwnerLlm({ AI_PROVIDER: "foo", AI_API_KEY: "k" });
  assert.equal(r.ok, false);
  assert.match(r.message, /AI_PROVIDER が不正です: foo/);
});

// ── session.ts の純粋ロジックをインライン再現 ─────────────────────

function createSession(sessionId, title) {
  const now = new Date().toISOString();
  return {
    sessionId, title,
    step: "step1_core", status: "in_progress",
    fast_track: false,
    createdAt: now, updatedAt: now,
    parts: {
      core:         { reality: "", ideal: "", proposal: "" },
      drilldown:    { reality_factors: [], ideal_goals: [], gap_summary: "" },
      what_how:     { what_items: [], how_items: [], who_when: [] },
      verification: { contradictions: [], is_consistent: false },
      frame: {
        intro:   { audience: "", hook: "" },
        closing: { cta: "" },
        title:   "",
      },
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
  if (parts.drilldown.reality_factors.length < 1) missing.push("drilldown.reality_factors");
  if (parts.drilldown.ideal_goals.length < 1)     missing.push("drilldown.ideal_goals");
  return missing;
}
function guardStep3(parts) {
  const missing = [];
  if (parts.what_how.what_items.length < 1) missing.push("what_how.what_items");
  if (parts.what_how.how_items.length < 1)  missing.push("what_how.how_items");
  return missing;
}
function guardStep4(parts) {
  if (!parts.verification.is_consistent) return ["verification.is_consistent"];
  const unresolved = parts.verification.contradictions.filter((c) => !c.resolution.trim());
  if (unresolved.length > 0) return [`矛盾 ${unresolved.length} 件が未解決です`];
  return [];
}
function guardStep5(parts) {
  const missing = [];
  if (!parts.frame.intro.hook.trim())   missing.push("frame.intro.hook");
  if (!parts.frame.closing.cta.trim())  missing.push("frame.closing.cta");
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
        contradictions: e.verification?.contradictions?.length ? e.verification.contradictions : p.verification.contradictions,
        is_consistent:  e.verification?.is_consistent !== undefined ? e.verification.is_consistent : p.verification.is_consistent,
      },
      frame: {
        intro: {
          audience: e.frame?.intro?.audience?.trim() || p.frame.intro.audience,
          hook:     e.frame?.intro?.hook?.trim()     || p.frame.intro.hook,
        },
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

test("createSession — step1_core 状態で生成される", () => {
  const s = createSession("test-id", "テストセッション");
  assert.equal(s.step, "step1_core");
  assert.equal(s.status, "in_progress");
  assert.equal(s.fast_track, false);
  assert.deepEqual(s.diagrams, {});
  assert.deepEqual(s.history, []);
});

test("createSession — 正しい parts が生成される", () => {
  const s = createSession("test-id", "テスト");
  assert.deepEqual(s.parts.core, { reality: "", ideal: "", proposal: "" });
  assert.deepEqual(s.parts.drilldown, { reality_factors: [], ideal_goals: [], gap_summary: "" });
  assert.deepEqual(s.parts.what_how, { what_items: [], how_items: [], who_when: [] });
  assert.deepEqual(s.parts.verification, { contradictions: [], is_consistent: false });
  assert.deepEqual(s.parts.frame.intro, { audience: "", hook: "" });
  assert.deepEqual(s.parts.frame.closing, { cta: "" });
});

test("guardStep1 — 全て空の場合は3件の missing", () => {
  const s = createSession("x", "x");
  const missing = guardStep1(s.parts);
  assert.equal(missing.length, 3);
});

test("guardStep1 — reality のみ入力済みは2件の missing", () => {
  const s = createSession("x", "x");
  s.parts.core.reality = "現在の課題";
  assert.equal(guardStep1(s.parts).length, 2);
});

test("guardStep1 — 全て入力済みは通過", () => {
  const s = createSession("x", "x");
  s.parts.core.reality  = "現在の課題";
  s.parts.core.ideal    = "理想の状態";
  s.parts.core.proposal = "解決策";
  assert.equal(guardStep1(s.parts).length, 0);
});

test("guardStep2 — reality_factors と ideal_goals が空の場合は missing", () => {
  const s = createSession("x", "x");
  assert.ok(guardStep2(s.parts).length > 0);
});

test("guardStep2 — 両方1件以上あれば通過", () => {
  const s = createSession("x", "x");
  s.parts.drilldown.reality_factors = ["要因1"];
  s.parts.drilldown.ideal_goals     = ["目標1"];
  assert.equal(guardStep2(s.parts).length, 0);
});

test("guardStep3 — what_items と how_items が空の場合は missing", () => {
  const s = createSession("x", "x");
  assert.ok(guardStep3(s.parts).length > 0);
});

test("guardStep3 — 両方1件以上あれば通過", () => {
  const s = createSession("x", "x");
  s.parts.what_how.what_items = ["何を"];
  s.parts.what_how.how_items  = ["どうやって"];
  assert.equal(guardStep3(s.parts).length, 0);
});

test("guardStep4 — is_consistent が false の場合は missing", () => {
  const s = createSession("x", "x");
  assert.ok(guardStep4(s.parts).length > 0);
});

test("guardStep4 — is_consistent が true の場合は通過", () => {
  const s = createSession("x", "x");
  s.parts.verification.is_consistent = true;
  assert.equal(guardStep4(s.parts).length, 0);
});

test("guardStep5 — hook と cta が空の場合は missing", () => {
  const s = createSession("x", "x");
  assert.ok(guardStep5(s.parts).length > 0);
});

test("guardStep5 — 両方入力済みの場合は通過", () => {
  const s = createSession("x", "x");
  s.parts.frame.intro.hook   = "フック";
  s.parts.frame.closing.cta  = "行動促進";
  assert.equal(guardStep5(s.parts).length, 0);
});

test("firstIncompleteStep — 全て空の場合は step1_core", () => {
  const s = createSession("x", "x");
  assert.equal(firstIncompleteStep(s.parts), "step1_core");
});

test("firstIncompleteStep — step1 埋まっていると step2_drilldown", () => {
  const s = createSession("x", "x");
  s.parts.core.reality  = "現実";
  s.parts.core.ideal    = "理想";
  s.parts.core.proposal = "提案";
  assert.equal(firstIncompleteStep(s.parts), "step2_drilldown");
});

test("firstIncompleteStep — step1+2 埋まっていると step3_what_how", () => {
  const s = createSession("x", "x");
  s.parts.core.reality  = "現実";
  s.parts.core.ideal    = "理想";
  s.parts.core.proposal = "提案";
  s.parts.drilldown.reality_factors = ["要因1"];
  s.parts.drilldown.ideal_goals     = ["目標1"];
  assert.equal(firstIncompleteStep(s.parts), "step3_what_how");
});

test("firstIncompleteStep — step1+2+3 埋まっていると step4_verify", () => {
  const s = createSession("x", "x");
  s.parts.core.reality  = "現実";
  s.parts.core.ideal    = "理想";
  s.parts.core.proposal = "提案";
  s.parts.drilldown.reality_factors = ["要因1"];
  s.parts.drilldown.ideal_goals     = ["目標1"];
  s.parts.what_how.what_items = ["何を"];
  s.parts.what_how.how_items  = ["どうやって"];
  assert.equal(firstIncompleteStep(s.parts), "step4_verify");
});

test("firstIncompleteStep — step1+2+3+4 埋まっていると step5_combine", () => {
  const s = createSession("x", "x");
  s.parts.core.reality  = "現実";
  s.parts.core.ideal    = "理想";
  s.parts.core.proposal = "提案";
  s.parts.drilldown.reality_factors = ["要因1"];
  s.parts.drilldown.ideal_goals     = ["目標1"];
  s.parts.what_how.what_items = ["何を"];
  s.parts.what_how.how_items  = ["どうやって"];
  s.parts.verification.is_consistent = true;
  assert.equal(firstIncompleteStep(s.parts), "step5_combine");
});

test("firstIncompleteStep — 全て埋まっていると complete", () => {
  const s = createSession("x", "x");
  s.parts.core.reality  = "現実";
  s.parts.core.ideal    = "理想";
  s.parts.core.proposal = "提案";
  s.parts.drilldown.reality_factors = ["要因1"];
  s.parts.drilldown.ideal_goals     = ["目標1"];
  s.parts.what_how.what_items = ["何を"];
  s.parts.what_how.how_items  = ["どうやって"];
  s.parts.verification.is_consistent = true;
  s.parts.frame.intro.hook   = "フック";
  s.parts.frame.closing.cta  = "行動";
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

test("mergeExtracted — 配列は非空なら上書きする", () => {
  const s = createSession("x", "x");
  s.parts.drilldown.reality_factors = ["古い要因"];
  const merged = mergeExtracted(s, { drilldown: { reality_factors: ["新しい要因A", "新しい要因B"], ideal_goals: [], gap_summary: "" } });
  assert.deepEqual(merged.parts.drilldown.reality_factors, ["新しい要因A", "新しい要因B"]);
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

// ── テスト: import-parser（import-parser.js のロジックをインライン再現）─

function emptyParts() {
  return {
    core:         { reality: "", ideal: "", proposal: "" },
    drilldown:    { reality_factors: [], ideal_goals: [], gap_summary: "" },
    what_how:     { what_items: [], how_items: [], who_when: [] },
    verification: { contradictions: [], is_consistent: false },
    frame:        { intro: { audience: "", hook: "" }, closing: { cta: "" }, title: "" },
  };
}
function isStatusMdLike(text) {
  return (
    text.includes("セッション状態ファイル — logi-bot") ||
    (text.includes("## 確定事項") && /- \[\d/.test(text)) ||
    (text.includes("## AI案") && /- \[\d/.test(text))
  );
}
function isMdExportLike(text) {
  return text.includes("## Step 1: コア") || /\*\*\[1\] 現実\*\*:/.test(text);
}
function extractTitle(text) {
  const m1 = text.match(/>\s*\*\*タイトル\*\*:\s*(.+)/);
  if (m1) return m1[1].trim();
  const m2 = text.match(/^#\s+(?!セッション状態)(.+)/m);
  return m2 ? m2[1].trim() : "";
}
function assignNodesToParts(nodeMap, parts) {
  if (nodeMap.has("0")) parts.frame.intro.hook  = nodeMap.get("0");
  if (nodeMap.has("1")) parts.core.reality       = nodeMap.get("1");
  if (nodeMap.has("2")) parts.core.ideal         = nodeMap.get("2");
  if (nodeMap.has("3")) parts.core.proposal      = nodeMap.get("3");
  if (nodeMap.has("8")) parts.frame.closing.cta  = nodeMap.get("8");
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
function parseStatusMdInto(text, parts) {
  const nodeMap = new Map();
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*-\s*\[(\d+(?:-\d+)?)\]\s+(.+)/);
    if (!m) continue;
    if (!nodeMap.has(m[1])) nodeMap.set(m[1], m[2].trim());
  }
  assignNodesToParts(nodeMap, parts);
}
function isMermaidLike(text) {
  if (/```mermaid/.test(text)) return true;
  if (/\bflowchart\s+(TB|TD|BT|RL|LR)\b/.test(text)) return true;
  if (/\[\s*["[]?\s*\[\d+(?:-\d+)?\]/.test(text)) return true;
  return false;
}
function cleanMermaidValue(raw) {
  const segs = raw.split(/\\n/).map((s) => s.trim()).filter(Boolean);
  if (segs.some((s) => s === "（未入力）")) return "";
  const meaningful = segs.filter((s) => !/^（(AI案|未確認)）$/.test(s));
  if (meaningful.length === 0) return "";
  if (meaningful.length === 1) return meaningful[0];
  return meaningful.slice(1).join(" ").trim();
}
function parseMermaidInto(text, parts) {
  const nodeMap = new Map();
  const re = /\[(\d+(?:-\d+)?)\]\s*((?:\\n|[^"\]\n])*)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const id = m[1];
    if (nodeMap.has(id)) continue;
    const value = cleanMermaidValue(m[2]);
    if (value) nodeMap.set(id, value);
  }
  assignNodesToParts(nodeMap, parts);
  return nodeMap.size;
}
function parseMdExportInto(text, parts) {
  const pick = (re) => { const m = text.match(re); return m ? m[1].trim() : ""; };
  parts.core.reality      = pick(/\*\*\[1\][^*]*\*\*:\s*(.+)/);
  parts.core.ideal        = pick(/\*\*\[2\][^*]*\*\*:\s*(.+)/);
  parts.core.proposal     = pick(/\*\*\[3\][^*]*\*\*:\s*(.+)/);
  parts.frame.intro.hook  = pick(/\*\*\[0\][^*]*\*\*:\s*(.+)/);
  parts.frame.closing.cta = pick(/\*\*\[8\][^*]*\*\*:\s*(.+)/);
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
  for (const m of text.matchAll(/\|\s*\[[\d-]+\]\/\[[\d-]+\]\s*\|\s*([^|]+)\|\s*([^|]+)\|/g)) {
    const what = m[1].trim(); const how = m[2].trim();
    if (what) parts.what_how.what_items.push(what);
    if (how)  parts.what_how.how_items.push(how);
  }
}
function parseImportText(text) {
  const isStatus = isStatusMdLike(text);
  const isMdExport = !isStatus && isMdExportLike(text);
  if (isStatus || isMdExport) {
    const title = extractTitle(text) || "読み込んだセッション";
    const parts = emptyParts();
    if (isStatus) parseStatusMdInto(text, parts);
    else parseMdExportInto(text, parts);
    return { parts, title };
  }
  if (isMermaidLike(text)) {
    const parts = emptyParts();
    const count = parseMermaidInto(text, parts);
    if (count > 0) return { parts, title: extractTitle(text) || "インポートした図" };
  }
  return null;
}

const STATUS_MD_SAMPLE = `# セッション状態ファイル — logi-bot

> **タイトル**: テストプロジェクト
> **セッション ID**: \`abc123\`

## 確定事項

- [1] 現状の課題がある
- [2] 理想の状態がある
- [3] 解決策がある
- [4-1] 現実の詳細A
- [4-2] 現実の詳細B
- [5-1] 理想の詳細X
- [6-1] What1
- [7-1] How1
- [0] イントロフック
- [8] クロージングCTA
`;

const MD_EXPORT_SAMPLE = `# Markdownエクスポートテスト

## Step 1: コア（胸・腹）

- **[1] 現実**: md現実テキスト
- **[2] 理想**: md理想テキスト
- **[3] 提案**: md提案テキスト

## Step 2: ドリルダウン（両腕）

### [4-N] 現実の詳細（左腕）
- [4-1] md現実詳細1

### [5-N] 理想の詳細（右腕）
- [5-1] md理想詳細1

## Step 3: What / How（両脚）

| 番号 | What（何を）| How（どうやって）|
|---|---|---|
| [6-1]/[7-1] | mdWhat1 | mdHow1 |

## Step 5: 頭・台座

- **[0] イントロ（フック）**: mdフック
- **[8] クロージング CTA**: mdCTA
`;

test("parseImportText — 通常テキストは null を返す", () => {
  assert.equal(parseImportText("普通のメモです。箇条書きがあります。"), null);
  assert.equal(parseImportText(""), null);
});

test("parseImportText — STATUS.md 形式を検出する", () => {
  const result = parseImportText(STATUS_MD_SAMPLE);
  assert.ok(result !== null);
});

test("parseImportText — STATUS.md からタイトルを抽出する", () => {
  const result = parseImportText(STATUS_MD_SAMPLE);
  assert.equal(result.title, "テストプロジェクト");
});

test("parseImportText — STATUS.md から core parts を抽出する", () => {
  const result = parseImportText(STATUS_MD_SAMPLE);
  assert.equal(result.parts.core.reality,  "現状の課題がある");
  assert.equal(result.parts.core.ideal,    "理想の状態がある");
  assert.equal(result.parts.core.proposal, "解決策がある");
});

test("parseImportText — STATUS.md から配列ノードを抽出する", () => {
  const result = parseImportText(STATUS_MD_SAMPLE);
  assert.deepEqual(result.parts.drilldown.reality_factors, ["現実の詳細A", "現実の詳細B"]);
  assert.deepEqual(result.parts.drilldown.ideal_goals,     ["理想の詳細X"]);
  assert.deepEqual(result.parts.what_how.what_items,       ["What1"]);
  assert.deepEqual(result.parts.what_how.how_items,        ["How1"]);
});

test("parseImportText — STATUS.md から frame parts を抽出する", () => {
  const result = parseImportText(STATUS_MD_SAMPLE);
  assert.equal(result.parts.frame.intro.hook,   "イントロフック");
  assert.equal(result.parts.frame.closing.cta,  "クロージングCTA");
});

test("parseImportText — Markdown エクスポート形式を検出する", () => {
  const result = parseImportText(MD_EXPORT_SAMPLE);
  assert.ok(result !== null);
});

test("parseImportText — Markdown から core parts を抽出する", () => {
  const result = parseImportText(MD_EXPORT_SAMPLE);
  assert.equal(result.parts.core.reality,  "md現実テキスト");
  assert.equal(result.parts.core.ideal,    "md理想テキスト");
  assert.equal(result.parts.core.proposal, "md提案テキスト");
});

test("parseImportText — Markdown から drilldown を抽出する", () => {
  const result = parseImportText(MD_EXPORT_SAMPLE);
  assert.deepEqual(result.parts.drilldown.reality_factors, ["md現実詳細1"]);
  assert.deepEqual(result.parts.drilldown.ideal_goals,     ["md理想詳細1"]);
});

test("parseImportText — Markdown からテーブル行（What/How）を抽出する", () => {
  const result = parseImportText(MD_EXPORT_SAMPLE);
  assert.deepEqual(result.parts.what_how.what_items, ["mdWhat1"]);
  assert.deepEqual(result.parts.what_how.how_items,  ["mdHow1"]);
});

test("parseImportText — Markdown から frame parts を抽出する", () => {
  const result = parseImportText(MD_EXPORT_SAMPLE);
  assert.equal(result.parts.frame.intro.hook,  "mdフック");
  assert.equal(result.parts.frame.closing.cta, "mdCTA");
});

// ── テスト: Mermaid 逆インポート ─────────────────────────────────

// mermaid-builder のエクスポート出力に近い形式（ラベルは "見出し\n本文"）
const MERMAID_EXPORT_SAMPLE = `\`\`\`mermaid
flowchart TB
    INTRO["[0] 🧠 イントロ\\nメール処理に追われていませんか"]:::confirmed
    REAL["[1] 現実\\n大量のメールで見落とし発生"]:::confirmed
    IDEAL["[2] 理想\\n重要メールを5分で把握"]:::confirmed
    PROP["[3] 提案\\nAI要約通知システム"]:::confirmed
    nn4_1["[4-1] 現実詳細\\n1日120通受信"]:::confirmed
    nn5_1["[5-1] 理想詳細\\n見落としゼロ"]:::confirmed
    nn6_1["[6-1] What\\n自動フィルタ"]:::confirmed
    nn7_1["[7-1] How\\n開発2週間"]:::confirmed
    BASE["[8] 🗂️ 台座\\n今週テスト導入"]:::confirmed
\`\`\``;

// ユーザーが手書きした簡易形式（本文が [N] 直後に続く）
const MERMAID_SIMPLE_SAMPLE = `flowchart TB
    A["[1] 現実のテキスト"]
    B["[2] 理想のテキスト"]
    C[4-1] 左腕の詳細`;

test("parseImportText — Mermaid コードを検出する", () => {
  assert.ok(parseImportText(MERMAID_EXPORT_SAMPLE) !== null);
  assert.ok(parseImportText(MERMAID_SIMPLE_SAMPLE) !== null);
});

test("parseImportText — Mermaid から core parts（見出し\\n本文形式）を抽出する", () => {
  const r = parseImportText(MERMAID_EXPORT_SAMPLE);
  assert.equal(r.parts.core.reality,  "大量のメールで見落とし発生");
  assert.equal(r.parts.core.ideal,    "重要メールを5分で把握");
  assert.equal(r.parts.core.proposal, "AI要約通知システム");
});

test("parseImportText — Mermaid から frame parts を抽出する", () => {
  const r = parseImportText(MERMAID_EXPORT_SAMPLE);
  assert.equal(r.parts.frame.intro.hook,  "メール処理に追われていませんか");
  assert.equal(r.parts.frame.closing.cta, "今週テスト導入");
});

test("parseImportText — Mermaid から配列ノード（[N-M]）を抽出する", () => {
  const r = parseImportText(MERMAID_EXPORT_SAMPLE);
  assert.deepEqual(r.parts.drilldown.reality_factors, ["1日120通受信"]);
  assert.deepEqual(r.parts.drilldown.ideal_goals,     ["見落としゼロ"]);
  assert.deepEqual(r.parts.what_how.what_items,       ["自動フィルタ"]);
  assert.deepEqual(r.parts.what_how.how_items,        ["開発2週間"]);
});

test("parseImportText — Mermaid 簡易形式（[N] 直後に本文）を抽出する", () => {
  const r = parseImportText(MERMAID_SIMPLE_SAMPLE);
  assert.equal(r.parts.core.reality, "現実のテキスト");
  assert.equal(r.parts.core.ideal,   "理想のテキスト");
  assert.deepEqual(r.parts.drilldown.reality_factors, ["左腕の詳細"]);
});

test("cleanMermaidValue — （未入力）は空文字を返す", () => {
  assert.equal(cleanMermaidValue("現実\\n（未入力）"), "");
});

test("cleanMermaidValue — （AI案）/（未確認）マーカーは除去される", () => {
  assert.equal(cleanMermaidValue("現実\\n課題テキスト\\n（AI案）"), "課題テキスト");
  assert.equal(cleanMermaidValue("理想\\n目標テキスト\\n（未確認）"), "目標テキスト");
});

// ── テスト: 直接貼り付けインポートの動作保証（index-app.js のロジック再現）─

// index-app.js の deriveTitle と同一実装
function deriveTitle(text) {
  const firstLine = text.split("\n").map((l) => l.trim()).find((l) => l.length > 0) || "";
  const cleaned = firstLine.replace(/^[#\-*・>\s]+/, "").trim();
  return cleaned.slice(0, 40) || "読み込んだメモ";
}

test("deriveTitle — 先頭の非空行を採用する", () => {
  assert.equal(deriveTitle("\n\n新製品ローンチ計画\n詳細..."), "新製品ローンチ計画");
});

test("deriveTitle — 箇条書き・見出し記号を除去する", () => {
  assert.equal(deriveTitle("・現状：ツールが古い"), "現状：ツールが古い");
  assert.equal(deriveTitle("# 営業プロセス改善"), "営業プロセス改善");
  assert.equal(deriveTitle("- メモ一行目"), "メモ一行目");
});

test("deriveTitle — 空テキストはフォールバック", () => {
  assert.equal(deriveTitle("   \n  "), "読み込んだメモ");
});

test("直接貼り付け（STATUS.md）→ parseImportText が parts を返しセッション復元できる", () => {
  const r = parseImportText(STATUS_MD_SAMPLE);
  assert.ok(r !== null);
  assert.equal(r.parts.core.reality, "現状の課題がある");
});

test("直接貼り付け（通常メモ）→ parse は null でも deriveTitle で必ず遷移できる", () => {
  const memo = "現状：社内の情報共有ツールが古く、部門間の連携が非効率。\n理想：リアルタイム共有で意思決定を迅速化。";
  assert.equal(parseImportText(memo), null);          // ローカルパース対象外
  const title = deriveTitle(memo);                     // → API バルク抽出フローの仮タイトル
  assert.ok(title && title.length > 0, "仮タイトルが生成されない");
  assert.ok(title !== "読み込んだメモ", "先頭行からタイトルを取れていない");
});

// ── テスト: buildRobotDiagram — Mermaid 構文検証 ─────────────────

/** テスト用ダミーセッション生成 */
function makeSession(overrides = {}) {
  return {
    sessionId: "test-s",
    title: "テスト",
    step: "step1_core",
    status: "in_progress",
    nodeStatuses: {},
    parts: {
      core:         { reality: "", ideal: "", proposal: "" },
      drilldown:    { reality_factors: [], ideal_goals: [], gap_summary: "" },
      what_how:     { what_items: [], how_items: [], who_when: [] },
      verification: { contradictions: [], is_consistent: false },
      frame:        { intro: { audience: "", hook: "" }, closing: { cta: "" }, title: "" },
    },
    diagrams: {}, history: [],
    ...overrides,
  };
}

test("buildRobotDiagram — 空セッション時に flowchart TB で始まる", () => {
  const src = buildRobotDiagram(makeSession());
  assert.ok(src.startsWith("flowchart TB"), `先頭が flowchart TB でない: ${src.slice(0, 30)}`);
});

test("buildRobotDiagram — 空セッション時に必要なサブグラフ ID が全て含まれる", () => {
  const src = buildRobotDiagram(makeSession());
  for (const id of ["UPPER_BODY", "CORE", "LEFT_ARM", "RIGHT_ARM", "LEGS", "LEFT_LEG", "RIGHT_LEG"]) {
    assert.ok(src.includes(`subgraph ${id}`), `${id} が見つからない`);
  }
});

test("buildRobotDiagram — 空セッション時に主要ノード（INTRO/REAL/IDEAL/PROP/BASE）が含まれる", () => {
  const src = buildRobotDiagram(makeSession());
  for (const id of ["INTRO", "REAL", "IDEAL", "PROP", "BASE"]) {
    assert.ok(src.includes(`${id}[`), `ノード ${id} が見つからない`);
  }
});

test("buildRobotDiagram — 空セッション時に classDef 宣言が含まれる", () => {
  const src = buildRobotDiagram(makeSession());
  assert.ok(src.includes("classDef unset"), "classDef unset が見つからない");
  assert.ok(src.includes("classDef current"), "classDef current が見つからない");
  assert.ok(src.includes("classDef confirmed"), "classDef confirmed が見つからない");
});

test("buildRobotDiagram — 外枠サブグラフを非表示にする style 宣言が含まれる", () => {
  const src = buildRobotDiagram(makeSession());
  assert.ok(src.includes("style UPPER_BODY fill:none,stroke:none"), "UPPER_BODY style が見つからない");
  assert.ok(src.includes("style LEGS fill:none,stroke:none"), "LEGS style が見つからない");
});

test("buildRobotDiagram — core データが入力されるとノードラベルに反映される", () => {
  const session = makeSession({
    step: "step2_drilldown",
    parts: {
      core:         { reality: "課題テキスト", ideal: "理想テキスト", proposal: "提案テキスト" },
      drilldown:    { reality_factors: [], ideal_goals: [], gap_summary: "" },
      what_how:     { what_items: [], how_items: [], who_when: [] },
      verification: { contradictions: [], is_consistent: false },
      frame:        { intro: { audience: "", hook: "" }, closing: { cta: "" }, title: "" },
    },
  });
  const src = buildRobotDiagram(session);
  assert.ok(src.includes("課題テキスト"), "現実テキストがラベルに含まれない");
  assert.ok(src.includes("理想テキスト"), "理想テキストがラベルに含まれない");
  assert.ok(src.includes("提案テキスト"), "提案テキストがラベルに含まれない");
});

test("buildRobotDiagram — drilldown データが配列ノードとして展開される", () => {
  const session = makeSession({
    step: "step3_what_how",
    parts: {
      core:         { reality: "現実", ideal: "理想", proposal: "提案" },
      drilldown:    { reality_factors: ["要因A", "要因B"], ideal_goals: ["目標X"], gap_summary: "" },
      what_how:     { what_items: [], how_items: [], who_when: [] },
      verification: { contradictions: [], is_consistent: false },
      frame:        { intro: { audience: "", hook: "" }, closing: { cta: "" }, title: "" },
    },
  });
  const src = buildRobotDiagram(session);
  assert.ok(src.includes("nn4_1"), "[4-1] ノードが見つからない");
  assert.ok(src.includes("nn4_2"), "[4-2] ノードが見つからない");
  assert.ok(src.includes("nn5_1"), "[5-1] ノードが見つからない");
  assert.ok(src.includes("要因A"), "要因A がラベルに含まれない");
  assert.ok(src.includes("目標X"), "目標X がラベルに含まれない");
  // 縦直列接続が含まれる
  assert.ok(src.includes("nn4_1 --> nn4_2"), "腕ノードの縦直列接続が見つからない");
});

test("buildRobotDiagram — 全データ入力時（Step 5）に全ノードが値を持つ", () => {
  const session = makeSession({
    step: "complete",
    parts: {
      core:         { reality: "現実値", ideal: "理想値", proposal: "提案値" },
      drilldown:    { reality_factors: ["要因1"], ideal_goals: ["目標1"], gap_summary: "" },
      what_how:     { what_items: ["What1"], how_items: ["How1"], who_when: [] },
      verification: { contradictions: [], is_consistent: true },
      frame:        { intro: { audience: "", hook: "フック" }, closing: { cta: "CTA" }, title: "" },
    },
  });
  const src = buildRobotDiagram(session);
  // 全主要値が含まれる
  for (const v of ["現実値", "理想値", "提案値", "要因1", "目標1", "What1", "How1", "フック", "CTA"]) {
    assert.ok(src.includes(v), `値「${v}」がラベルに含まれない`);
  }
  // ノードラベル内にダブルクォートが露出しない（サニタイズ確認）
  const labelRegex = /\["([^"]*)"\]/g;
  for (const m of src.matchAll(labelRegex)) {
    assert.ok(!m[1].includes('"'), `ラベル内にエスケープされていない " が含まれる: ${m[0]}`);
  }
});

test("buildRobotDiagram — 特殊文字（\" [ ] { }）を含む入力が安全にサニタイズされる", () => {
  const session = makeSession({
    parts: {
      core:         { reality: '課題"テスト"[重要]{必須}', ideal: "理想", proposal: "提案" },
      drilldown:    { reality_factors: [], ideal_goals: [], gap_summary: "" },
      what_how:     { what_items: [], how_items: [], who_when: [] },
      verification: { contradictions: [], is_consistent: false },
      frame:        { intro: { audience: "", hook: "" }, closing: { cta: "" }, title: "" },
    },
  });
  const src = buildRobotDiagram(session);
  // ノードラベル境界を壊す " が残っていないことを確認
  // ["..."] 形式のラベル内に生の " がないこと
  const lines = src.split("\n").filter((l) => l.includes("REAL["));
  assert.ok(lines.length > 0, "REAL ノードが見つからない");
  const inner = lines[0].replace(/^.*REAL\["/, "").replace(/".*$/, "");
  assert.ok(!inner.includes('"'), `サニタイズ後もラベル内に " が残っている: ${lines[0]}`);
});

// ── テスト: buildDiagramMarkup — HTML 固定レイアウト ───────────────

/** テスト用 parts 生成 */
function makeParts(overrides = {}) {
  return {
    core:         { reality: "", ideal: "", proposal: "" },
    drilldown:    { reality_factors: [], ideal_goals: [], gap_summary: "" },
    what_how:     { what_items: [], how_items: [], who_when: [] },
    verification: { contradictions: [], is_consistent: false },
    frame:        { intro: { audience: "", hook: "" }, closing: { cta: "" }, title: "" },
    ...overrides,
  };
}

test("buildDiagramMarkup — T字胴体（上段 現実・理想 / 下段 提案）の構造を持つ", () => {
  const html = buildDiagramMarkup(makeParts());
  assert.ok(html.includes("rb-torso-top"), "rb-torso-top が無い");
  assert.ok(html.includes("rb-torso-bottom"), "rb-torso-bottom が無い");
  // 上段に現実[1]・理想[2]、下段に提案[3]
  const topIdx = html.indexOf("rb-torso-top");
  const bottomIdx = html.indexOf("rb-torso-bottom");
  assert.ok(html.indexOf('data-node="1"') > topIdx && html.indexOf('data-node="1"') < bottomIdx, "[1]現実が上段に無い");
  assert.ok(html.indexOf('data-node="2"') > topIdx && html.indexOf('data-node="2"') < bottomIdx, "[2]理想が上段に無い");
  assert.ok(html.indexOf('data-node="3"') > bottomIdx, "[3]提案が下段に無い");
});

test("buildDiagramMarkup — 腕の配列が複数ノードとして描画される", () => {
  const html = buildDiagramMarkup(makeParts({
    drilldown: { reality_factors: ["要因A", "要因B", "要因C"], ideal_goals: ["目標X", "目標Y"], gap_summary: "" },
  }));
  for (const id of ["4-1", "4-2", "4-3"]) assert.ok(html.includes(`data-node="${id}"`), `${id} が描画されない`);
  for (const id of ["5-1", "5-2"]) assert.ok(html.includes(`data-node="${id}"`), `${id} が描画されない`);
  for (const v of ["要因A", "要因B", "要因C", "目標X", "目標Y"]) assert.ok(html.includes(v), `値「${v}」が無い`);
});

test("buildDiagramMarkup — 足の配列が複数ノードとして描画される", () => {
  const html = buildDiagramMarkup(makeParts({
    what_how: { what_items: ["W1", "W2", "W3"], how_items: ["H1", "H2"], who_when: [] },
  }));
  for (const id of ["6-1", "6-2", "6-3", "7-1", "7-2"]) assert.ok(html.includes(`data-node="${id}"`), `${id} が描画されない`);
});

test("buildDiagramMarkup — 配列が空のときは薄い枠（プレースホルダー）を1つだけ出す", () => {
  const html = buildDiagramMarkup(makeParts());
  // グループ番号のプレースホルダー（is-empty）が 1 つずつ
  for (const g of ["4", "5", "6", "7"]) {
    // 足の見出し（rb-limb-parent）も data-node を持つため、ボックス（rb-box）だけを数える
    const re = new RegExp(`class="rb-box [^"]*" data-node="${g}"`, "g");
    assert.equal((html.match(re) || []).length, 1, `[${g}] のプレースホルダーが1つでない`);
  }
  assert.ok(html.includes("is-empty"), "is-empty クラスが無い");
});

test("buildDiagramMarkup — 空文字の詳細も添字どおりに描画される（追加直後のノードが見える）", () => {
  const p = makeParts();
  p.drilldown.reality_factors = ["A", "", "C"];
  const html = buildDiagramMarkup(p);
  for (const id of ["4-1", "4-2", "4-3"]) {
    assert.ok(html.includes(`data-node="${id}"`), `[${id}] が描画されていない`);
  }
});

test("buildDiagramMarkup — 足の見出しが親ノード（6/7）としてクリック対象になる", () => {
  const html = buildDiagramMarkup(makeParts());
  assert.ok(/rb-limb-parent" data-node="6"/.test(html), "[6] 見出しが無い");
  assert.ok(/rb-limb-parent" data-node="7"/.test(html), "[7] 見出しが無い");
});

// ── ノード編集ロジック（node-edit.js） ──────────────────────────

test("classifyNode — 親/グループ/詳細/単独ノードを判別する", () => {
  assert.equal(classifyNode("1").kind, "parent");
  assert.equal(classifyNode("2").group, "5");
  assert.equal(classifyNode("6").kind, "group");
  assert.deepEqual(classifyNode("7-3"), { kind: "detail", group: "7", index: 2 });
  assert.equal(classifyNode("3").kind, "leaf");
  assert.equal(classifyNode("9").kind, "unknown");
});

test("setNodeText / getNodeText — 単一値ノードと詳細ノードを更新できる", () => {
  const p = makeParts();
  p.drilldown.reality_factors = ["A", "B"];
  assert.ok(setNodeText(p, "1", "  新しい現実 "));
  assert.equal(getNodeText(p, "1"), "新しい現実");
  assert.ok(setNodeText(p, "4-2", "B2"));
  assert.deepEqual(p.drilldown.reality_factors, ["A", "B2"]);
  assert.ok(setNodeText(p, "0", "フック"));
  assert.equal(p.frame.intro.hook, "フック");
  assert.equal(setNodeText(p, "4-9", "x"), false, "範囲外は更新しない");
});

test("addDetail — 親ノード/グループから末尾に空の詳細を追加し新ノード番号を返す", () => {
  const p = makeParts();
  assert.equal(addDetail(p, "1"), "4-1");
  assert.equal(addDetail(p, "1"), "4-2");
  assert.equal(addDetail(p, "6"), "6-1");
  assert.equal(addDetail(p, "7"), "7-1");
  assert.deepEqual(p.drilldown.reality_factors, ["", ""]);
  assert.equal(addDetail(p, "3"), null, "提案は詳細を持てない");
  assert.equal(addDetail(p, "4-1"), null, "詳細ノードには追加できない");
});

test("removeDetail — 詳細のみ削除でき、後続は繰り上がる", () => {
  const p = makeParts();
  p.what_how.what_items = ["a", "b", "c"];
  assert.ok(removeDetail(p, "6-2"));
  assert.deepEqual(p.what_how.what_items, ["a", "c"]);
  assert.equal(removeDetail(p, "1"), false, "親ノードは削除不可");
  assert.equal(removeDetail(p, "6-5"), false, "範囲外は削除しない");
});

test("追加→描画: 追加した空ノードが DOM に出て、削除すると消える（データとDOMの同期）", () => {
  const p = makeParts();
  const id = addDetail(p, "2");
  assert.ok(buildDiagramMarkup(p).includes(`data-node="${id}"`));
  removeDetail(p, id);
  assert.ok(!buildDiagramMarkup(p).includes(`data-node="${id}"`));
});

console.log("\n✅ 全テスト完了");
