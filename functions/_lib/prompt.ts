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
        description: "Step 1: 胴体（コア）— 現実・理想・提案（各 1〜2 文・最大 200 文字）",
        properties: {
          reality:  { type: "string", description: "現実の状況・課題" },
          ideal:    { type: "string", description: "理想の状態・目標" },
          proposal: { type: "string", description: "提案・解決策の核" },
        },
      },
      drilldown: {
        type: "object",
        description: "Step 2: 左腕・右腕（ドリルダウン）— 各要素最大 100 文字・配列最大 6 個",
        properties: {
          reality_factors: {
            type: "array",
            items: { type: "string" },
            description: "現実の問題点・制約・根本原因",
          },
          ideal_goals: {
            type: "array",
            items: { type: "string" },
            description: "理想達成時の具体的成果・数値目標",
          },
          gap_summary: { type: "string", description: "現実と理想の最大のギャップ（最大 150 文字）" },
        },
      },
      what_how: {
        type: "object",
        description: "Step 3: 両足（2本柱）— what_items と how_items は同数・各要素最大 100 文字",
        properties: {
          what_items: {
            type: "array",
            items: { type: "string" },
            description: "変えること・作ること・やめること（What）",
          },
          how_items: {
            type: "array",
            items: { type: "string" },
            description: "実行手段・体制・予算・時期（How、what_items と対応・同数）",
          },
        },
      },
      verification: {
        type: "object",
        description: "Step 4: 合体前の点検 — 矛盾・ブレの検証結果",
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
        description: "Step 5: 頭・台座 — イントロとクロージング",
        properties: {
          intro: {
            type: "object",
            properties: {
              audience: { type: "string", description: "対象聴衆・読者" },
              hook:     { type: "string", description: "イントロ・フック・冒頭の一文（最大 150 文字）" },
            },
          },
          closing: {
            type: "object",
            properties: {
              cta: { type: "string", description: "クロージング・Call to Action（最大 150 文字）" },
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
  // 番号付きノードで表記（図と一致させる）
  if (core.reality)   lines.push(`【[1] 現実】${core.reality}`);
  if (core.ideal)     lines.push(`【[2] 理想】${core.ideal}`);
  if (core.proposal)  lines.push(`【[3] 提案】${core.proposal}`);

  if (drilldown.reality_factors.length > 0)
    lines.push(`【[4] 現実の詳細（左腕）】\n${drilldown.reality_factors.map((f, i) => `  [4-${i+1}] ${f}`).join("\n")}`);
  if (drilldown.ideal_goals.length > 0)
    lines.push(`【[5] 理想の詳細（右腕）】\n${drilldown.ideal_goals.map((g, i) => `  [5-${i+1}] ${g}`).join("\n")}`);
  if (drilldown.gap_summary)
    lines.push(`【ギャップ】${drilldown.gap_summary}`);

  if (what_how.what_items.length > 0) {
    const pairs = what_how.what_items.map(
      (w, i) => `  [6-${i+1}] What: ${w}  ／  [7-${i+1}] How: ${what_how.how_items[i] ?? "（未入力）"}`
    );
    lines.push(`【[6]/[7] What/How（両足）】\n${pairs.join("\n")}`);
  }

  if (verification.contradictions.length > 0) {
    lines.push(
      `【矛盾・ブレ（点検）】\n${verification.contradictions
        .map((c) => `  - ${c.description}（解決: ${c.resolution || "未解決"}）`)
        .join("\n")}`
    );
  }
  if (verification.is_consistent) lines.push("【整合性】✅ 確認済み");

  if (frame.intro.hook)   lines.push(`【[0] イントロ/フック（頭）】${frame.intro.hook}`);
  if (frame.closing.cta)  lines.push(`【[8] クロージング/CTA（台座）】${frame.closing.cta}`);
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
  step1_core: {
    displayName: "Step 1: 胴体（コア）", index: 1,
    purpose: "現実・理想・提案の3要素を1〜2文で抽出する。**[1]現実 → [2]理想 → [3]提案** の順に1つずつ確認する（一度にまとめて聞かない）",
    requirements: "[1]core.reality / [2]core.ideal / [3]core.proposal",
    nextHint: "3要素が揃ったら「[1]現実・[2]理想・[3]提案の関係で意図と違う部分はありますか？」と途中確認し、OKなら「次へ」ボタンを案内する。",
  },
  step2_drilldown: {
    displayName: "Step 2: 左腕・右腕", index: 2,
    purpose: "[4-N]現実の詳細（事実・原因・数値）と[5-N]理想の詳細（達成判断基準・数値目標）を引き出す。件数は動的に増減する",
    requirements: "[4]drilldown.reality_factors（≥1）/ [5]drilldown.ideal_goals（≥1）",
    nextHint: "詳細が揃ったら「[4]と[5]の関係を確認した図です。関係の誤りや追加・削除したい番号はありますか？」と途中確認する。",
  },
  step3_what_how: {
    displayName: "Step 3: 両足（2本柱）", index: 3,
    purpose: "[6-N]What（何をするか：具体施策）と[7-N]How（どう実現するか：ヒト・モノ・カネ・時期）を引き出す",
    requirements: "[6]what_how.what_items / [7]what_how.how_items（同数・各≥1）",
    nextHint: "What と How が揃ったら「詳細を加えた図です。関係の誤りや追加・削除したい番号はありますか？」と途中確認する。",
  },
  step4_verify: {
    displayName: "Step 4: 合体前の点検", index: 4,
    purpose: "[1]〜[8] 全要素の論理整合性を確認。課題の原因モレ・課題と提案のブレ・提案で理想の数値に届くかを点検する",
    requirements: "verification.is_consistent = true",
    nextHint: "整合性確認が取れたら「次へ」を案内する。",
  },
  step5_combine: {
    displayName: "Step 5: 頭・台座", index: 5,
    purpose: "[0]イントロ（フック）と[8]クロージング（CTA）を加えて合体ロボを完成させる",
    requirements: "[0]frame.intro.hook / [8]frame.closing.cta",
    nextHint: "[0]と[8]が揃ったら「完成」を案内する。",
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
現在のフェーズ: **[1] 現実** を聞く
「今、どんな状況や問題がありますか？」と聞いてください。
数値・頻度・規模感があれば深掘りしてください。[2]理想・[3]提案はまだ聞かないこと。`;
    } else if (!ideal.trim()) {
      substepGuide = `
━━ サブステップガイド ━━
現在のフェーズ: **[2] 理想** を聞く
[1]現実は確認済みです。「理想の状態はどんなイメージですか？なぜ変えたいですか？」と聞いてください。
[3]提案はまだ聞かないこと。`;
    } else if (!proposal.trim()) {
      substepGuide = `
━━ サブステップガイド ━━
現在のフェーズ: **[3] 提案** を聞く
[1]現実と[2]理想は確認済みです。「そのギャップを埋める解決策の核は？」と聞いてください。`;
    } else {
      substepGuide = `
━━ サブステップガイド ━━
現在のフェーズ: **3要素が揃いました — 途中確認**
「**[1]現実**・**[2]理想**・**[3]提案** の関係図ができました。意図と違う部分や修正したい点はありますか？」
と確認を取ってください。OKなら「次へ」ボタンで Step 2 に進めると案内してください。`;
    }
  }

  return `あなたは「logi-bot」、永田豊志の図解思考メソッドに基づくAIファシリテーターです。
利用者のアイデアを5ステップで構造化し、合体ロボMermaid図を完成させます。

【合体ロボの9ノード（番号で参照）】
[0] 頭（イントロ）   → frame.intro.hook
[1] 現実（課題）     → core.reality
[2] 理想（ゴール）   → core.ideal
[3] 提案（解決策核） → core.proposal
[4-N] 左腕: 現実の詳細   → drilldown.reality_factors[]
[5-N] 右腕: 理想の詳細   → drilldown.ideal_goals[]
[6-N] 左足: What（施策） → what_how.what_items[]
[7-N] 右足: How（実現）  → what_how.how_items[]
[8] 台座（クロージング） → frame.closing.cta

━━ 現在のステップ ━━
${stepLabel}
目的: ${meta?.purpose ?? "対話を進める"}
収集すべき情報: ${meta?.requirements ?? ""}

━━ 収集済み情報 ━━
${serializeParts(session.parts)}
${substepGuide}
━━ 応答ルール ━━
1. **1ターンにつき1〜2問まで**（質問を詰め込まない）
2. 利用者の回答を「[番号]〇〇ということですね？」と番号付きで確認する
3. 確認できた情報は必ず update_session_parts ツールで返す
4. **AIが推測した内容には「（AI案）」と明記する**
5. ユーザーが「まだ分からない」「未定」と言った項目は「（未確認）」とテキストに付記する
6. ${meta?.nextHint ?? ""}
7. **update_session_parts を呼ぶときも、必ず利用者向けの応答テキストを同時に返す**（ツール呼び出しだけで本文を空にしない）

━━ 修正・割り込み発言の扱い ━━
利用者が直前の内容の修正・変更・確認（例:「さっきの○○を直したい」「[4-2]を変えて」「これで合ってる？」）を求めてきた場合は、
**無理に次のステップや次の質問へ進めない。**
1. 要望に応じて該当ノードの内容を update_session_parts で更新する（確認だけの質問なら更新せず回答する）
2. 何をどう更新した／どう答えたかを [番号] 付きで簡潔に伝える
3. そのうえで、現在のステップの質問・確認に戻る（または「次のステップへ」を案内する）
入力が短い・連続している・仕様外でも、空の応答を返さず、必ず何らかの返答をすること。

${DRILLDOWN_GUIDANCE}`;
}

// ── バルク抽出用システムプロンプト ───────────────────────────────

/**
 * バルクインプット（長文貼り付け）時のシステムプロンプトを構築する。
 * Tool Use を必須（forceTool=true）にして構造化抽出を保証する。
 */
export function buildBulkSystemPrompt(session: LogiSession): string {
  return `あなたは「logi-bot」、図解思考AIファシリテーターです。
ユーザーが貼り付けた長文・メモから、合体ロボの5ステップを一括で抽出します。

【合体ロボの5ステップ構成】
① 胴体（コア）: 現実・理想・提案
② 左腕・右腕: 現実の問題点・理想の成果（ドリルダウン）
③ 両足（2本柱）: What（何を）/ How（どうやって）
④ 合体前の点検: 矛盾・ブレの検証
⑤ 頭・台座: イントロ（フック）・クロージング（CTA）

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
- 抽出に自信がない情報は含めない（寧ろ質問する）
- update_session_parts を呼ぶときも、必ず利用者向けの応答テキストを同時に返す（本文を空にしない）
- 利用者が内容の修正・変更・確認を求めている場合は、無理に先へ進めず、要望に応じて更新・回答してから次に進む`;
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

右の図に **[0]〜[8]** の9つのパーツが表示されています。対話が進むたびにリアルタイムで更新されます。
図の各ボックスをクリックすると、その番号の修正指示を入力欄に挿入できます。

| 番号 | パーツ | 役割 |
|------|--------|------|
| [1][2][3] | 🫀 胴体（コア） | 現実→理想→提案 |
| [4-N][5-N] | 💪🛡️ 左腕・右腕 | 現実・理想の深掘り |
| [6-N][7-N] | 🦿 両足（2本柱） | What / How |
| — | 🔍 合体前の点検 | 矛盾・ブレの検証 |
| [0][8] | 🧠🗂️ 頭・台座 | イントロ・クロージング |

---

まず **Step 1: 胴体（コア）** から始めます。

**[1] 現実（いま起きている課題）** を教えてください。数値・頻度・規模感があればぜひ。`;
}
