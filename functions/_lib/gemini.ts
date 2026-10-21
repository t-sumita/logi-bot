// Google Gemini REST API クライアント（Function Calling 対応）

import type { ConversationTurn, SessionParts } from "./types.js";
import type { ClaudeRequest, ClaudeResponse } from "./claude.js";
import { SESSION_PARTS_SCHEMA, SESSION_UPDATE_DESCRIPTION } from "./prompt.js";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

/** Gemini 向け Function Declaration */
const FUNCTION_DECLARATION = {
  name: "update_session_parts",
  description: SESSION_UPDATE_DESCRIPTION,
  parameters: SESSION_PARTS_SCHEMA,
};

/** ConversationTurn[] を Gemini の contents 形式に変換する */
function toGeminiMessages(history: ConversationTurn[], userMessage: string) {
  const contents = history.slice(-20).map((t) => ({
    role: t.role === "assistant" ? "model" : "user",
    parts: [{ text: t.content }],
  }));
  contents.push({ role: "user", parts: [{ text: userMessage }] });
  return contents;
}

/**
 * Gemini API を呼び出す。
 * Function Calling で reply と extracted を分離する。
 */
export async function callGeminiApi(
  apiKey: string,
  model: string,
  req: ClaudeRequest
): Promise<ClaudeResponse> {
  const url = `${BASE_URL}/${model}:generateContent?key=${apiKey}`;

  const body = {
    system_instruction: { parts: [{ text: req.systemPrompt }] },
    contents: toGeminiMessages(req.history, req.message),
    tools: [{ function_declarations: [FUNCTION_DECLARATION] }],
    tool_config: {
      function_calling_config: req.forceTool
        ? { mode: "ANY", allowed_function_names: ["update_session_parts"] }
        : { mode: "AUTO" },
    },
    generation_config: {
      max_output_tokens: 8192,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Gemini API error ${res.status}: ${JSON.stringify(err)}`);
  }

  const data = (await res.json()) as {
    promptFeedback?: { blockReason?: string };
    candidates?: Array<{
      finishReason?: string;
      content?: {
        parts?: Array<
          | { text?: string }
          | { functionCall?: { name: string; args: unknown } }
        >;
      };
    }>;
  };

  const parts = data.candidates?.[0]?.content?.parts ?? [];
  let reply = "";
  let extracted: Partial<SessionParts> | undefined;

  for (const part of parts) {
    if ("text" in part && part.text) {
      reply += part.text;
    } else if (
      "functionCall" in part &&
      part.functionCall?.name === "update_session_parts"
    ) {
      extracted = part.functionCall.args as Partial<SessionParts>;
    }
  }

  const stopReason = data.candidates?.[0]?.finishReason ?? data.promptFeedback?.blockReason;
  return { reply: reply.trim(), extracted, stopReason };
}
