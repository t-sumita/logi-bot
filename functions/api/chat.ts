// POST /api/chat — ステップ内対話 + onboarding 時のバルク一括抽出

import type { PagesFunction } from "@cloudflare/workers-types";
import type {
  Env,
  ChatRequest,
  ChatResponse,
  SessionDiagrams,
  StepName,
} from "../_lib/types.js";
import { isBulkInput, mergeExtracted, firstIncompleteStep } from "../_lib/session.js";
import { buildSystemPrompt, buildBulkSystemPrompt } from "../_lib/prompt.js";
import { callClaude } from "../_lib/claude.js";
import { buildBulkDiagrams } from "../_lib/mermaid.js";

function err(status: number, code: string, message: string): Response {
  return Response.json({ ok: false, error: { code, message } }, { status });
}

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== "POST") {
    return err(405, "method_not_allowed", "POST のみ受け付けます");
  }

  // ── 入力検証 ────────────────────────────────────────────────────
  let body: ChatRequest;
  try {
    body = (await context.request.json()) as ChatRequest;
  } catch {
    return err(400, "invalid_input", "JSON のパースに失敗しました");
  }

  if (!body.session || typeof body.message !== "string" || !body.step) {
    return err(400, "invalid_input", "session / message / step が必須です");
  }
  if (body.message.trim() === "") {
    return err(400, "invalid_input", "message が空です");
  }

  // ── バルク抽出モード判定 ────────────────────────────────────────
  const isBulk = body.step === "onboarding" && isBulkInput(body.message);

  const systemPrompt = isBulk
    ? buildBulkSystemPrompt(body.session)
    : buildSystemPrompt(body.step, body.session);

  // ── Claude API 呼び出し ─────────────────────────────────────────
  let reply: string;
  let extracted: ReturnType<typeof mergeExtracted>["parts"] | undefined;

  try {
    const result = await callClaude(context.env, {
      systemPrompt,
      history: body.session.history,
      message: body.message,
      forceTool: isBulk,
    });
    reply = result.reply;
    extracted = result.extracted as typeof extracted;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    if (msg.includes("ANTHROPIC_API_KEY")) {
      return err(500, "server_misconfigured", msg);
    }
    return err(502, "upstream_error", `Claude API エラー: ${msg}`);
  }

  // ── セッション更新（抽出結果マージ）────────────────────────────
  const now = new Date().toISOString();
  let updatedSession = mergeExtracted(body.session, extracted);

  // 対話履歴を追記
  updatedSession = {
    ...updatedSession,
    history: [
      ...updatedSession.history,
      { role: "user",      content: body.message, step: body.step, timestamp: now },
      { role: "assistant", content: reply,         step: body.step, timestamp: now,
        extracted: extracted as Partial<typeof body.session.parts> | undefined },
    ],
  };

  // ── バルク抽出: ファストトラック遷移 ────────────────────────────
  if (isBulk) {
    const targetStep = firstIncompleteStep(updatedSession.parts);
    const diagrams = buildBulkDiagrams(updatedSession) as Partial<SessionDiagrams>;

    updatedSession = {
      ...updatedSession,
      step: targetStep,
      fast_track: true,
      onboarding_complete: true,
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

  // ── 通常モード ───────────────────────────────────────────────────
  return Response.json({
    ok: true,
    reply,
    extracted,
    session: updatedSession,
  } satisfies ChatResponse);
};
