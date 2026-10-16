// OpenAI REST API クライアント（Function Calling 対応）

import type { ConversationTurn, SessionParts } from "./types.js";
import type { ClaudeRequest, ClaudeResponse } from "./claude.js";
import { SESSION_PARTS_SCHEMA, SESSION_UPDATE_DESCRIPTION } from "./prompt.js";

const BASE_URL = "https://api.openai.com/v1/chat/completions";

/** OpenAI 向け Tool 定義 */
const OPENAI_TOOL = {
  type: "function" as const,
  function: {
    name: "update_session_parts",
    description: SESSION_UPDATE_DESCRIPTION,
    parameters: SESSION_PARTS_SCHEMA,
  },
};

/** ConversationTurn[] を OpenAI の messages 形式に変換する */
function toOpenAiMessages(
  systemPrompt: string,
  history: ConversationTurn[],
  userMessage: string
) {
  return [
    { role: "system" as const, content: systemPrompt },
    ...history.slice(-20).map((t) => ({
      role: (t.role === "assistant" ? "assistant" : "user") as "assistant" | "user",
      content: t.content,
    })),
    { role: "user" as const, content: userMessage },
  ];
}

/**
 * OpenAI API を呼び出す。
 * Function Calling で reply と extracted を分離する。
 */
export async function callOpenAiApi(
  apiKey: string,
  model: string,
  req: ClaudeRequest
): Promise<ClaudeResponse> {
  const body = {
    model,
    messages: toOpenAiMessages(req.systemPrompt, req.history, req.message),
    tools: [OPENAI_TOOL],
    tool_choice: req.forceTool
      ? { type: "function", function: { name: "update_session_parts" } }
      : "auto",
    max_tokens: req.forceTool ? 2048 : 1024,
  };

  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`OpenAI API error ${res.status}: ${JSON.stringify(err)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{
      message?: {
        content?: string | null;
        tool_calls?: Array<{
          function?: { name: string; arguments: string };
        }>;
      };
    }>;
  };

  const msg = data.choices?.[0]?.message;
  let reply = msg?.content ?? "";
  let extracted: Partial<SessionParts> | undefined;

  for (const tc of msg?.tool_calls ?? []) {
    if (tc.function?.name === "update_session_parts") {
      try {
        extracted = JSON.parse(tc.function.arguments) as Partial<SessionParts>;
      } catch {
        // JSON parse failure — skip
      }
    }
  }

  return { reply: reply.trim(), extracted };
}
