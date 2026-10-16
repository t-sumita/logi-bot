// Claude API クライアントラッパー。Tool Use による構造化抽出 + MOCK モード

import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages.js";
import type { Env, ConversationTurn, SessionParts } from "./types.js";
import { SESSION_UPDATE_TOOL } from "./prompt.js";

// ── 公開インターフェース ──────────────────────────────────────────

export interface ClaudeRequest {
  systemPrompt: string;
  /** 直近 N 件のみ送る（上限 20 ターン）*/
  history: ConversationTurn[];
  message: string;
  /** true = バルク抽出モード（tool_choice: forced）*/
  forceTool?: boolean;
}

export interface ClaudeResponse {
  reply: string;
  extracted?: Partial<SessionParts>;
}

// ── 本番 API 呼び出し ────────────────────────────────────────────

async function callClaudeApi(
  apiKey: string,
  req: ClaudeRequest
): Promise<ClaudeResponse> {
  const client = new Anthropic({ apiKey });

  // 直近 20 ターンのみ送信（ペア単位で切り出す）
  const trimmed = req.history.slice(-20);
  const messages: MessageParam[] = [
    ...trimmed.map((t) => ({ role: t.role, content: t.content })),
    { role: "user" as const, content: req.message },
  ];

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: req.forceTool ? 2048 : 1024,
    system: req.systemPrompt,
    messages,
    tools: [SESSION_UPDATE_TOOL],
    tool_choice: req.forceTool
      ? { type: "tool", name: "update_session_parts" }
      : { type: "auto" },
  });

  let reply = "";
  let extracted: Partial<SessionParts> | undefined;

  for (const block of response.content) {
    if (block.type === "text") {
      reply += block.text;
    } else if (
      block.type === "tool_use" &&
      block.name === "update_session_parts"
    ) {
      extracted = block.input as Partial<SessionParts>;
    }
  }

  return { reply: reply.trim(), extracted };
}

// ── MOCK レスポンス ───────────────────────────────────────────────

function getMockResponse(req: ClaudeRequest): ClaudeResponse {
  // bulk_extract モードの MOCK
  if (req.forceTool) {
    return {
      reply:
        "いただいた情報から、以下のパーツを仮組みしました！\n\n" +
        "✅ コア（胸・腹）: 現実・理想・提案を仮設定\n" +
        "✅ ドリルダウン（両腕）: 要因・成果を仮設定\n\n" +
        "⚠️ **両脚（What/How）** がまだ具体的ではありません。\n" +
        "提案を実現するために「何を変える・作る」必要がありますか？",
      extracted: {
        core: {
          reality:  "[MOCK] 現在の課題：既存プロセスが非効率",
          ideal:    "[MOCK] 理想の状態：作業時間を50%削減",
          proposal: "[MOCK] 提案：AIによる自動化ツールの導入",
        },
        drilldown: {
          reality_factors: ["[MOCK] 手作業が多い", "[MOCK] ツールが老朽化"],
          ideal_goals:     ["[MOCK] 工数半減", "[MOCK] ミス率ゼロ"],
          gap_summary:     "[MOCK] 自動化ツールがない",
        },
      },
    };
  }

  // 通常会話の MOCK（システムプロンプトからステップを推測）
  if (req.systemPrompt.includes("Step 1")) {
    return {
      reply:
        "[MOCK] なるほど。今の状況（現実）を教えていただけますか？\n" +
        "具体的にどんな問題が起きていますか？",
      extracted: req.message.length > 10
        ? { core: { reality: `[MOCK] ${req.message.slice(0, 50)}`, ideal: "", proposal: "" } }
        : undefined,
    };
  }
  if (req.systemPrompt.includes("Step 2")) {
    return {
      reply:
        "[MOCK] その問題について、具体的な数値はありますか？（例: 週何時間？コストは？）",
      extracted: { drilldown: { reality_factors: [`[MOCK] ${req.message.slice(0, 50)}`], ideal_goals: [], gap_summary: "" } },
    };
  }
  if (req.systemPrompt.includes("Step 3")) {
    return {
      reply: "[MOCK] それを実現するために、具体的に「何をする」必要がありますか？",
      extracted: { what_how: { what_items: [`[MOCK] ${req.message.slice(0, 50)}`], how_items: ["[MOCK] 詳細を決める"], who_when: [] } },
    };
  }
  if (req.systemPrompt.includes("Step 4")) {
    return {
      reply: "[MOCK] ここまでの流れを見て、矛盾やブレはありますか？",
      extracted: { verification: { is_consistent: true, contradictions: [] } },
    };
  }
  if (req.systemPrompt.includes("Step 5")) {
    return {
      reply: "[MOCK] 最後に、このプレゼンを聞く相手は誰ですか？どんな一言で興味を引きますか？",
      extracted: {
        frame: {
          intro:   { audience: "[MOCK] 経営陣", hook: "[MOCK] コストを半分にする方法があります" },
          closing: { cta: "[MOCK] ぜひ導入を検討してください" },
          title:   "[MOCK] AI自動化で業務革新",
        },
      },
    };
  }

  return {
    reply: "[MOCK] ご回答ありがとうございます。次の点について教えていただけますか？",
    extracted: undefined,
  };
}

// ── 公開エントリポイント ──────────────────────────────────────────

/**
 * Claude API を呼び出す（MOCK モード対応）。
 * LOGI_MOCK=1 の場合は API を呼ばず固定レスポンスを返す。
 */
export async function callClaude(
  env: Env,
  req: ClaudeRequest
): Promise<ClaudeResponse> {
  if (env.LOGI_MOCK === "1") {
    return getMockResponse(req);
  }

  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY が設定されていません（LOGI_MOCK=1 でモックモードを使用してください）");
  }

  return callClaudeApi(env.ANTHROPIC_API_KEY, req);
}
