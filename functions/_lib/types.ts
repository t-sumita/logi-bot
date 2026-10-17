// logi-bot の型定義。セッション状態・ステートマシン・API の共通型

export type StepName =
  | "step1_core"
  | "step2_drilldown"
  | "step3_what_how"
  | "step4_verify"
  | "step5_combine"
  | "complete";

export type SessionStatus = "in_progress" | "complete" | "error";

export type SessionEvent = "NEXT" | "BACK" | "RESET";

/** 図ノードのステータス（未入力 / AI案 / 未確認 / 確定） */
export type NodeStatus = "unset" | "ai_draft" | "unconfirmed" | "confirmed";

/** ノード番号 → ステータスのマップ（例: { "1": "confirmed", "4-1": "ai_draft" }）*/
export type SessionNodeStatuses = Record<string, NodeStatus>;

// ── セッションパーツ ──────────────────────────────────────────────

/** Step 1: 胴体（コア）— 現実・理想・提案 */
export interface CorePart {
  reality: string;
  ideal: string;
  proposal: string;
}

/** Step 2: 左腕・右腕（ドリルダウン）*/
export interface DrilldownPart {
  reality_factors: string[];
  ideal_goals: string[];
  gap_summary: string;
}

export interface WhoWhen {
  what_index: number;
  who?: string;
  when?: string;
}

/** Step 3: 両足（What/How）*/
export interface WhatHowPart {
  what_items: string[];
  how_items: string[];
  who_when: WhoWhen[];
}

export interface Contradiction {
  description: string;
  location: string;
  resolution: string;
}

/** Step 4: 合体前の点検（検証）*/
export interface VerifyPart {
  contradictions: Contradiction[];
  is_consistent: boolean;
}

export interface IntroPart {
  audience: string;
  hook: string;
}

export interface ClosingPart {
  cta: string;
}

/** Step 5: 頭・台座（フレーム）*/
export interface FramePart {
  intro: IntroPart;
  closing: ClosingPart;
  title: string;
}

export interface SessionParts {
  core: CorePart;
  drilldown: DrilldownPart;
  what_how: WhatHowPart;
  verification: VerifyPart;
  frame: FramePart;
}

export interface SessionDiagrams {
  step1?: string;
  step2?: string;
  step3?: string;
  step4?: string;
  step5?: string;
  final?: string;
}

export interface ConversationTurn {
  role: "assistant" | "user";
  content: string;
  step: StepName;
  timestamp: string;
  extracted?: Partial<SessionParts>;
}

// ── セッション本体 ────────────────────────────────────────────────

export interface LogiSession {
  sessionId: string;
  title: string;
  step: StepName;
  status: SessionStatus;
  fast_track: boolean;
  createdAt: string;
  updatedAt: string;
  parts: SessionParts;
  diagrams: SessionDiagrams;
  history: ConversationTurn[];
  /** [0]〜[8] 番号付きノードのステータス管理 */
  nodeStatuses: SessionNodeStatuses;
}

// ── API リクエスト / レスポンス ──────────────────────────────────

export interface ChatRequest {
  session: LogiSession;
  message: string;
  step: StepName;
}

export interface ChatResponse {
  ok: true;
  reply: string;
  extracted?: Partial<SessionParts>;
  fast_track?: boolean;
  first_incomplete_step?: StepName;
  diagrams?: Partial<SessionDiagrams>;
  session: LogiSession;
}

export interface AdvanceRequest {
  session: LogiSession;
  event: "NEXT" | "BACK" | "RESET";
}

export interface AdvanceResponse {
  ok: true;
  session: LogiSession;
  diagram?: string;
}

export interface AdvanceGuardFailed {
  ok: false;
  error: { code: "guard_failed"; message: string };
  missing_fields: string[];
}

export interface DiagramRequest {
  session: LogiSession;
  step: StepName | "final";
}

export interface DiagramResponse {
  ok: true;
  diagram: string;
  step: StepName | "final";
}

export interface ErrorResponse {
  ok: false;
  error: { code: string; message: string };
}

// ── マルチプロバイダ / モード ─────────────────────────────────────

/** サポートする LLM プロバイダ */
export type LLMProvider = "anthropic" | "gemini" | "openai";

/** クライアントから指定される動作モード */
export type AppMode = "mock" | "owner" | "byok";

// ── Cloudflare 環境変数 ───────────────────────────────────────────

export interface Env {
  ANTHROPIC_API_KEY?: string;
  LOGI_MOCK?: string;
  OWNER_PASSCODE?: string;
}
