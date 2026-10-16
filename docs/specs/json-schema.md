# 仕様: セッション状態 JSONスキーマ

> 根拠: PLAN.md §4。実装: `functions/_lib/types.ts` / `public/js/session.js`

## トップレベル: `LogiSession`

```typescript
interface LogiSession {
  sessionId: string;        // UUID v4
  title: string;            // セッションタイトル（利用者が最初に入力）
  step: StepName;           // 現在のステップ
  status: SessionStatus;
  createdAt: string;        // ISO 8601
  updatedAt: string;        // ISO 8601

  fast_track: boolean;      // true = バルクインプットによるファストトラック経由
  onboarding_complete: boolean;  // true = オンボーディング通過済み

  parts: SessionParts;
  diagrams: SessionDiagrams;
  history: ConversationTurn[];
}

type StepName =
  | "idle"
  | "onboarding"
  | "step1_core"
  | "step2_drilldown"
  | "step3_what_how"
  | "step4_verify"
  | "step5_combine"
  | "complete";

type SessionStatus = "in_progress" | "complete" | "error";
```

## `SessionParts`

```typescript
interface SessionParts {
  core: CorePart;
  drilldown: DrilldownPart;
  what_how: WhatHowPart;
  verification: VerifyPart;
  frame: FramePart;
}
```

### `CorePart`（Step 1 で収集）

```typescript
interface CorePart {
  reality: string;    // 現実の状況（1〜2文）
  ideal: string;      // 理想の状態（1〜2文）
  proposal: string;   // 提案・アイデア（1〜2文）
}
```

### `DrilldownPart`（Step 2 で収集）

```typescript
interface DrilldownPart {
  reality_factors: string[];  // 現実の問題点・制約（2〜4個）
  ideal_goals: string[];      // 理想達成時の具体的成果（2〜4個）
  gap_summary: string;        // 最大のギャップの要約（1文）
}
```

### `WhatHowPart`（Step 3 で収集）

```typescript
interface WhatHowPart {
  what_items: string[];       // 変えること・作ること（2〜4個）
  how_items: string[];        // 実行手段（what_items と同数・対応）
  who_when: WhoWhen[];        // 担当者・時期（任意、0個でも可）
}

interface WhoWhen {
  what_index: number;         // what_items の対応インデックス
  who?: string;               // 担当者（任意）
  when?: string;              // 時期（任意）
}
```

### `VerifyPart`（Step 4 で収集）

```typescript
interface VerifyPart {
  contradictions: Contradiction[];  // 矛盾・ブレのリスト（0個でも可）
  is_consistent: boolean;           // 全体整合性（矛盾解消後 true）
}

interface Contradiction {
  description: string;   // 矛盾・ブレの内容
  location: string;      // どのステップ間の矛盾か（例: "step1_core ↔ step2_drilldown"）
  resolution: string;    // 解決方法（空の場合は未解決）
}
```

### `FramePart`（Step 5 で収集）

```typescript
interface FramePart {
  intro: {
    audience: string;    // 対象聴衆・読者
    hook: string;        // フック・冒頭の一文
  };
  closing: {
    cta: string;         // Call to Action（聞き手への行動促進）
  };
  title: string;         // 全体タイトル・キャッチコピー（任意）
}
```

## `SessionDiagrams`

```typescript
interface SessionDiagrams {
  step1?: string;   // Step 1 完了時に生成した Mermaid ソース
  step2?: string;   // Step 2 完了時
  step3?: string;   // Step 3 完了時
  step4?: string;   // Step 4 完了時
  step5?: string;   // Step 5 完了時（合体ロボ図）
  final?: string;   // complete 遷移時の最終合体ロボ図（= step5 と同じことが多い）
}
```

## `ConversationTurn`

```typescript
interface ConversationTurn {
  role: "assistant" | "user";
  content: string;
  step: StepName;           // このターンが属するステップ
  timestamp: string;        // ISO 8601
  extracted?: Partial<SessionParts>;  // このターンで抽出したフィールド（任意）
}
```

## バリデーション規則

| フィールド | 制約 |
|---|---|
| `reality` / `ideal` / `proposal` | 最大 200 文字 |
| `reality_factors` / `ideal_goals` | 各要素 最大 100 文字、リスト上限 6 個 |
| `what_items` / `how_items` | 同数であること、各要素 最大 100 文字、リスト上限 6 個 |
| `gap_summary` / `hook` / `cta` | 最大 150 文字 |
| `title` | 最大 60 文字 |
| `history` | 1 セッション上限 100 ターン |

## クライアント側の永続化

- **`localStorage`** に `logiSession_<sessionId>` キーで JSON 文字列として保存（タブを閉じても再開可能）
- セッション一覧インデックス: `logiSessionList`（`string[]` of sessionId）で複数セッションを管理
- `RESET` イベント発火時に `localStorage.removeItem("logiSession_<sessionId>")` でクリア
- 起動時: `logiSessionList` から最新セッションを復元するか、新規作成するかを選択

## エクスポート: `SessionExport`

完成した合体ロボ図と整理されたテキストを Markdown 形式でエクスポートする。

```typescript
interface SessionExport {
  title: string;
  createdAt: string;
  parts: SessionParts;
  diagrams: SessionDiagrams;
}
```

### Markdown 出力関数

```typescript
function toMarkdown(session: SessionExport): string
```

- `title`、各ステップの `parts` 内容を見出しと箇条書きで整形
- 最終ステップに `diagrams.final` を ` ```mermaid ... ``` ` ブロックで埋め込む
- 詳細フォーマットは `PLAN.md §6` を参照
- クライアント側でのみ使用（サーバー呼び出し不要な純粋関数）

### ダウンロード処理

```typescript
function downloadMarkdown(content: string, filename: string): void {
  // Blob + URL.createObjectURL + <a> タグのクリックで .md をダウンロード
}
```

## 初期値（`idle` 状態）

```json
{
  "sessionId": "<uuid>",
  "title": "",
  "step": "idle",
  "status": "in_progress",
  "fast_track": false,
  "onboarding_complete": false,
  "createdAt": "<ISO8601>",
  "updatedAt": "<ISO8601>",
  "parts": {
    "core":         { "reality": "", "ideal": "", "proposal": "" },
    "drilldown":    { "reality_factors": [], "ideal_goals": [], "gap_summary": "" },
    "what_how":     { "what_items": [], "how_items": [], "who_when": [] },
    "verification": { "contradictions": [], "is_consistent": false },
    "frame": {
      "intro":   { "audience": "", "hook": "" },
      "closing": { "cta": "" },
      "title":   ""
    }
  },
  "diagrams": {},
  "history": []
}
```
