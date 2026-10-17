// Claude API プロンプト構築。ステップ別ファシリテーター指示 + Tool Use 定義

import type { Tool } from "@anthropic-ai/sdk/resources/messages.js";
import type { LogiSession, SessionParts, StepName } from "./types.js";

// ── Tool 定義（構造化データ抽出）────────────────────────────────

/**
 * Claude がユーザー回答から抽出した情報を返す Tool。
 * Tool Use によって返答テキストと抽出データを確実に分離する。
 */
export const SESSION_UPDATE_TOOL: Tool = {
  name: "update_session_parts",
  description:
    "ユーザーの回答から確実に確認できた情報を SessionParts の対応フィールドに格納する。" +
    "推測や創作は一切行わない。確認が取れていないフィールドは含めない。",
  input_schema: {
    type: "object",
    properties: {
      head: {
        type: "object",
        description: "Step 1: 頭（ヘッド）— コンセプト・全体メッセージ",
        properties: {
          concept: { type: "string", description: "全体のコンセプト・方向性（最大 200 文字）" },
          message: { type: "string", description: "最も伝えたいメッセージ（最大 200 文字）" },
        },
      },
      body: {
        type: "object",
        description: "Step 2: 胴体（ボディ）— コアシステム・本質的な仕組み",
        properties: {
          core_system: { type: "string", description: "ビジネスモデルの根幹・主要データ（最大 300 文字）" },
        },
      },
      right_arm: {
        type: "object",
        description: "Step 3: 右腕（ライトアーム）— 攻めの施策（2〜3 項目）",
        properties: {
          items: {
            type: "array",
            items: { type: "string" },
            description: "マーケティング・新規顧客開拓など攻めの施策（各最大 100 文字・2〜3 項目）",
          },
        },
      },
      left_arm: {
        type: "object",
        description: "Step 4: 左腕（レフトアーム）— 守りの施策（2〜3 項目）",
        properties: {
          items: {
            type: "array",
            items: { type: "string" },
            description: "リスク管理・既存顧客維持など守りの施策（各最大 100 文字・2〜3 項目）",
          },
        },
      },
      legs: {
        type: "object",
        description: "Step 5: 両足（レッグス）— 土台・基盤・ネクストアクション",
        properties: {
          foundation:  { type: "string", description: "企業理念・技術基盤・前提条件（最大 200 文字）" },
          next_action: { type: "string", description: "ネクストアクション・次のステップ（最大 200 文字）" },
        },
      },
    },
  },
};

// ── 現在のセッション状態をプロンプト用にシリアライズ ────────────

function serializeParts(parts: SessionParts): string {
  const lines: string[] = [];

  const { head, body, right_arm, left_arm, legs } = parts;

  if (head.concept)  lines.push(`【コンセプト（頭）】${head.concept}`);
  if (head.message)  lines.push(`【メッセージ（頭）】${head.message}`);

  if (body.core_system) lines.push(`【コアシステム（胴体）】${body.core_system}`);

  if (right_arm.items.length > 0)
    lines.push(`【攻めの施策（右腕）】\n${right_arm.items.map((f) => `  - ${f}`).join("\n")}`);

  if (left_arm.items.length > 0)
    lines.push(`【守りの施策（左腕）】\n${left_arm.items.map((f) => `  - ${f}`).join("\n")}`);

  if (legs.foundation)  lines.push(`【土台・基盤（両足）】${legs.foundation}`);
  if (legs.next_action) lines.push(`【ネクストアクション（両足）】${legs.next_action}`);

  return lines.length > 0 ? lines.join("\n") : "（まだ情報はありません）";
}

// ── ステップ別メタ情報 ────────────────────────────────────────────

interface StepMeta {
  displayName: string;
  index: number;
  purpose: string;
  requirements: string;
  nextHint: string;
}

const STEP_META: Partial<Record<StepName, StepMeta>> = {
  step1_head: {
    displayName: "Step 1: 頭（ヘッド）", index: 1,
    purpose: "プレゼン全体のコンセプトと最も伝えたいメッセージを 1〜2 文で定義する",
    requirements: "head.concept（コンセプト）",
    nextHint: "コンセプトが明確になったら「次へ」ボタンを案内する。",
  },
  step2_body: {
    displayName: "Step 2: 胴体（ボディ）", index: 2,
    purpose: "ビジネスモデルの根幹・コアシステムの本質的な仕組みを定義する",
    requirements: "body.core_system",
    nextHint: "コアシステムの説明が揃ったら「次へ」を案内する。",
  },
  step3_right_arm: {
    displayName: "Step 3: 右腕（ライトアーム）", index: 3,
    purpose: "攻めの施策（マーケティング・新規顧客開拓など）を 2〜3 項目でドリルダウンする",
    requirements: "right_arm.items（≥1 項目）",
    nextHint: "攻めの施策が 2〜3 項目揃ったら「次へ」を案内する。",
  },
  step4_left_arm: {
    displayName: "Step 4: 左腕（レフトアーム）", index: 4,
    purpose: "守りの施策（リスク管理・既存顧客維持など）を 2〜3 項目でドリルダウンする",
    requirements: "left_arm.items（≥1 項目）",
    nextHint: "守りの施策が 2〜3 項目揃ったら「次へ」を案内する。",
  },
  step5_legs: {
    displayName: "Step 5: 両足（レッグス）", index: 5,
    purpose: "プレゼンの土台となる企業理念・技術基盤・前提条件とネクストアクションを固める",
    requirements: "legs.foundation（土台・基盤）",
    nextHint: "土台とネクストアクションが揃ったら「完成」を案内する。",
  },
};

// ── ドリルダウン品質チェックパターン ─────────────────────────────

const DRILLDOWN_GUIDANCE = `
【ドリルダウン品質: 回答が抽象的な場合はツッコミを入れること】
- 数値化:「どのくらいですか？（件数・%・金額・時間など）」
- 具体化:「具体的には誰が・どこで・いつ起きていますか？」
- 原因追求:「なぜそうなっているのでしょうか？根本原因は？」
- 導入前後:「実現したら、導入前と比べて何がどう変わりますか？」
- ROI:「コスト（時間・費用・人員）と期待リターンはどのくらいですか？」
- 優先度:「複数ある場合、最も重要なものはどれですか？」
- 証拠:「それを裏付けるデータや事例はありますか？」

ただし一度に全部聞かない。1 ターンにつき 1〜2 問のみ。
`.trim();

// ── 通常ステップ用システムプロンプト ─────────────────────────────

/**
 * 通常対話用のシステムプロンプトを構築する。
 */
export function buildSystemPrompt(step: StepName, session: LogiSession): string {
  const meta = STEP_META[step];
  const stepLabel = meta
    ? `${meta.displayName}（${meta.index}/5）`
    : step;

  return `あなたは「logi-bot」、永田豊志の図解思考メソッドに基づくAIファシリテーターです。
利用者のアイデアを5パーツで構造化し、合体ロボMermaid図を完成させます。

【合体ロボの5パーツ構成】
① 頭（ヘッド）: コンセプト・結論 — 全体の方向性と最も伝えたいメッセージ
② 胴体（ボディ）: コアシステム — ビジネスモデルの根幹・本質的な仕組み
③ 右腕（ライトアーム）: 攻めの施策 — マーケティング・新規顧客開拓（2〜3項目）
④ 左腕（レフトアーム）: 守りの施策 — リスク管理・既存顧客維持（2〜3項目）
⑤ 両足（レッグス）: 土台・基盤 — 企業理念・技術基盤・ネクストアクション

━━ 現在のステップ ━━
${stepLabel}
目的: ${meta?.purpose ?? "対話を進める"}
このステップで収集すべき情報: ${meta?.requirements ?? ""}

━━ 収集済み情報 ━━
${serializeParts(session.parts)}

━━ 応答ルール ━━
1. 一度に 1〜2 問まで（質問を詰め込まない）
2. 利用者の回答を要約して「〇〇ということですね？」と確認を取る
3. 確認できた情報は必ず update_session_parts ツールで返す
4. 次のステップへの準備が整ったら「準備ができました。「次へ」ボタンを押してください」と伝える
5. ${meta?.nextHint ?? ""}

${DRILLDOWN_GUIDANCE}`;
}

// ── バルク抽出用システムプロンプト ───────────────────────────────

/**
 * バルクインプット（長文貼り付け）時のシステムプロンプトを構築する。
 * Tool Use を必須（forceTool=true）にして構造化抽出を保証する。
 */
export function buildBulkSystemPrompt(session: LogiSession): string {
  return `あなたは「logi-bot」、図解思考AIファシリテーターです。
ユーザーが貼り付けた長文・メモから、合体ロボの5パーツを一括で抽出します。

【合体ロボの5パーツ構成】
① 頭（ヘッド）: コンセプト・全体メッセージ
② 胴体（ボディ）: コアシステム・本質的な仕組み
③ 右腕（ライトアーム）: 攻めの施策（2〜3項目）
④ 左腕（レフトアーム）: 守りの施策（2〜3項目）
⑤ 両足（レッグス）: 土台・基盤・ネクストアクション

━━ タスク ━━
1. 入力テキストを解析し、5パーツの各 JSON フィールドに埋められる情報を全て抽出する
2. 推測・創作は一切しない。テキストに明記されている内容のみ抽出する
3. update_session_parts ツールで抽出結果を返す（必須）
4. 応答テキストでは以下を簡潔に伝える:
   a. どのパーツを仮組みできたか（✅ で箇条書き）
   b. どのパーツが不足しているか（⚠️ で 1〜2 箇所のみ）
   c. 最初の不足箇所についての具体的な質問を 1〜2 問だけ

━━ セッション情報 ━━
タイトル: ${session.title || "（未設定）"}

━━ 応答ルール ━━
- 一度に 1〜2 問まで（不足箇所が複数あっても最初の 1 箇所のみ質問する）
- 仮組みできた部分は「いただいた情報から〇〇を仮組みしました！」とポジティブに伝える
- 抽出に自信がない情報は含めない（寧ろ質問する）`;
}

// ── マルチプロバイダ向けスキーマエクスポート ─────────────────────

/**
 * Gemini / OpenAI ツール定義で使うスキーマ（Anthropic input_schema と同一構造）。
 * プロバイダによってラッパー形式が異なるが、プロパティ定義は共通。
 */
export const SESSION_PARTS_SCHEMA: Record<string, unknown> = SESSION_UPDATE_TOOL.input_schema;
export const SESSION_UPDATE_DESCRIPTION = SESSION_UPDATE_TOOL.description;

// ── ウェルカムメッセージ ─────────────────────────────────────────

/**
 * Step 1 の最初に表示するウェルカムメッセージ。
 */
export function getWelcomeMessage(title: string): string {
  return `🤖 **logi-botへようこそ！**「${title || "新しいアイデア"}」を一緒に図解していきましょう。

これから合体ロボの **5パーツ** を組み立てていきます。

| # | パーツ | 役割 |
|---|---|---|
| 🧠 ① | 頭（ヘッド） | コンセプト・全体メッセージ |
| 🫀 ② | 胴体（ボディ） | コアシステム・本質的な仕組み |
| 💪 ③ | 右腕（ライトアーム） | 攻めの施策（2〜3項目） |
| 🛡️ ④ | 左腕（レフトアーム） | 守りの施策（2〜3項目） |
| 🦿 ⑤ | 両足（レッグス） | 土台・基盤・ネクストアクション |

---

まず **① 頭（ヘッド）** から始めましょう。

「${title || "このプレゼン"}」で **最も伝えたいコンセプト・結論** を 1〜2 文で教えてください。`;
}
