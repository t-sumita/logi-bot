// logi-bot の型定義。セッション状態・ステートマシン・API の共通型

export type StepName =
  | "step1_head"
  | "step2_body"
  | "step3_right_arm"
  | "step4_left_arm"
  | "step5_legs"
  | "complete";

export type SessionStatus = "in_progress" | "complete" | "error";

export type SessionEvent = "NEXT" | "BACK" | "RESET";

// ── セッションパーツ ──────────────────────────────────────────────

/** ① 頭（ヘッド）: コンセプト・結論 */
export interface HeadPart {
  concept: string;
  message: string;
}

/** ② 胴体（ボディ）: コアシステム・本質 */
export interface BodyPart {
  core_system: string;
}

/** ③ 右腕（ライトアーム）: 攻めの施策 */
export interface RightArmPart {
  items: string[];
}

/** ④ 左腕（レフトアーム）: 守りの施策 */
export interface LeftArmPart {
  items: string[];
}

/** ⑤ 両足（レッグス）: 土台・基盤 */
export interface LegsPart {
  foundation: string;
  next_action: string;
}

export interface SessionParts {
  head: HeadPart;
  body: BodyPart;
  right_arm: RightArmPart;
  left_arm: LeftArmPart;
  legs: LegsPart;
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
