// Claude API クライアントラッパー。Tool Use による構造化抽出 + 強化 MOCK モード

import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages.js";
import type { Env, ConversationTurn, SessionParts, CorePart, DrilldownPart, WhatHowPart } from "./types.js";
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
    if (block.type === "text") reply += block.text;
    else if (block.type === "tool_use" && block.name === "update_session_parts")
      extracted = block.input as Partial<SessionParts>;
  }
  return { reply: reply.trim(), extracted };
}

// ── MOCK レスポンス（強化版：手動 Mermaid 作図ツールとして完結）──

// ── サンプルシナリオ（不良在庫の一掃による利益改善）──────────────
const SAMPLE_PARTS: Partial<SessionParts> = {
  core: {
    reality:  "店頭の不良在庫が棚全体の35%を占め、月次150万円のキャッシュが拘束されている",
    ideal:    "不良在庫率を5%以下に抑え、解放した資金を新商品仕入れに回して粗利を20%改善する",
    proposal: "在庫AIスコアリング＋週次クリアランスセールで不良在庫を3ヶ月で一掃する",
  },
  drilldown: {
    reality_factors: [
      "発注担当が経験則に頼り数値根拠がない（需要予測精度±40%）",
      "クリアランス判断基準が曖昧で値引き意思決定に2週間以上かかる",
      "仕入れと販売データが別システムで在庫全体像を誰も把握できていない",
    ],
    ideal_goals: [
      "不良在庫率5%以下（現状35%から改善）",
      "在庫回転率を年6回から12回へ倍増",
      "解放資金300万円を高利益商品仕入れに転用",
    ],
    gap_summary: "意思決定の遅さとデータ分断が在庫滞留の根本原因",
  },
  what_how: {
    what_items: ["在庫AIスコアリング導入", "週次クリアランスセール実施", "発注ルールの数値化"],
    how_items:  [
      "SaaS在庫管理ツール（月5万円）を3ヶ月試験導入",
      "毎週金曜に在庫担当+店長で30分クリアランス判定会議",
      "POS実績ベースで自動計算する発注シート作成",
    ],
    who_when: [],
  },
  verification: { is_consistent: true, contradictions: [] },
  frame: {
    intro:   { audience: "経営陣・仕入れ責任者", hook: "今の在庫の35%が「死に筋」です。3ヶ月で300万円を解放できます" },
    closing: { cta: "来月から在庫管理ツールの試験導入を承認してください" },
    title:   "在庫革命：不良在庫ゼロで利益率20%改善計画",
  },
};

const SAMPLE_REPLY = `いただいた情報から、全パーツを仮組みしました！📦

✅ コア（胸・腹）: 現実「不良在庫35%・月次150万円拘束」→ 理想「粗利20%改善」→ 提案「AIスコアリング+クリアランスセール」
✅ ドリルダウン（両腕）: 現実の要因3つ・理想の成果3つを整理
✅ What/How（両脚）: 3つのアクションとその実行手段を対にして整理
✅ 点検（矛盾検証）: 論理一貫性を確認
✅ 頭・台座（フレーム）: フック・CTA・タイトルを設定

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

function extractCore(msg: string): CorePart {
  const reality  = extractByPrefix(msg, ["現実","現状","問題","課題","今の状況"]) || getLines(msg)[0] || msg.slice(0, 200);
  const ideal    = extractByPrefix(msg, ["理想","目標","あるべき","ゴール","目指す"]) || getLines(msg)[1] || "";
  const proposal = extractByPrefix(msg, ["提案","解決","対策","方針","施策","アイデア"]) || getLines(msg)[2] || "";
  return { reality, ideal, proposal };
}

function extractDrilldown(msg: string): Partial<DrilldownPart> {
  const lines = getLines(msg);
  // 1行だけなら reality_factors に追加
  if (lines.length === 1) return { reality_factors: [lines[0]], ideal_goals: [], gap_summary: "" };
  // 半分を reality_factors、残りを ideal_goals に
  const mid = Math.ceil(lines.length / 2);
  return {
    reality_factors: lines.slice(0, mid),
    ideal_goals:     lines.slice(mid),
    gap_summary:     "",
  };
}

function extractWhatHow(msg: string): Partial<WhatHowPart> {
  // "What: xxx / How: yyy" ペアを検出
  const pairRe = /What[：:　]([^\n/]+)[/／\n]How[：:　]([^\n]+)/gi;
  const pairs: { w: string; h: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = pairRe.exec(msg)) !== null) {
    pairs.push({ w: m[1].trim(), h: m[2].trim() });
  }
  if (pairs.length > 0) {
    return {
      what_items: pairs.map((p) => p.w),
      how_items:  pairs.map((p) => p.h),
      who_when:   [],
    };
  }
  // ペアが見つからなければ行単位で割り振り
  const lines = getLines(msg);
  const mid = Math.ceil(lines.length / 2);
  return {
    what_items: lines.slice(0, mid),
    how_items:  lines.slice(mid).length ? lines.slice(mid) : lines.slice(0, mid).map(() => "（実行方法を追加）"),
    who_when:   [],
  };
}

// ── ステップ別 MOCK レスポンス ────────────────────────────────────

function detectStep(systemPrompt: string): string {
  if (systemPrompt.includes("Step 1") || systemPrompt.includes("step1_core"))   return "step1";
  if (systemPrompt.includes("Step 2") || systemPrompt.includes("step2"))        return "step2";
  if (systemPrompt.includes("Step 3") || systemPrompt.includes("step3"))        return "step3";
  if (systemPrompt.includes("Step 4") || systemPrompt.includes("step4"))        return "step4";
  if (systemPrompt.includes("Step 5") || systemPrompt.includes("step5"))        return "step5";
  return "onboarding";
}

function detectStep1Substep(systemPrompt: string): "reality" | "ideal" | "proposal" | "done" {
  if (systemPrompt.includes("step1_substep:reality"))  return "reality";
  if (systemPrompt.includes("step1_substep:ideal"))    return "ideal";
  if (systemPrompt.includes("step1_substep:proposal")) return "proposal";
  return "done";
}

function stepMockResponse(step: string, message: string, systemPrompt: string = ""): ClaudeResponse {
  const short = message.slice(0, 40);
  switch (step) {
    case "step1": {
      const substep = detectStep1Substep(systemPrompt);
      switch (substep) {
        case "reality": {
          const reality = getLines(message)[0] || message.slice(0, 200);
          return {
            reply: `「${reality.slice(0, 40)}…」を**現実の状況**として記録しました。✅\n\n次に、**理想の状態**を教えてください。\nそれが実現したとき、どんな状況になっていますか？`,
            extracted: { core: { reality, ideal: "", proposal: "" } },
          };
        }
        case "ideal": {
          const ideal = getLines(message)[0] || message.slice(0, 200);
          return {
            reply: `「${ideal.slice(0, 40)}…」を**理想の状態**として記録しました。✅\n\n最後に、**解決策・提案**を教えてください。\nどんなアプローチでこの理想を実現しますか？`,
            extracted: { core: { reality: "", ideal, proposal: "" } },
          };
        }
        case "proposal": {
          const proposal = getLines(message)[0] || message.slice(0, 200);
          return {
            reply: `「${proposal.slice(0, 40)}…」を**提案・解決策**として記録しました。✅\n\n**3要素（現実・理想・提案）が揃いました！🎉**\n「次へ」ボタンで Step 2（両腕・ドリルダウン）へ進めます。`,
            extracted: { core: { reality: "", ideal: "", proposal } },
          };
        }
        default: {
          const core = extractCore(message);
          return {
            reply: `補足を受け取りました。\n\n内容を更新しました。「次へ」ボタンで Step 2 へ進めます。`,
            extracted: { core },
          };
        }
      }
    }
    case "step2": {
      const d = extractDrilldown(message);
      const reply = `「${short}…」を受け取りました。\n\n✅ 現実の要因として ${d.reality_factors?.length ?? 0} 件を記録しました。\n\n**理想を達成したとき、何が実現していますか？** 具体的な成果を2〜3つ教えてください。`;
      return { reply, extracted: { drilldown: d as DrilldownPart } };
    }
    case "step3": {
      const wh = extractWhatHow(message);
      const reply = `「${short}…」を受け取りました。\n\n✅ What/How を ${wh.what_items?.length ?? 0} ペア記録しました。\n\n**体制・予算・期限**で決まっているものはありますか？（なければ「なし」でOKです）`;
      return { reply, extracted: { what_how: wh as WhatHowPart } };
    }
    case "step4": {
      const reply = `「${short}…」を確認しました。\n\n✅ 整合性チェック完了。論理的に一貫したストーリーになっています。\n\n**「次へ」ボタンでStep 5（頭・台座）へ進めます。**`;
      return { reply, extracted: { verification: { is_consistent: true, contradictions: [] } } };
    }
    case "step5": {
      const hook = extractByPrefix(message, ["フック","一文","導入","インパクト"]) || getLines(message)[0] || message.slice(0, 100);
      const cta  = extractByPrefix(message, ["CTA","行動","してほしい","依頼","お願い"]) || getLines(message).slice(-1)[0] || "ぜひ検討をお願いします";
      const reply = `「${short}…」を受け取りました。\n\n✅ フック・CTAを記録しました。\n\n**「次へ」ボタンで合体ロボ図を完成させましょう！🤖**`;
      return {
        reply,
        extracted: {
          frame: {
            intro:   { audience: "", hook },
            closing: { cta },
            title:   "",
          },
        },
      };
    }
    default: {
      return {
        reply: `「${short}…」ありがとうございます。\n\n現在の状況（現実）・目指す状態（理想）・解決策（提案）をどんな形でも構いません、教えてください。`,
        extracted: undefined,
      };
    }
  }
}

function bulkExtractMock(message: string): ClaudeResponse {
  // サンプルシナリオのキーワードが含まれる場合はサンプルデータを返す
  if (message.includes("不良在庫") || message.includes("クリアランス")) {
    return { reply: SAMPLE_REPLY, extracted: SAMPLE_PARTS };
  }

  // 汎用バルク抽出：全フィールドに対して抽出を試みる
  const core = extractCore(message);
  const lines = getLines(message);
  const mid = Math.ceil(lines.length / 2);
  const drilldown: DrilldownPart = {
    reality_factors: lines.slice(0, Math.min(3, mid)),
    ideal_goals:     lines.slice(mid, mid + 3),
    gap_summary:     "",
  };

  const filled: string[] = [];
  if (core.reality)                          filled.push("✅ コア（現実）を仮組み");
  if (core.ideal)                            filled.push("✅ コア（理想）を仮組み");
  if (core.proposal)                         filled.push("✅ コア（提案）を仮組み");
  if (drilldown.reality_factors.length > 0) filled.push("✅ ドリルダウン（現実の要因）を仮組み");
  if (drilldown.ideal_goals.length > 0)     filled.push("✅ ドリルダウン（理想の成果）を仮組み");

  const missing: string[] = [];
  if (!core.reality || !core.ideal || !core.proposal) missing.push("⚠️ コアの3要素（現実・理想・提案）を明確にしてください");
  if (drilldown.reality_factors.length === 0) missing.push("⚠️ 具体的な問題点・制約を教えてください");

  const reply = `いただいた情報から図解パーツを仮組みしました！\n\n${filled.join("\n")}\n\n${missing[0] ?? ""}`;

  return {
    reply,
    extracted: { core, drilldown },
  };
}

function getMockResponse(req: ClaudeRequest): ClaudeResponse {
  if (req.forceTool) return bulkExtractMock(req.message);
  return stepMockResponse(detectStep(req.systemPrompt), req.message, req.systemPrompt);
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
