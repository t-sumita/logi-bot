# 仕様: API設計（Pages Functions）

> 根拠: PLAN.md §5。実装: `functions/api/`

## エンドポイント一覧

| メソッド | パス | 役割 |
|---|---|---|
| `POST` | `/api/chat` | ステップ内の対話 + `onboarding` 時のバルク一括抽出も担当 |
| `POST` | `/api/advance` | ステップ完了・次ステップ遷移（Mermaid 図生成を含む） |
| `POST` | `/api/diagram` | 指定ステップの Mermaid 図を（再）生成 |

> **Mermaid 生成の責務**: `functions/_lib/mermaid.ts` がサーバーサイドの唯一の実装。
> クライアントは受け取った Mermaid ソース文字列を Mermaid.js で描画するだけ。

---

## `POST /api/chat`

ステップ内でのユーザー入力を AI に渡し、ファシリテーター応答を返す。
`step: "onboarding"` かつメッセージが 100 文字超の場合は **バルク抽出モード** として動作する。

### リクエスト

```
POST /api/chat
Content-Type: application/json
```

```jsonc
{
  "session": { /* LogiSession の現在状態 */ },
  "message": "利用者のメッセージ（短文 or 長文メモ）",
  "step": "onboarding"  // または "step1_core" 等
}
```

### レスポンス（200）— 通常モード

```jsonc
{
  "ok": true,
  "reply": "AIの応答テキスト",
  "extracted": {
    // このターンで抽出できたフィールド（部分的な SessionParts）
    "core": { "reality": "抽出されたテキスト" }
  },
  "session": { /* 更新後の LogiSession */ }
}
```

### レスポンス（200）— バルク抽出モード（`step: "onboarding"` + 長文）

```jsonc
{
  "ok": true,
  "reply": "いただいた情報から、ここまで図解パーツを仮組みしました！\n[不足している〇〇について教えてください]",
  "fast_track": true,
  "extracted": {
    // 抽出できたすべてのフィールドを一括で返す
    "core":      { "reality": "...", "ideal": "...", "proposal": "..." },
    "drilldown": { "reality_factors": ["..."], "ideal_goals": ["..."], "gap_summary": "..." },
    "what_how":  { "what_items": ["..."], "how_items": ["..."] }
    // 抽出できなかったフィールドは省略（クライアントがマージして不足を判定）
  },
  "first_incomplete_step": "step3_what_how",  // 遷移先（最初の不足ステップ）
  "diagrams": {
    // 抽出済みステップ分の仮Mermaid図をサーバーで一括生成して返す
    "step1": "flowchart TB ...",
    "step2": "flowchart LR ..."
  },
  "session": { /* 更新後の LogiSession（step が first_incomplete_step に設定済み）*/ }
}
```

### エラーレスポンス

```jsonc
{ "ok": false, "error": { "code": "...", "message": "..." } }
```

| HTTP | code | 条件 |
|---|---|---|
| 400 | `invalid_input` | JSON 不正 / 必須フィールド欠落 |
| 422 | `invalid_step` | 指定ステップがステートマシン上不正 |
| 500 | `server_misconfigured` | オーナーモードで `GEMINI_API_KEY` 未設定 |
| 500 | `internal_error` | 想定外の例外 |
| 502 | `upstream_error` | Claude API エラー |

---

## `POST /api/advance`

現在ステップの完了判定を行い、ガード条件を満たせば次ステップに遷移する。
遷移と同時に現在ステップの Mermaid 図を生成して返す。

### リクエスト

```jsonc
{
  "session": { /* LogiSession */ },
  "event": "NEXT"  // "NEXT" | "BACK" | "RESET"
}
```

### レスポンス（200）

```jsonc
{
  "ok": true,
  "session": { /* 遷移後の LogiSession（step / diagrams が更新済み） */ },
  "diagram": "生成された Mermaid ソース（NEXT/BACK 時のみ）"
}
```

### ガード不満足時（200 だが遷移しない）

```jsonc
{
  "ok": false,
  "error": { "code": "guard_failed", "message": "現実を入力してください" },
  "missing_fields": ["parts.core.reality"]
}
```

---

## `POST /api/diagram`

指定ステップの Mermaid 図を（再）生成する。

### リクエスト

```jsonc
{
  "session": { /* LogiSession */ },
  "step": "step1_core"  // または "final"
}
```

### レスポンス（200）

```jsonc
{
  "ok": true,
  "diagram": "flowchart TB\n  R[\"現実\"] ...",
  "step": "step1_core"
}
```

---

## AI プロンプト設計方針

### システムプロンプト構造

```
あなたは「logi-bot」、永田豊志の図解思考メソッドに基づくファシリテーターです。
利用者のアイデアを5ステップで構造化し、合体ロボMermaid図を完成させます。

現在のステップ: {stepName}（{stepIndex}/5）
ステップの目的: {stepDescription}

【収集済み情報】
{serialized_parts}

【このステップで収集すべき情報】
{step_requirements}

【応答ルール】
- 一度に1〜2問まで質問する
- 利用者の回答を要約して「〇〇ということですね？」と確認を取る
- 回答から抽出した情報を <extracted> タグで返す
- 次のステップへの準備が整ったら「準備ができました。「次へ」ボタンを押してください」と伝える

【ドリルダウン品質: 抽象的な回答にはツッコミを入れること】
以下のパターンで深掘り質問を行う:
- 数値化: 「どのくらいですか？（件数・%・金額・時間で）」
- 具体化: 「具体的には誰が・どこで・いつ起きていますか？」
- 原因追求: 「なぜそうなっているのでしょう？根本原因は何でしょうか？」
- 導入前後: 「この提案が実現したら、導入前と比べて何がどう変わりますか？」
- ROI: 「このアクションにかかるコストと、期待できるリターンはどのくらいですか？」
- 優先度: 「複数の要因がある場合、最も重要なものはどれですか？」
- 証拠: 「それを裏付けるデータや事例はありますか？」
```

### バルク抽出モード専用プロンプト

`onboarding` ステップかつ長文入力時は以下を追加:

```
【バルク抽出モード】
以下のテキストから、Step 1〜5 の各 JSON フィールドに
マッピングできる情報をすべて抽出してください。
抽出できないフィールドは省略（null/空にしない）。
必ず <extracted> タグで返し、その後に仮組み結果の報告と
不足フィールドへのピンポイント質問を続けること。

ユーザーテキスト:
{message}
```

### `<extracted>` タグ形式

```xml
<extracted>
{"core": {"reality": "抽出された現実の説明"}}
</extracted>
```

Claude API レスポンスからこのタグを正規表現で抽出し、セッション状態にマージする。
バルク抽出時は `SessionParts` の複数フィールドを一度に返すことがある。

### モデル設定

| 設定 | 値 |
|---|---|
| モデル | オーナーモード: Gemini `gemini-2.5-flash`（`llm.ts` の `DEFAULT_MODELS.gemini`）／ BYOK: 利用者指定（既定は `claude-sonnet-4-6`） |
| max_tokens | 1024（通常の応答）/ 2048（合体ロボ図生成時） |
| temperature | 0.7 |
| システムプロンプト | 毎リクエスト動的構築 |

---

## 認証方針

MVP では認証なし（全エンドポイントを全世界公開）。
将来の公開時に `X-Lab-Key` + `LOGI_API_KEY` の合言葉方式を追加する（cloudflare-ai-lab の流儀に準拠）。

---

## MOCK モード

`LOGI_MOCK=1`（`.dev.vars`）で有効。
Claude API を呼ばず、固定のデモ応答を返す。
開発中の UI 確認に使用する。
