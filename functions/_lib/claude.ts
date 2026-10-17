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
  core: {
    reality:  "毎日100通以上のメールが届き、重要な連絡を見落とすことが月3件以上起きている",
    ideal:    "重要メールだけを即座に把握し、確認時間を1日5分に短縮できている状態",
    proposal: "AIによる重要メール自動選別＆毎朝の要約通知システムの導入",
  },
  drilldown: {
    reality_factors: [
      "1日120通受信・月3件見落とし発生",
      "重要メールの判定基準が曖昧で手作業に頼っている",
      "確認作業に1日30分以上消費している",
    ],
    ideal_goals: [
      "見落としゼロ・確認5分以内",
      "重要メール即時通知で対応リードタイムを2時間以内に",
      "月3件の見落としを完全撲滅",
    ],
    gap_summary: "手動判断の限界とメール量過多が見落としの根本原因",
  },
  what_how: {
    what_items: ["自動フィルタと要約通知の導入", "VIPリストの整備", "週次レビューの仕組み化"],
    how_items:  [
      "開発2週間・予算0円・来月開始",
      "上位20名の連絡先をホワイトリスト登録",
      "毎週金曜15分のメール品質チェック",
    ],
    who_when: [],
  },
  verification: { is_consistent: true, contradictions: [] },
  frame: {
    intro:   { audience: "メール処理に追われているビジネスパーソン", hook: "メール処理に追われていませんか？1日30分の無駄を5分にできます" },
    closing: { cta: "今週中にAIメールフィルターのパイロット導入を開始しましょう" },
    title:   "メール革命：AIで確認時間を1日5分に短縮する",
  },
};

const SAMPLE_REPLY = `いただいた情報から、合体ロボの全ステップを仮組みしました！🤖

✅ 胴体（コア）: 現実「1日120通・月3件見落とし」→ 理想「確認5分以内・見落としゼロ」→ 提案「AI自動選別＋朝の要約通知」
✅ 左腕・右腕: 現実の要因3つ・理想の目標3つを整理
✅ 両足（2本柱）: 3つのWhat（何を）と対応するHow（どうやって）を整理
✅ 合体前の点検: 論理一貫性を確認
✅ 頭・台座: フック・CTA・タイトルを設定

🎉 全ステップが仮組みされました！「次のステップへ」ボタンで内容を確認・修正できます。`;

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
  if (systemPrompt.includes("step1_core")      || systemPrompt.includes("Step 1: 胴体")) return "step1_core";
  if (systemPrompt.includes("step2_drilldown") || systemPrompt.includes("Step 2: 左腕")) return "step2_drilldown";
  if (systemPrompt.includes("step3_what_how")  || systemPrompt.includes("Step 3: 両足")) return "step3_what_how";
  if (systemPrompt.includes("step4_verify")    || systemPrompt.includes("Step 4: 合体前")) return "step4_verify";
  if (systemPrompt.includes("step5_combine")   || systemPrompt.includes("Step 5: 頭・台座")) return "step5_combine";
  return "step1_core";
}

function detectStep1Substep(systemPrompt: string): "reality" | "ideal" | "proposal" | "done" {
  if (systemPrompt.includes("【①現実】")) return "reality";
  if (systemPrompt.includes("【②理想】")) return "ideal";
  if (systemPrompt.includes("【③提案】")) return "proposal";
  if (systemPrompt.includes("3要素が揃いました")) return "done";
  return "reality";
}

function stepMockResponse(step: string, systemPrompt: string, message: string): ClaudeResponse {
  const short = message.slice(0, 40);
  switch (step) {
    case "step1_core": {
      const substep = detectStep1Substep(systemPrompt);
      if (substep === "reality") {
        const reality = getLines(message)[0] || message.slice(0, 200);
        return {
          reply: `「${reality.slice(0, 40)}」を**①現実（課題）**として記録しました。✅\n\n次に、**②理想（あるべき姿）**を教えてください。`,
          extracted: { core: { reality, ideal: "", proposal: "" } },
        };
      }
      if (substep === "ideal") {
        const ideal = getLines(message)[0] || message.slice(0, 200);
        return {
          reply: `「${ideal.slice(0, 40)}」を**②理想（あるべき姿）**として記録しました。✅\n\n最後に、**③提案（解決策の核）**を教えてください。`,
          extracted: { core: { reality: "", ideal, proposal: "" } },
        };
      }
      if (substep === "proposal") {
        const proposal = getLines(message)[0] || message.slice(0, 200);
        return {
          reply: `「${proposal.slice(0, 40)}」を**③提案（解決策）**として記録しました。✅\n\n3要素が揃いました！「次へ」ボタンで Step 2 へ進めます。`,
          extracted: { core: { reality: "", ideal: "", proposal } },
        };
      }
      // done substep
      return {
        reply: `ありがとうございます。補足を記録しました。「次へ」ボタンで Step 2（左腕・右腕）へ進めます。`,
        extracted: undefined,
      };
    }
    case "step2_drilldown": {
      const lines = getLines(message);
      const reality_factors = lines.slice(0, 3).filter(Boolean);
      const ideal_goals     = lines.slice(3, 6).filter(Boolean);
      const finalFactors = reality_factors.length > 0 ? reality_factors : [message.slice(0, 100)];
      const finalGoals   = ideal_goals.length > 0 ? ideal_goals : ["目標を達成した状態"];
      return {
        reply: `「${short}…」を受け取りました。\n\n✅ 現実の要因 ${finalFactors.length} 件・理想の目標 ${finalGoals.length} 件を記録しました。\n\n「次へ」ボタンで Step 3（両足）へ進めます。`,
        extracted: { drilldown: { reality_factors: finalFactors, ideal_goals: finalGoals, gap_summary: "" } },
      };
    }
    case "step3_what_how": {
      const lines = getLines(message);
      const half = Math.ceil(lines.length / 2);
      const what_items = lines.slice(0, half).filter(Boolean);
      const how_items  = lines.slice(half).filter(Boolean);
      const finalWhat = what_items.length > 0 ? what_items : [message.slice(0, 100)];
      const finalHow  = how_items.length > 0 ? how_items : ["詳細は次のステップで確認"];
      const len = Math.min(finalWhat.length, finalHow.length);
      return {
        reply: `「${short}…」を受け取りました。\n\n✅ What/How を ${len} ペア記録しました。\n\n「次へ」ボタンで Step 4（合体前の点検）へ進めます。`,
        extracted: { what_how: { what_items: finalWhat.slice(0, len), how_items: finalHow.slice(0, len), who_when: [] } },
      };
    }
    case "step4_verify": {
      return {
        reply: `ご確認ありがとうございます。✅ 論理整合性を確認しました。\n\n「次へ」ボタンで Step 5（頭・台座）へ進めます。`,
        extracted: { verification: { is_consistent: true, contradictions: [] } },
      };
    }
    case "step5_combine": {
      const hook = extractByPrefix(message, ["イントロ","フック","冒頭","始め","頭"]) || getLines(message)[0] || message.slice(0, 100);
      const cta  = extractByPrefix(message, ["クロージング","CTA","締め","行動","次の行動"]) || getLines(message).slice(-1)[0] || "今すぐ始めましょう";
      return {
        reply: `「${short}…」を受け取りました。\n\n✅ イントロとクロージングを記録しました。\n\n**「次へ」ボタンで合体ロボ図を完成させましょう！🤖**`,
        extracted: { frame: { intro: { audience: "", hook }, closing: { cta }, title: "" } },
      };
    }
    default: {
      return {
        reply: `「${short}…」ありがとうございます。\n\nまずは**①現実（いま起きている課題）**を教えてください。`,
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
  const reality    = extractByPrefix(message, ["現実","課題","問題","現状"]) || lines[0] || message.slice(0, 200);
  const ideal      = extractByPrefix(message, ["理想","目標","あるべき姿","ゴール"]) || lines[1] || "";
  const proposal   = extractByPrefix(message, ["提案","解決策","アイデア","施策"]) || lines[2] || "";
  const factors    = lines.slice(3, 6).filter(Boolean);
  const goals      = lines.slice(6, 9).filter(Boolean);
  const whatItems  = lines.slice(9, 12).filter(Boolean);
  const howItems   = lines.slice(12, 15).filter(Boolean);
  const hook       = extractByPrefix(message, ["イントロ","フック","冒頭"]) || lines.slice(-2, -1)[0] || "";
  const cta        = extractByPrefix(message, ["クロージング","CTA","締め","行動"]) || lines.slice(-1)[0] || "";

  const filled: string[] = [];
  if (reality)              filled.push("✅ 胴体（コア）: 現実を仮組み");
  if (ideal)                filled.push("✅ 胴体（コア）: 理想を仮組み");
  if (proposal)             filled.push("✅ 胴体（コア）: 提案を仮組み");
  if (factors.length > 0)   filled.push(`✅ 左腕・右腕: 現実の要因 ${factors.length} 件を仮組み`);
  if (goals.length > 0)     filled.push(`✅ 左腕・右腕: 理想の目標 ${goals.length} 件を仮組み`);
  if (whatItems.length > 0) filled.push(`✅ 両足（2本柱）: What ${whatItems.length} 件を仮組み`);
  if (hook)                 filled.push("✅ 頭・台座: イントロを仮組み");

  const missing: string[] = [];
  if (!reality)              missing.push("⚠️ ①現実（課題）を明確にしてください");
  else if (!ideal)           missing.push("⚠️ ②理想（あるべき姿）を教えてください");

  const reply = `いただいた情報から図解パーツを仮組みしました！\n\n${filled.join("\n")}${missing.length > 0 ? "\n\n" + missing[0] : ""}`;

  const len = Math.min(whatItems.length, howItems.length);

  return {
    reply,
    extracted: {
      core:      { reality, ideal, proposal },
      drilldown: { reality_factors: factors, ideal_goals: goals, gap_summary: "" },
      what_how:  { what_items: whatItems.slice(0, len), how_items: howItems.slice(0, len), who_when: [] },
      verification: { is_consistent: false, contradictions: [] },
      frame:     { intro: { audience: "", hook }, closing: { cta }, title: "" },
    },
  };
}

function getMockResponse(req: ClaudeRequest): ClaudeResponse {
  if (req.forceTool) return bulkExtractMock(req.message);
  return stepMockResponse(detectStep(req.systemPrompt), req.systemPrompt, req.message);
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
