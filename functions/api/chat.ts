// POST /api/chat — ステップ内対話 + onboarding 時のバルク一括抽出（マルチモード対応）

import type { PagesFunction } from "@cloudflare/workers-types";
import type {
  Env,
  ChatRequest,
  ChatResponse,
  SessionDiagrams,
  StepName,
  LLMProvider,
} from "../_lib/types.js";
import { isBulkInput, mergeExtracted, firstIncompleteStep } from "../_lib/session.js";
import { buildSystemPrompt, buildBulkSystemPrompt } from "../_lib/prompt.js";
import { callClaude } from "../_lib/claude.js";
import type { ClaudeRequest, ClaudeResponse } from "../_lib/claude.js";
import { callLLM } from "../_lib/llm.js";
import { buildBulkDiagrams } from "../_lib/mermaid.js";

// ── 認証解決 ─────────────────────────────────────────────────────

type AuthOk =
  | { type: "mock" }
  | { type: "llm"; provider: LLMProvider; model: string; apiKey: string };

type AuthError = { type: "error"; status: number; code: string; message: string };

function resolveAuth(request: Request, env: Env): AuthOk | AuthError {
  // 開発時は env.LOGI_MOCK=1 が最優先（ヘッダー無視）
  if (env.LOGI_MOCK === "1") return { type: "mock" };

  const mode = (request.headers.get("X-Logi-Mode") ?? "mock") as string;

  if (mode === "mock") return { type: "mock" };

  if (mode === "owner") {
    const passcode = request.headers.get("X-Owner-Passcode") ?? "";
    if (!env.OWNER_PASSCODE || passcode !== env.OWNER_PASSCODE) {
      return { type: "error", status: 401, code: "auth_failed", message: "パスコードが正しくありません" };
    }
    if (!env.ANTHROPIC_API_KEY) {
      return { type: "error", status: 500, code: "server_misconfigured", message: "サーバーに ANTHROPIC_API_KEY が設定されていません" };
    }
    return { type: "llm", provider: "anthropic", model: "claude-sonnet-4-6", apiKey: env.ANTHROPIC_API_KEY };
  }

  if (mode === "byok") {
    const provider = request.headers.get("X-Provider") as LLMProvider | null;
    const model    = request.headers.get("X-Model") ?? "";
    const apiKey   = request.headers.get("X-Api-Key") ?? "";
    if (!provider || !["anthropic","gemini","openai"].includes(provider)) {
      return { type: "error", status: 400, code: "invalid_provider", message: "X-Provider が不正です（anthropic / gemini / openai）" };
    }
    if (!apiKey) {
      return { type: "error", status: 400, code: "byok_missing_key", message: "X-Api-Key ヘッダーが必要です" };
    }
    return { type: "llm", provider, model, apiKey };
  }

  // 不明なモード → mock にフォールバック
  return { type: "mock" };
}

// ── ヘルパー ──────────────────────────────────────────────────────

function err(status: number, code: string, message: string): Response {
  return Response.json({ ok: false, error: { code, message } }, { status });
}

async function invokeLLM(
  auth: AuthOk,
  env: Env,
  llmReq: ClaudeRequest
): Promise<ClaudeResponse> {
  if (auth.type === "mock") {
    return callClaude({ ...env, LOGI_MOCK: "1" }, llmReq);
  }
  return callLLM({ provider: auth.provider, model: auth.model, apiKey: auth.apiKey }, llmReq);
}

// ── ハンドラー ───────────────────────────────────────────────────

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== "POST") {
    return err(405, "method_not_allowed", "POST のみ受け付けます");
  }

  // 認証解決
  const auth = resolveAuth(context.request, context.env);
  if (auth.type === "error") return err(auth.status, auth.code, auth.message);

  // 入力検証
  let body: ChatRequest;
  try {
    body = (await context.request.json()) as ChatRequest;
  } catch {
    return err(400, "invalid_input", "JSON のパースに失敗しました");
  }
  if (!body.session || typeof body.message !== "string" || !body.step)
    return err(400, "invalid_input", "session / message / step が必須です");
  if (body.message.trim() === "")
    return err(400, "invalid_input", "message が空です");

  // バルク抽出モード判定
  const isBulk = body.step === "step1_head" && isBulkInput(body.message) && !body.session.parts.head.concept;
  const systemPrompt = isBulk
    ? buildBulkSystemPrompt(body.session)
    : buildSystemPrompt(body.step, body.session);

  // LLM 呼び出し
  let reply: string;
  let extracted: ReturnType<typeof mergeExtracted>["parts"] | undefined;
  try {
    const result = await invokeLLM(auth, context.env, {
      systemPrompt,
      history: body.session.history,
      message: body.message,
      forceTool: isBulk,
    });
    reply = result.reply;
    extracted = result.extracted as typeof extracted;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    return err(502, "upstream_error", msg);
  }

  // セッション更新
  const now = new Date().toISOString();
  let updatedSession = mergeExtracted(body.session, extracted);
  updatedSession = {
    ...updatedSession,
    history: [
      ...updatedSession.history,
      { role: "user",      content: body.message, step: body.step, timestamp: now },
      { role: "assistant", content: reply,         step: body.step, timestamp: now,
        extracted: extracted as Partial<typeof body.session.parts> | undefined },
    ],
  };

  // バルク抽出: ファストトラック遷移
  if (isBulk) {
    const targetStep = firstIncompleteStep(updatedSession.parts);
    const diagrams = buildBulkDiagrams(updatedSession) as Partial<SessionDiagrams>;
    updatedSession = {
      ...updatedSession,
      step: targetStep,
      fast_track: true,
      status: targetStep === "complete" ? "complete" : "in_progress",
      diagrams: { ...updatedSession.diagrams, ...diagrams },
    };
    return Response.json({
      ok: true,
      reply,
      fast_track: true,
      extracted,
      first_incomplete_step: targetStep as StepName,
      diagrams,
      session: updatedSession,
    } satisfies ChatResponse & {
      fast_track: boolean;
      first_incomplete_step: StepName;
      diagrams: Partial<SessionDiagrams>;
    });
  }

  return Response.json({ ok: true, reply, extracted, session: updatedSession } satisfies ChatResponse);
};
