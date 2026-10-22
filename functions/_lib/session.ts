// ステートマシン: セッションの状態遷移・ガード判定・初期化

import type {
  LogiSession,
  SessionEvent,
  SessionParts,
  StepName,
} from "./types.js";

// ── ガード未達フィールドのユーザー向け文言 ────────────────────────

/** ガードが返す未達フィールドの内部識別子 */
export type GuardField =
  | "core.reality"
  | "core.ideal"
  | "core.proposal"
  | "drilldown.reality_factors"
  | "drilldown.ideal_goals"
  | "what_how.what_items"
  | "what_how.how_items"
  | "verification.is_consistent"
  | "verification.contradictions"
  | "frame.intro.hook"
  | "frame.closing.cta";

/**
 * 内部識別子 → ユーザーが次に取るべき行動が分かる文言。
 * 変数名・プロパティ名は一切含めない（UI にそのまま表示するため）。
 */
const GUARD_MESSAGES: Record<GuardField, string> = {
  "core.reality":
    "[1] 現実（いま起きている課題）がまだ埋まっていません。チャットで現状の困りごとを教えてください。",
  "core.ideal":
    "[2] 理想（目指したい状態）がまだ埋まっていません。チャットでゴールを教えてください。",
  "core.proposal":
    "[3] 提案（解決策の核）がまだ埋まっていません。チャットでギャップを埋める方法を教えてください。",
  "drilldown.reality_factors":
    "[4] 現実の詳細（左腕）が 1 つも埋まっていません。チャットで課題の原因や具体的な数値を教えてください。",
  "drilldown.ideal_goals":
    "[5] 理想の詳細（右腕）が 1 つも埋まっていません。チャットで達成したい成果や数値目標を教えてください。",
  "what_how.what_items":
    "[6] What（何をするか）が 1 つも埋まっていません。チャットで具体的な施策を教えてください。",
  "what_how.how_items":
    "[7] How（どう実現するか）が 1 つも埋まっていません。チャットで体制・予算・時期を教えてください。",
  "verification.is_consistent":
    "全体の整合性チェックがまだ完了していません。チャットで「問題なし」と伝えるか、気になる修正点を教えてください。",
  "verification.contradictions":
    "点検で見つかった矛盾がまだ解消されていません。チャットでどう解決するかを教えてください。",
  "frame.intro.hook":
    "[0] イントロ（冒頭のフック）がまだ埋まっていません。チャットで聞き手を引き込む一文を教えてください。",
  "frame.closing.cta":
    "[8] クロージング（次の行動の呼びかけ）がまだ埋まっていません。チャットで締めの一文を教えてください。",
};

/**
 * 未達フィールドの識別子をユーザー向け文言に変換する。
 * 未知の識別子はそのまま返す（内部名を UI に出さないため、識別子は必ず登録しておくこと）。
 */
export function describeMissingField(field: string): string {
  return GUARD_MESSAGES[field as GuardField] ?? field;
}

/** 未達フィールドの配列をまとめてユーザー向け文言に変換する。 */
export function describeMissingFields(fields: string[]): string[] {
  return fields.map(describeMissingField);
}

// ── 初期セッション生成 ────────────────────────────────────────────

export function createSession(sessionId: string, title: string): LogiSession {
  const now = new Date().toISOString();
  return {
    sessionId,
    title,
    step: "step1_core",
    status: "in_progress",
    fast_track: false,
    createdAt: now,
    updatedAt: now,
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
    nodeStatuses: {},
  };
}

// ── ガード条件 ─────────────────────────────────────────────────────

// ガードは内部識別子（GuardField）だけを返す。
// UI に出す文言への変換は guard-messages.ts が担当する（変数名を画面に露出させないため）。

function guardStep1(parts: SessionParts): GuardField[] {
  const missing: GuardField[] = [];
  if (!parts.core.reality.trim())  missing.push("core.reality");
  if (!parts.core.ideal.trim())    missing.push("core.ideal");
  if (!parts.core.proposal.trim()) missing.push("core.proposal");
  return missing;
}

function guardStep2(parts: SessionParts): GuardField[] {
  const missing: GuardField[] = [];
  if (parts.drilldown.reality_factors.length < 1)
    missing.push("drilldown.reality_factors");
  if (parts.drilldown.ideal_goals.length < 1)
    missing.push("drilldown.ideal_goals");
  return missing;
}

function guardStep3(parts: SessionParts): GuardField[] {
  const missing: GuardField[] = [];
  if (parts.what_how.what_items.length < 1)
    missing.push("what_how.what_items");
  if (parts.what_how.how_items.length < 1)
    missing.push("what_how.how_items");
  return missing;
}

function guardStep4(parts: SessionParts): GuardField[] {
  if (!parts.verification.is_consistent)
    return ["verification.is_consistent"];
  const unresolved = parts.verification.contradictions.filter(
    (c) => !c.resolution.trim()
  );
  if (unresolved.length > 0)
    return ["verification.contradictions"];
  return [];
}

function guardStep5(parts: SessionParts): GuardField[] {
  const missing: GuardField[] = [];
  if (!parts.frame.intro.hook.trim())   missing.push("frame.intro.hook");
  if (!parts.frame.closing.cta.trim())  missing.push("frame.closing.cta");
  return missing;
}

/**
 * 現在のステップを抜けられるかを判定する。
 * missing はユーザー向けに変換済みの文言を返す（内部識別子は露出させない）。
 */
export function checkGuard(
  step: StepName,
  parts: SessionParts
): { ok: true } | { ok: false; missing: string[] } {
  let missing: GuardField[] = [];
  switch (step) {
    case "step1_core":      missing = guardStep1(parts); break;
    case "step2_drilldown": missing = guardStep2(parts); break;
    case "step3_what_how":  missing = guardStep3(parts); break;
    case "step4_verify":    missing = guardStep4(parts); break;
    case "step5_combine":   missing = guardStep5(parts); break;
    default:                return { ok: true };
  }
  return missing.length === 0
    ? { ok: true }
    : { ok: false, missing: describeMissingFields(missing) };
}

// ── ファストトラック: 最初の不足ステップを計算 ────────────────────

export function firstIncompleteStep(parts: SessionParts): StepName {
  if (guardStep1(parts).length > 0) return "step1_core";
  if (guardStep2(parts).length > 0) return "step2_drilldown";
  if (guardStep3(parts).length > 0) return "step3_what_how";
  if (guardStep4(parts).length > 0) return "step4_verify";
  if (guardStep5(parts).length > 0) return "step5_combine";
  return "complete";
}

// ── ステップ順序 ───────────────────────────────────────────────────

const STEP_ORDER: StepName[] = [
  "step1_core",
  "step2_drilldown",
  "step3_what_how",
  "step4_verify",
  "step5_combine",
  "complete",
];

function prevStep(step: StepName): StepName | null {
  const idx = STEP_ORDER.indexOf(step);
  // step1_core には戻れない
  if (idx <= 0) return null;
  return STEP_ORDER[idx - 1];
}

function nextStep(step: StepName): StepName | null {
  const idx = STEP_ORDER.indexOf(step);
  if (idx < 0 || idx >= STEP_ORDER.length - 1) return null;
  return STEP_ORDER[idx + 1];
}

// ── 状態遷移 ──────────────────────────────────────────────────────

export type TransitionResult =
  | { ok: true; session: LogiSession; diagram_needed?: StepName }
  | { ok: false; error: string; missing_fields: string[] };

export function transition(
  session: LogiSession,
  event: SessionEvent
): TransitionResult {
  const s = { ...session, updatedAt: new Date().toISOString() };

  switch (event) {
    case "RESET":
      return {
        ok: true,
        session: createSession(s.sessionId, s.title),
      };

    case "NEXT": {
      const guard = checkGuard(s.step, s.parts);
      if (!guard.ok) {
        return {
          ok: false,
          error: `必須フィールドが未入力です: ${guard.missing.join(", ")}`,
          missing_fields: guard.missing,
        };
      }
      const next = nextStep(s.step);
      if (!next)
        return { ok: false, error: "これ以上進めません", missing_fields: [] };
      return {
        ok: true,
        session: {
          ...s,
          step: next,
          status: next === "complete" ? "complete" : "in_progress",
        },
        diagram_needed: s.step as StepName,
      };
    }

    case "BACK": {
      const prev = prevStep(s.step);
      if (!prev)
        return {
          ok: false,
          error: "これ以上戻れません",
          missing_fields: [],
        };
      return { ok: true, session: { ...s, step: prev } };
    }
  }
}

// ── バルクインプット検出 ──────────────────────────────────────────

/** 100文字超の入力をバルクインプットと判定する */
export function isBulkInput(message: string): boolean {
  return message.trim().length > 100;
}

// ── 抽出結果のマージ ──────────────────────────────────────────────

/**
 * Claude が抽出した Partial<SessionParts> を既存セッションにマージする。
 * - 文字列: 非空の場合のみ上書き
 * - 配列: 非空の場合のみ上書き（追記ではなく置換）
 * - boolean: undefined でない場合のみ上書き
 */
export function mergeExtracted(
  session: LogiSession,
  extracted: Partial<SessionParts> | undefined
): LogiSession {
  if (!extracted) return { ...session, updatedAt: new Date().toISOString() };

  const p = session.parts;
  const e = extracted;

  const parts: typeof p = {
    core: {
      reality:  e.core?.reality?.trim()  || p.core.reality,
      ideal:    e.core?.ideal?.trim()    || p.core.ideal,
      proposal: e.core?.proposal?.trim() || p.core.proposal,
    },
    drilldown: {
      reality_factors: e.drilldown?.reality_factors?.length
        ? e.drilldown.reality_factors : p.drilldown.reality_factors,
      ideal_goals: e.drilldown?.ideal_goals?.length
        ? e.drilldown.ideal_goals : p.drilldown.ideal_goals,
      gap_summary: e.drilldown?.gap_summary?.trim() || p.drilldown.gap_summary,
    },
    what_how: {
      what_items: e.what_how?.what_items?.length
        ? e.what_how.what_items : p.what_how.what_items,
      how_items: e.what_how?.how_items?.length
        ? e.what_how.how_items : p.what_how.how_items,
      who_when: e.what_how?.who_when?.length
        ? e.what_how.who_when : p.what_how.who_when,
    },
    verification: {
      contradictions: e.verification?.contradictions?.length
        ? e.verification.contradictions : p.verification.contradictions,
      is_consistent: e.verification?.is_consistent !== undefined
        ? e.verification.is_consistent : p.verification.is_consistent,
    },
    frame: {
      intro: {
        audience: e.frame?.intro?.audience?.trim() || p.frame.intro.audience,
        hook:     e.frame?.intro?.hook?.trim()     || p.frame.intro.hook,
      },
      closing: {
        cta: e.frame?.closing?.cta?.trim() || p.frame.closing.cta,
      },
      title: e.frame?.title?.trim() || p.frame.title,
    },
  };

  return { ...session, parts, updatedAt: new Date().toISOString() };
}
