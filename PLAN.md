# PLAN.md — logi-bot 実装計画

> ステータス: **v1（2026-10-16 ユーザー承認済み）**
> 実装は `feature/*` ブランチで 1 フェーズずつ進め、main へのマージはユーザーの明示指示があるまで行わない。

---

## 1. 目標

「図解思考（ドリルダウン＋合体ロボ作戦）」を使ったAI対話型アイデア整理ツールを作る。

- **オンボーディング**（初回ガイド + バルクインプット）で利用者を迷わずスタートへ誘導
- **5ステップの質疑応答**でアイデアを段階的に構造化。抽象的な回答には「ドリルダウン質問」でツッコミ
- 各ステップ完了時に **パーツのMermaid図** を自動生成・表示
- 最終ステップで全パーツを合体した **「合体ロボ図」** を完成
- 完成物を **Markdown（.md）でコピー＆ダウンロード** できる

### 5ステップ概要

| # | ステップ名 | 身体パーツ比喩 | 目的 |
|---|---|---|---|
| 1 | コア | 胸・腹 | 現実・理想・提案の3要素を抽出 |
| 2 | ドリルダウン | 両腕 | 現実の問題と理想の成果を深掘り（数値・原因・事実） |
| 3 | What/How | 両脚 | 提案の実現手段・体制・予算を具体化 |
| 4 | 検証 | 点検 | 矛盾・ブレを洗い出し解消 |
| 5 | 合体 | 頭・台座 | イントロ＋クロージングを加えてシナリオを完成 |

### 非目標（今回やらない）
- ユーザー認証・アカウント管理
- セッションのサーバー側永続化・URL 共有（MVP は localStorage のみ）
- 音声入力・マルチモーダル対応
- Mermaid 図の手動編集UI

---

## 2. 技術方針

| 項目 | 方針 | 根拠 |
|------|------|------|
| ホスティング | Cloudflare Pages | cloudflare-ai-lab の流儀に準拠 |
| API | Pages Functions（TypeScript）+ Claude API | AI 処理をサーバーに閉じ込め API キーを隠す |
| フロント | HTML5 / CSS3 / Vanilla JS（ES Modules）ビルドなし | cloudflare-ai-lab の流儀に準拠 |
| AI モデル | `claude-sonnet-4-6` | 品質優先。ファシリテーター用途に適切 |
| Mermaid 生成 | **サーバーサイド一本化**（`functions/_lib/mermaid.ts`）| 二重管理による表示ズレを防ぐ。クライアントは受け取ったソースを Mermaid.js で描画するだけ |
| Mermaid 描画 | Mermaid.js v11（CDN）| ブラウザレンダリング。ビルド工程不要 |
| セッション状態 | クライアント **`localStorage`** | 誤ってタブを閉じても再開可能 |
| エクスポート | Markdown（.md）形式でコピー＆ダウンロード | 完成物の再利用を容易にする |
| バージョン管理 | `public/config.js` の `APP_VERSION` 単一定数 | cloudflare-ai-lab の流儀に準拠 |
| デザイン | subutomo-template 準拠（バッジ・favicon・フッター） | 既存アセット活用 |
| 認証 | MVP は認証なし | 個人利用・開発段階 |

---

## 3. ディレクトリ構成

```
logi-bot/
├─ CLAUDE.md
├─ PLAN.md / STATUS.md / README.md
├─ wrangler.toml
├─ package.json           # devDependencies: wrangler, @cloudflare/workers-types
├─ tsconfig.json
├─ .dev.vars.example      # ANTHROPIC_API_KEY / LOGI_MOCK
├─ docs/specs/
│  ├─ state-machine.md    # ★ onboarding + fast_track 追加
│  ├─ json-schema.md
│  ├─ mermaid-templates.md
│  └─ api.md
├─ .claude/skills/
│  ├─ env-guard/
│  ├─ dev-prep-checklist/
│  ├─ logi-session/       # ★ onboarding + bulk-input + drilldown-quality 追加
│  ├─ commit-guard/       # 草稿
│  └─ session-handoff/    # 草稿
├─ functions/
│  ├─ api/
│  │  ├─ chat.ts          # POST /api/chat（onboarding時のバルク抽出も担当）
│  │  ├─ advance.ts       # POST /api/advance
│  │  └─ diagram.ts       # POST /api/diagram
│  └─ _lib/
│     ├─ types.ts
│     ├─ session.ts       # ステートマシン遷移（onboarding + fast_track 対応）
│     ├─ mermaid.ts       # ★ Mermaid 生成の唯一の実装（サーバーサイド）
│     ├─ prompt.ts        # Claude API プロンプト構築（onboarding / bulk / drilldown）
│     └─ claude.ts        # Claude API クライアントラッパー
└─ public/
   ├─ index.html          # スタート画面
   ├─ session.html        # セッション画面
   ├─ config.js           # APP_VERSION / APP_NAME
   ├─ js/
   │  ├─ app.js
   │  ├─ session.js       # ステートマシン操作・localStorage 管理
   │  ├─ api.js           # fetch ラッパー
   │  └─ components/
   │     ├─ step-nav.js
   │     ├─ chat-panel.js
   │     ├─ diagram-panel.js  # サーバーから受け取った Mermaid ソースを描画するだけ
   │     └─ export-panel.js   # Markdown エクスポート（コピー + .md ダウンロード）
   ├─ css/
   │  ├─ tokens.css
   │  └─ app.css
   └─ assets/
      └─ favicon.svg / favicon-32.png / favicon-180.png
```

> **`public/js/mermaid-builder.js` は不要**（Q3決定：サーバーサイド一本化）。
> クライアントは `mermaid.render(id, source)` で描画するだけ。

---

## 4. コアシステム設計（仕様書への参照）

| 設計項目 | 仕様書 |
|---|---|
| ステートマシン（onboarding / fast_track 含む） | `docs/specs/state-machine.md` |
| セッション状態 JSON スキーマ（エクスポート含む） | `docs/specs/json-schema.md` |
| Mermaid テンプレート（サーバーサイド生成） | `docs/specs/mermaid-templates.md` |
| API エンドポイント | `docs/specs/api.md` |
| 対話進行・バルク抽出・ドリルダウン品質 | `.claude/skills/logi-session/SKILL.md` |

---

## 5. UI 設計（ワイヤーフレーム）

### スタート画面（`index.html`）

```
┌─────────────────────────────────────────┐
│  🤖 logi-bot — 図解思考アイデア整理      │
│                                         │
│  セッションのタイトルを入力:             │
│  [_____________________________]        │
│                                         │
│         [🚀 セッションを開始]           │
│                                         │
│  ── 5ステップで進みます ──              │
│  ① 胸腹(コア) ② 両腕(深掘り)          │
│  ③ 両脚(What/How) ④ 点検 ⑤ 頭台座  │
└─────────────────────────────────────────┘
```

### セッション画面（`session.html`）— オンボーディング状態

```
┌─────────────────────────────────────────────────────────┐
│ 🤖 logi-bot  ▷ {タイトル}                [リセット]      │
│                                                         │
│ ○ ─ ○ ─ ○ ─ ○ ─ ○    オンボーディング中              │
│ 1   2   3   4   5                                       │
│─────────────────────────────────────────────────────────│
│                        │                               │
│ 🤖 こんな流れで合体ロボ │  [ガイド図: 合体ロボのパーツ]  │
│    を組み立てます！     │                               │
│    ① 胸腹(コア)…      │  🦾 ①胸腹 ② 腕 ③ 脚 ④点検  │
│    まとまった資料があれ │        ⑤ 頭・台座              │
│    ばここに貼り付けてく │                               │
│    ださいね！          │                               │
│                        │                               │
│ 👤 [テキスト入力欄      │                               │
│    (長文ペースト可)]    │                               │
│    [    送信    ]      │                               │
└─────────────────────────────────────────────────────────┘
```

### セッション画面 — 通常ステップ中

```
┌─────────────────────────────────────────────────────────┐
│ 🤖 logi-bot  ▷ タイトル         [← 最初から] [リセット] │
│ ● ─ ○ ─ ○ ─ ○ ─ ○    Step 1 / 5: コア（胸・腹）       │
│─────────────────────────────────────────────────────────│
│ 左: 対話パネル          │ 右: Mermaid 図パネル           │
│                        │                               │
│ 🤖 今の現実を教えて    │ [Step完了後に図が表示される]    │
│    ください。どのくらい │                               │
│    の規模ですか？       │                               │
│                        │                               │
│ 👤 [入力欄]            │                               │
│    [   送信   ]        │                               │
│─────────────────────────────────────────────────────────│
│            [← 前のステップ]  [次のステップへ →]          │
└─────────────────────────────────────────────────────────┘
```

### complete 状態（合体ロボ図）

```
┌─────────────────────────────────────────────────────────┐
│ 🎉 完成！ — {タイトル}                                   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │   🤖 合体ロボ図（全体シナリオ）                   │   │
│  │   [Mermaid 合体ロボ図を大きく表示]               │   │
│  └─────────────────────────────────────────────────┘   │
│  [📋 Mermaidコードをコピー]  [⬇ .mdでダウンロード]      │
│                                                         │
│  ── 各ステップの図 ──                                   │
│  [Step1] [Step2] [Step3] [Step4] [Step5]（タブ切り替え）│
│                                                         │
│  [🔄 新しいセッションを開始]                             │
└─────────────────────────────────────────────────────────┘
```

---

## 6. エクスポート仕様（Markdown 形式）

### 出力フォーマット

```markdown
# {title}

> 作成日: {createdAt}

## 🎯 コア（Step 1）
- **現実**: {core.reality}
- **理想**: {core.ideal}
- **提案**: {core.proposal}

## 🔬 ドリルダウン（Step 2）
### 現実の要因
- {reality_factors[0]}
- {reality_factors[1]}

### 理想の成果
- {ideal_goals[0]}

### ギャップ
{gap_summary}

## ⚙️ What / How（Step 3）
| What（何を） | How（どうやって） |
|---|---|
| {what_items[0]} | {how_items[0]} |

## 🔍 検証（Step 4）
{contradictions があれば箇条書き、なければ「矛盾なし」}

## 🤖 合体ロボ図

```mermaid
{diagrams.final}
```

---
*Generated by logi-bot*
```

---

## 7. フェーズ構成

### フェーズ 0: 計画（完了）
- [x] CLAUDE.md / docs/specs/ / .claude/skills/ 作成
- [x] PLAN.md v0 ドラフト作成
- [x] **ユーザーレビュー / 承認**（2026-10-16。§8 の回答を反映済み）

### フェーズ 1: 土台（`feature/phase1-foundation`）
- [x] `git init -b main` + `feature/phase1-foundation` ブランチ作成
- [x] `wrangler.toml` / `package.json` / `tsconfig.json` / `.gitignore`
- [x] `.dev.vars.example`（`ANTHROPIC_API_KEY` / `LOGI_MOCK`）
- [x] `public/config.js`（`APP_VERSION: "0.1.0"`）
- [x] `functions/_lib/types.ts`（TypeScript 型定義。`onboarding` / `fast_track` 対応）
- [x] `functions/_lib/session.ts`（ステートマシン: onboarding → fast_track → step{n} 遷移含む）
- [x] `functions/_lib/mermaid.ts`（テンプレート→Mermaid 文字列生成。サーバーサイド唯一の実装）
- [x] `npm run typecheck` が通ること

### フェーズ 2: API 層（`feature/phase2-api`）
- [x] `functions/_lib/mermaid.ts` サニタイズ強化（実改行・ダブルクォート・長さ上限）
- [x] `functions/_lib/session.ts` に `mergeExtracted` を追加
- [x] `functions/_lib/prompt.ts`（Tool 定義 / ステップ別プロンプト / バルク抽出プロンプト / drilldown 品質パターン）
- [x] `functions/_lib/claude.ts`（Tool Use による構造化抽出 / MOCK モード付き）
- [x] `functions/api/chat.ts`（`POST /api/chat`。バルク抽出モード対応）
- [x] `functions/api/advance.ts`（`POST /api/advance`。Mermaid 図生成含む）
- [x] `functions/api/diagram.ts`（`POST /api/diagram`）
- [x] `scripts/test-unit.mjs` + `npm run test:unit`（28 テスト全通過）
- [x] `scripts/smoke-api.mjs` + `npm run smoke`（MOCK サーバーで 16 ケース全通過）
- [x] `npm run typecheck` エラー 0 件

### フェーズ 3: フロントエンド（`feature/phase3-ui`）
- [ ] `public/index.html`（スタート画面）
- [ ] `public/session.html`（セッション画面: オンボーディング + 5ステップ + complete）
- [ ] `public/js/app.js` / `session.js`（localStorage 管理含む）/ `api.js`
- [ ] `public/js/components/`（step-nav / chat-panel / diagram-panel / export-panel）
- [ ] `public/css/`（tokens.css / app.css）
- [ ] `wrangler pages dev` + ブラウザ確認依頼

### フェーズ 4: エクスポートと complete 画面（`feature/phase4-export`）
- [ ] Markdown エクスポート（コピー + `.md` ダウンロード）
- [ ] complete 状態の画面（タブ切り替え・合体ロボ図大表示）
- [ ] モバイル対応（タップ 44px・640px 以下縦積み）

### フェーズ 5: 公開準備（`feature/phase5-release`）
- [ ] API 認証（`X-Lab-Key` ⇔ `LOGI_API_KEY`）
- [ ] 入力バリデーション・XSS 対策
- [ ] Cloudflare Pages デプロイ・動作確認
- [ ] README.md 整備

---

## 8. 決定事項

| 日付 | 決定内容 | 理由 |
|---|---|---|
| 2026-10-16 | SDD に従い PLAN.md 承認まで実装コードを生成しない | ユーザー指示 |
| 2026-10-16 | HTML は `index.html` + `session.html` の 2 ファイル分割 | URL 共有・ブラウザ履歴に有利（Q1） |
| 2026-10-16 | セッション永続化は `localStorage`（キー: `logiSession_<id>`） | タブを閉じても再開できるよう（Q2） |
| 2026-10-16 | Mermaid 生成は `functions/_lib/mermaid.ts` サーバーサイド一本化 | 二重管理による表示ズレを防ぐ（Q3）|
| 2026-10-16 | AI モデルは `claude-sonnet-4-6` | 品質優先（Q4） |
| 2026-10-16 | デザインは subutomo-template 準拠（バッジ・favicon） | 既存アセット活用（Q5） |
| 2026-10-16 | オンボーディング状態（ガイド表示＋バルクインプット受付）を state machine に追加 | 利用者を迷わずスタートへ誘導 |
| 2026-10-16 | バルクインプット時は AI が JSON フィールドを一括抽出し最初の不足ステップへ遷移 | ユーザー指示（ファストトラック処理） |
| 2026-10-16 | ドリルダウン品質担保のため数値化・原因追求・ROI 等の深掘り質問パターンをプロンプトに組み込む | 永田豊志「図解思考」の肝を実装するため |
| 2026-10-16 | エクスポートは Markdown（.md）形式でコピー＆ダウンロード | 完成物の再利用容易化（Q2追加） |
