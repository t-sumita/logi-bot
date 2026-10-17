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
      core: {
        type: "object",
        description: "Step 1: 現実・理想・提案のコア（各 1〜2 文・最大 200 文字）",
        properties: {
          reality:  { type: "string", description: "現実の状況" },
          ideal:    { type: "string", description: "理想の状態" },
          proposal: { type: "string", description: "提案・アイデア" },
        },
      },
      drilldown: {
        type: "object",
        description: "Step 2: ドリルダウン（各要素最大 100 文字・配列最大 6 個）",
        properties: {
          reality_factors: {
            type: "array",
            items: { type: "string" },
            description: "現実の問題点・制約",
          },
          ideal_goals: {
            type: "array",
            items: { type: "string" },
            description: "理想達成時の具体的成果",
          },
          gap_summary: { type: "string", description: "現実と理想の最大のギャップ（最大 150 文字）" },
        },
      },
      what_how: {
        type: "object",
        description: "Step 3: What/How（what_items と how_items は同数・各要素最大 100 文字）",
        properties: {
          what_items: {
            type: "array",
            items: { type: "string" },
            description: "変えること・作ること・やめること",
          },
          how_items: {
            type: "array",
            items: { type: "string" },
            description: "実行手段（what_items と対応、同数にすること）",
          },
        },
      },
      verification: {
        type: "object",
        description: "Step 4: 矛盾・ブレの検証結果",
        properties: {
          is_consistent: { type: "boolean", description: "全体の論理整合性" },
          contradictions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                description: { type: "string" },
                location:    { type: "string" },
                resolution:  { type: "string" },
              },
              required: ["description", "location", "resolution"],
            },
          },
        },
      },
      frame: {
        type: "object",
        description: "Step 5: イントロとクロージング",
        properties: {
          intro: {
            type: "object",
            properties: {
              audience: { type: "string", description: "対象聴衆・読者" },
              hook:     { type: "string", description: "フック・冒頭の一文（最大 150 文字）" },
            },
          },
          closing: {
            type: "object",
            properties: {
              cta: { type: "string", description: "Call to Action（最大 150 文字）" },
            },
          },
          title: { type: "string", description: "全体タイトル・キャッチコピー（最大 60 文字）" },
        },
      },
    },
  },
};

// ── 現在のセッション状態をプロンプト用にシリアライズ ────────────

function serializeParts(parts: SessionParts): string {
  const lines: string[] = [];

  const { core, drilldown, what_how, verification, frame } = parts;
  if (core.reality)   lines.push(`【現実】${core.reality}`);
  if (core.ideal)     lines.push(`【理想】${core.ideal}`);
  if (core.proposal)  lines.push(`【提案】${core.proposal}`);

  if (drilldown.reality_factors.length > 0)
    lines.push(`【現実の要因】\n${drilldown.reality_factors.map((f) => `  - ${f}`).join("\n")}`);
  if (drilldown.ideal_goals.length > 0)
    lines.push(`【理想の成果】\n${drilldown.ideal_goals.map((g) => `  - ${g}`).join("\n")}`);
  if (drilldown.gap_summary)
    lines.push(`【ギャップ】${drilldown.gap_summary}`);

  if (what_how.what_items.length > 0) {
    const pairs = what_how.what_items.map(
      (w, i) => `  - What: ${w}  ／  How: ${what_how.how_items[i] ?? "（未入力）"}`
    );
    lines.push(`【What/How】\n${pairs.join("\n")}`);
  }

  if (verification.contradictions.length > 0) {
    lines.push(
      `【矛盾・ブレ】\n${verification.contradictions
        .map((c) => `  - ${c.description}（解決: ${c.resolution || "未解決"}）`)
        .join("\n")}`
    );
  }
  if (verification.is_consistent) lines.push("【整合性】✅ 確認済み");

  if (frame.intro.hook)   lines.push(`【イントロ/フック】${frame.intro.hook}`);
  if (frame.closing.cta)  lines.push(`【クロージング/CTA】${frame.closing.cta}`);
  if (frame.title)        lines.push(`【タイトル】${frame.title}`);

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
  onboarding: {
    displayName: "オンボーディング", index: 0,
    purpose: "利用者を迎え、進め方を案内し、既存情報があれば受け取る",
    requirements: "テーマ名・タイトル（または既存情報の貼り付け）",
    nextHint: "短い入力の場合は Step 1 へ誘導する。",
  },
  step1_core: {
    displayName: "Step 1: コア（胸・腹）", index: 1,
    purpose: "現実・理想・提案の3要素を 1〜2 文で抽出する",
    requirements: "core.reality / core.ideal / core.proposal",
    nextHint: "3要素が揃ったら「次へ」ボタンを案内する。",
  },
  step2_drilldown: {
    displayName: "Step 2: ドリルダウン（両腕）", index: 2,
    purpose: "現実の問題・制約と理想の成果を具体化・数値化する",
    requirements: "drilldown.reality_factors（≥1）/ drilldown.ideal_goals（≥1）",
    nextHint: "具体的な数値や原因が揃ったら「次へ」を案内する。",
  },
  step3_what_how: {
    displayName: "Step 3: What/How（両脚）", index: 3,
    purpose: "提案の実現手段（何を・どうやって）を対にして具体化する",
    requirements: "what_how.what_items / what_how.how_items（同数・各≥1）",
    nextHint: "What と How が揃ったら「次へ」を案内する。",
  },
  step4_verify: {
    displayName: "Step 4: 検証（点検）", index: 4,
    purpose: "ステップ1〜3 の要素間の矛盾・ブレを洗い出し解消する",
    requirements: "verification.is_consistent = true",
    nextHint: "整合性確認が取れたら「次へ」を案内する。",
  },
  step5_combine: {
    displayName: "Step 5: 合体（頭・台座）", index: 5,
    purpose: "イントロ（フック）とクロージング（CTA）を加えてシナリオを完成させる",
    requirements: "frame.intro.hook / frame.closing.cta",
    nextHint: "イントロとクロージングが揃ったら「完成」を案内する。",
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

  let substepGuide = "";
  if (step === "step1_core") {
    const { reality, ideal, proposal } = session.parts.core;
    if (!reality.trim()) {
      substepGuide = `
━━ サブステップガイド ━━
現在のフェーズ: 【現実】を埋める（step1_substep:reality）
まず「現在の状況・問題点（現実）」だけを聞いてください。理想・提案はまだ聞かないこと。`;
    } else if (!ideal.trim()) {
      substepGuide = `
━━ サブステップガイド ━━
現在のフェーズ: 【理想】を埋める（step1_substep:ideal）
現実は確認済みです。次に「理想の状態・目標」だけを聞いてください。提案はまだ聞かないこと。`;
    } else if (!proposal.trim()) {
      substepGuide = `
━━ サブステップガイド ━━
現在のフェーズ: 【提案】を埋める（step1_substep:proposal）
現実と理想は確認済みです。次に「解決策・提案」を聞いてください。`;
    } else {
      substepGuide = `
━━ サブステップガイド ━━
現在のフェーズ: 3要素が揃いました（step1_substep:done）
内容を簡潔にまとめて確認を取り、「次へ」ボタンを案内してください。`;
    }
  }

  return `あなたは「logi-bot」、永田豊志の図解思考メソッドに基づくAIファシリテーターです。
利用者のアイデアを5ステップで構造化し、合体ロボMermaid図を完成させます。

━━ 現在のステップ ━━
${stepLabel}
目的: ${meta?.purpose ?? "対話を進める"}
このステップで収集すべき情報: ${meta?.requirements ?? ""}

━━ 収集済み情報 ━━
${serializeParts(session.parts)}
${substepGuide}
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
ユーザーが貼り付けた長文・メモから、図解パーツを一括で抽出します。

━━ タスク ━━
1. 入力テキストを解析し、Step 1〜5 の各 JSON フィールドに埋められる情報を全て抽出する
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

// ── オンボーディング用ウェルカムメッセージ ───────────────────────

/**
 * オンボーディング画面に最初に表示するウェルカムメッセージ。
 * サーバー呼び出し不要な静的テキスト。
 */
export function getOnboardingWelcome(title: string): string {
  return `🤖 **logi-botへようこそ！**「${title || "新しいアイデア"}」を一緒に図解していきましょう。

これから5つのパーツを組み立てて「**合体ロボ図**（プレゼン構想）」を完成させます。

| # | パーツ | 役割 |
|---|---|---|
| ① | 胸・腹（コア） | 現実・理想・提案を 1〜2 文で |
| ② | 両腕（ドリルダウン） | 現実の問題を深掘り／理想の成果を具体化 |
| ③ | 両脚（What/How） | 何をどうやって実現するか |
| ④ | 点検 | 矛盾・ブレを洗い出して解消 |
| ⑤ | 頭・台座 | イントロとクロージングで全体を完成 |

---

💡 **テーマ名だけでも始められますが**、企画メモ・箇条書き・議事録・頭の中のモヤモヤした長文など、すでに手元に情報があれば**ここに貼り付けてください**。そこから図解パーツを自動で仮組みします！

何から始めますか？`;
}
