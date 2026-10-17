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
    step: "step1_head",
    status: "in_progress",
    fast_track: false,
    createdAt: now,
    updatedAt: now,
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

// ── ガード条件 ─────────────────────────────────────────────────────

function guardStep1(parts: SessionParts): string[] {
  if (!parts.head.concept.trim()) return ["parts.head.concept"];
  return [];
}

function guardStep2(parts: SessionParts): string[] {
  if (!parts.body.core_system.trim()) return ["parts.body.core_system"];
  return [];
}

function guardStep3(parts: SessionParts): string[] {
  if (parts.right_arm.items.length < 1) return ["parts.right_arm.items"];
  return [];
}

function guardStep4(parts: SessionParts): string[] {
  if (parts.left_arm.items.length < 1) return ["parts.left_arm.items"];
  return [];
}

function guardStep5(parts: SessionParts): string[] {
  if (!parts.legs.foundation.trim()) return ["parts.legs.foundation"];
  return [];
}

export function checkGuard(
  step: StepName,
  parts: SessionParts
): { ok: true } | { ok: false; missing: string[] } {
  let missing: string[] = [];
  switch (step) {
    case "step1_head":     missing = guardStep1(parts); break;
    case "step2_body":     missing = guardStep2(parts); break;
    case "step3_right_arm": missing = guardStep3(parts); break;
    case "step4_left_arm":  missing = guardStep4(parts); break;
    case "step5_legs":     missing = guardStep5(parts); break;
    default:               return { ok: true };
  }
  return missing.length === 0 ? { ok: true } : { ok: false, missing };
}

// ── ファストトラック: 最初の不足ステップを計算 ────────────────────

export function firstIncompleteStep(parts: SessionParts): StepName {
  if (guardStep1(parts).length > 0) return "step1_head";
  if (guardStep2(parts).length > 0) return "step2_body";
  if (guardStep3(parts).length > 0) return "step3_right_arm";
  if (guardStep4(parts).length > 0) return "step4_left_arm";
  if (guardStep5(parts).length > 0) return "step5_legs";
  return "complete";
}

// ── ステップ順序 ───────────────────────────────────────────────────

const STEP_ORDER: StepName[] = [
  "step1_head",
  "step2_body",
  "step3_right_arm",
  "step4_left_arm",
  "step5_legs",
  "complete",
];

function prevStep(step: StepName): StepName | null {
  const idx = STEP_ORDER.indexOf(step);
  // step1_head には戻れない
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
 */
export function mergeExtracted(
  session: LogiSession,
  extracted: Partial<SessionParts> | undefined
): LogiSession {
  if (!extracted) return { ...session, updatedAt: new Date().toISOString() };

  const p = session.parts;
  const e = extracted;

  const parts: typeof p = {
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
  };

  return { ...session, parts, updatedAt: new Date().toISOString() };
}
