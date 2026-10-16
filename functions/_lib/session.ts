// ステートマシン: セッションの状態遷移・ガード判定・初期化

import type {
  LogiSession,
  SessionEvent,
  SessionParts,
  StepName,
} from "./types.js";

// ── 初期セッション生成 ────────────────────────────────────────────

export function createSession(sessionId: string, title: string): LogiSession {
  const now = new Date().toISOString();
  return {
    sessionId,
    title,
    step: "idle",
    status: "in_progress",
    fast_track: false,
    onboarding_complete: false,
    createdAt: now,
    updatedAt: now,
    parts: {
      core: { reality: "", ideal: "", proposal: "" },
      drilldown: { reality_factors: [], ideal_goals: [], gap_summary: "" },
      what_how: { what_items: [], how_items: [], who_when: [] },
      verification: { contradictions: [], is_consistent: false },
      frame: {
        intro: { audience: "", hook: "" },
        closing: { cta: "" },
        title: "",
      },
    },
    diagrams: {},
    history: [],
  };
}

// ── ガード条件 ─────────────────────────────────────────────────────

function guardStep1(parts: SessionParts): string[] {
  const missing: string[] = [];
  if (!parts.core.reality.trim()) missing.push("parts.core.reality");
  if (!parts.core.ideal.trim()) missing.push("parts.core.ideal");
  if (!parts.core.proposal.trim()) missing.push("parts.core.proposal");
  return missing;
}

function guardStep2(parts: SessionParts): string[] {
  const missing: string[] = [];
  if (parts.drilldown.reality_factors.length < 1)
    missing.push("parts.drilldown.reality_factors");
  if (parts.drilldown.ideal_goals.length < 1)
    missing.push("parts.drilldown.ideal_goals");
  return missing;
}

function guardStep3(parts: SessionParts): string[] {
  const missing: string[] = [];
  if (parts.what_how.what_items.length < 1)
    missing.push("parts.what_how.what_items");
  if (parts.what_how.how_items.length < 1)
    missing.push("parts.what_how.how_items");
  if (parts.what_how.what_items.length !== parts.what_how.how_items.length)
    missing.push("parts.what_how.how_items (what と how の数が一致していません)");
  return missing;
}

function guardStep4(parts: SessionParts): string[] {
  if (!parts.verification.is_consistent)
    return ["parts.verification.is_consistent"];
  const unresolved = parts.verification.contradictions.filter(
    (c) => !c.resolution.trim()
  );
  if (unresolved.length > 0)
    return [`矛盾 ${unresolved.length} 件が未解決です`];
  return [];
}

function guardStep5(parts: SessionParts): string[] {
  const missing: string[] = [];
  if (!parts.frame.intro.hook.trim()) missing.push("parts.frame.intro.hook");
  if (!parts.frame.closing.cta.trim()) missing.push("parts.frame.closing.cta");
  return missing;
}

export function checkGuard(
  step: StepName,
  parts: SessionParts
): { ok: true } | { ok: false; missing: string[] } {
  let missing: string[] = [];
  switch (step) {
    case "step1_core":
      missing = guardStep1(parts);
      break;
    case "step2_drilldown":
      missing = guardStep2(parts);
      break;
    case "step3_what_how":
      missing = guardStep3(parts);
      break;
    case "step4_verify":
      missing = guardStep4(parts);
      break;
    case "step5_combine":
      missing = guardStep5(parts);
      break;
    default:
      return { ok: true };
  }
  return missing.length === 0 ? { ok: true } : { ok: false, missing };
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
  "idle",
  "onboarding",
  "step1_core",
  "step2_drilldown",
  "step3_what_how",
  "step4_verify",
  "step5_combine",
  "complete",
];

function prevStep(step: StepName): StepName | null {
  const idx = STEP_ORDER.indexOf(step);
  // idle / onboarding には戻れない
  if (idx <= 2) return null;
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

    case "START": {
      if (s.step !== "idle")
        return { ok: false, error: "START は idle 状態でのみ有効です", missing_fields: [] };
      return { ok: true, session: { ...s, step: "onboarding" } };
    }

    case "BULK_EXTRACT": {
      // BULK_EXTRACT は onboarding 時のみ。遷移先は呼び出し側で parts を更新してから
      // firstIncompleteStep で決定する（このトランジション関数では parts マージ後を受け取る想定）
      if (s.step !== "onboarding")
        return {
          ok: false,
          error: "BULK_EXTRACT は onboarding 状態でのみ有効です",
          missing_fields: [],
        };
      const targetStep = firstIncompleteStep(s.parts);
      return {
        ok: true,
        session: {
          ...s,
          step: targetStep,
          fast_track: true,
          onboarding_complete: true,
          status: targetStep === "complete" ? "complete" : "in_progress",
        },
      };
    }

    case "NEXT": {
      if (s.step === "onboarding") {
        // 短い入力での通常進行: onboarding → step1_core
        return {
          ok: true,
          session: { ...s, step: "step1_core", onboarding_complete: true },
        };
      }
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
