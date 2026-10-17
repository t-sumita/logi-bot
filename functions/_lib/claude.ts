// Claude API クライアントラッパー。Tool Use による構造化抽出 + 強化 MOCK モード

import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages.js";
import type { Env, ConversationTurn, SessionParts } from "./types.js";
import { SESSION_UPDATE_TOOL } from "./prompt.js";

// ── 公開インターフェース ──────────────────────────────────────────

export interface ClaudeRequest {
  systemPrompt: string;
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

export async function callClaudeApi(
  apiKey: string,
  req: ClaudeRequest
): Promise<ClaudeResponse> {
  const client = new Anthropic({ apiKey });
  const trimmed = req.history.slice(-20);
  const messages: MessageParam[] = [
    ...trimmed.map((turn) => ({ role: turn.role, content: turn.content })),
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
    if (block.type === "text") reply += block.text;
    else if (block.type === "tool_use" && block.name === "update_session_parts")
      extracted = block.input as Partial<SessionParts>;
  }
  return { reply: reply.trim(), extracted };
}

// ── MOCK レスポンス ───────────────────────────────────────────────

// ── サンプルシナリオ（メール管理AIアシスタント）─────────────────────
const SAMPLE_PARTS: Partial<SessionParts> = {
  head: {
    concept: "重要メールだけをAIが自動選別し、確認時間を1日5分にする仕組み",
    message:  "毎日100通のメールに埋もれる時間を、AIで95%削減する",
  },
  body: {
    core_system: "受信メールの自動スコアリングと毎朝1回の要約ダイジェスト通知",
  },
  right_arm: {
    items: [
      "VIP顧客からの問い合わせを即時検知・最優先通知",
      "商談メールの自動タスク化とカレンダー連携",
      "新規リードメールの自動CRM登録",
    ],
  },
  left_arm: {
    items: [
      "誤判定防止のホワイトリスト・ブラックリスト管理",
      "個人情報・セキュリティ関連メールの別フォルダ隔離",
      "週次レビューで判定精度を継続改善",
    ],
  },
  legs: {
    foundation:  "Gmail API + Cloudflare Workers基盤、月額コスト500円以内",
    next_action: "来月から30日間のパイロット運用開始、効果測定後に全社展開",
  },
};

const SAMPLE_REPLY = `いただいた情報から、合体ロボの全パーツを仮組みしました！🤖

✅ 頭（ヘッド）: コンセプト「AIで重要メール自動選別・確認5分」を設定
✅ 胴体（ボディ）: コアシステム「自動スコアリング＋朝の要約ダイジェスト」を定義
✅ 右腕（ライトアーム）: 攻めの施策3項目（VIP検知・商談タスク化・CRM連携）
✅ 左腕（レフトアーム）: 守りの施策3項目（ホワイトリスト・セキュリティ隔離・週次改善）
✅ 両足（レッグス）: 土台「Gmail + Cloudflare Workers」＋ネクストアクション

🎉 全パーツが仮組みされました！「次へ」ボタンで内容を確認・修正できます。`;

// ── テキスト抽出ユーティリティ ────────────────────────────────────

function extractByPrefix(text: string, prefixes: string[]): string {
  for (const p of prefixes) {
    const re = new RegExp(`(?:${p})[：:\\s　]([^\n]+)`, "i");
    const m = text.match(re);
    if (m && m[1].trim()) return m[1].trim().slice(0, 200);
  }
  return "";
}

function getLines(text: string): string[] {
  return text
    .split(/[\n。、]+/)
    .map((l) => l.replace(/^[・\-\*●○▪◆►\s]+/, "").trim())
    .filter((l) => l.length > 1 && l.length < 300);
}

// ── ステップ別 MOCK レスポンス ────────────────────────────────────

function detectStep(systemPrompt: string): string {
  if (systemPrompt.includes("step1_head")   || systemPrompt.includes("Step 1: 頭"))   return "step1_head";
  if (systemPrompt.includes("step2_body")   || systemPrompt.includes("Step 2: 胴体")) return "step2_body";
  if (systemPrompt.includes("step3_right")  || systemPrompt.includes("Step 3: 右腕")) return "step3_right_arm";
  if (systemPrompt.includes("step4_left")   || systemPrompt.includes("Step 4: 左腕")) return "step4_left_arm";
  if (systemPrompt.includes("step5_legs")   || systemPrompt.includes("Step 5: 両足")) return "step5_legs";
  return "step1_head";
}

function stepMockResponse(step: string, message: string): ClaudeResponse {
  const short = message.slice(0, 40);
  switch (step) {
    case "step1_head": {
      const concept = getLines(message)[0] || message.slice(0, 200);
      return {
        reply: `「${concept.slice(0, 40)}…」を**コンセプト**として記録しました。✅\n\n**このプレゼンで最も伝えたいメッセージ**（結論・一言で言うと）を教えてください。`,
        extracted: { head: { concept, message: "" } },
      };
    }
    case "step2_body": {
      const core_system = getLines(message)[0] || message.slice(0, 200);
      return {
        reply: `「${short}…」を**コアシステム**として記録しました。✅\n\n「次へ」ボタンで Step 3（右腕：攻めの施策）へ進めます。`,
        extracted: { body: { core_system } },
      };
    }
    case "step3_right_arm": {
      const items = getLines(message).slice(0, 3);
      const finalItems = items.length > 0 ? items : [message.slice(0, 100)];
      return {
        reply: `「${short}…」を受け取りました。\n\n✅ 攻めの施策として ${finalItems.length} 件を記録しました。\n\n「次へ」ボタンで Step 4（左腕：守りの施策）へ進めます。`,
        extracted: { right_arm: { items: finalItems } },
      };
    }
    case "step4_left_arm": {
      const items = getLines(message).slice(0, 3);
      const finalItems = items.length > 0 ? items : [message.slice(0, 100)];
      return {
        reply: `「${short}…」を受け取りました。\n\n✅ 守りの施策として ${finalItems.length} 件を記録しました。\n\n「次へ」ボタンで Step 5（両足：土台・基盤）へ進めます。`,
        extracted: { left_arm: { items: finalItems } },
      };
    }
    case "step5_legs": {
      const foundation  = extractByPrefix(message, ["土台","基盤","前提","インフラ","基礎"]) || getLines(message)[0] || message.slice(0, 100);
      const next_action = extractByPrefix(message, ["ネクスト","次のステップ","アクション","予定","計画"]) || getLines(message).slice(-1)[0] || "詳細はご相談ください";
      return {
        reply: `「${short}…」を受け取りました。\n\n✅ 土台とネクストアクションを記録しました。\n\n**「次へ」ボタンで合体ロボ図を完成させましょう！🤖**`,
        extracted: { legs: { foundation, next_action } },
      };
    }
    default: {
      return {
        reply: `「${short}…」ありがとうございます。\n\nプレゼンの**コンセプト・結論**を 1〜2 文で教えてください。`,
        extracted: undefined,
      };
    }
  }
}

function bulkExtractMock(message: string): ClaudeResponse {
  // サンプルシナリオのキーワードが含まれる場合はサンプルデータを返す
  if (message.includes("メール") || message.includes("Gmail") || message.includes("スコアリング")) {
    return { reply: SAMPLE_REPLY, extracted: SAMPLE_PARTS };
  }

  // 汎用バルク抽出：全フィールドに対して抽出を試みる
  const lines = getLines(message);
  const concept    = lines[0] || message.slice(0, 200);
  const msgText    = lines[1] || "";
  const core_system = lines[2] || "";
  const rightItems  = lines.slice(3, 6).filter(Boolean);
  const leftItems   = lines.slice(6, 9).filter(Boolean);
  const foundation  = lines.slice(-2, -1)[0] || "";
  const next_action = lines.slice(-1)[0] || "";

  const filled: string[] = [];
  if (concept)              filled.push("✅ 頭（ヘッド）: コンセプトを仮組み");
  if (core_system)          filled.push("✅ 胴体（ボディ）: コアシステムを仮組み");
  if (rightItems.length > 0) filled.push(`✅ 右腕（ライトアーム）: 攻めの施策 ${rightItems.length} 件を仮組み`);
  if (leftItems.length > 0)  filled.push(`✅ 左腕（レフトアーム）: 守りの施策 ${leftItems.length} 件を仮組み`);
  if (foundation)           filled.push("✅ 両足（レッグス）: 土台を仮組み");

  const missing: string[] = [];
  if (!concept)               missing.push("⚠️ コンセプト・結論（頭）を明確にしてください");
  if (rightItems.length === 0) missing.push("⚠️ 攻めの施策（右腕）を 2〜3 項目教えてください");

  const reply = `いただいた情報から図解パーツを仮組みしました！\n\n${filled.join("\n")}${missing.length > 0 ? "\n\n" + missing[0] : ""}`;

  return {
    reply,
    extracted: {
      head:      { concept, message: msgText },
      body:      { core_system },
      right_arm: { items: rightItems },
      left_arm:  { items: leftItems },
      legs:      { foundation, next_action },
    },
  };
}

function getMockResponse(req: ClaudeRequest): ClaudeResponse {
  if (req.forceTool) return bulkExtractMock(req.message);
  return stepMockResponse(detectStep(req.systemPrompt), req.message);
}

// ── 公開エントリポイント ──────────────────────────────────────────

export async function callClaude(
  env: Env,
  req: ClaudeRequest
): Promise<ClaudeResponse> {
  if (env.LOGI_MOCK === "1") return getMockResponse(req);
  if (!env.ANTHROPIC_API_KEY)
    throw new Error("ANTHROPIC_API_KEY が設定されていません（LOGI_MOCK=1 でモックモードを使用してください）");
  return callClaudeApi(env.ANTHROPIC_API_KEY, req);
}
