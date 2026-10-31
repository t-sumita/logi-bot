# 🤖 logi-bot

**図解思考（ドリルダウン＋合体ロボ作戦）でアイデアをプレゼン構想に整理する、対話型 AI エージェント。**

5ステップの一問一答を通じて、バラバラなアイデアを「合体ロボ図（全体シナリオ図）」へと昇華させます。

**[▶ デモを試す — logi-bot.pages.dev](https://logi-bot.pages.dev)**

---

## なにができるのか

永田豊志氏の図解メソッド（*プレゼンがうまい人の「図解思考」の技術*）を AI ファシリテーターで再現します。
チャットで質問に答えるだけで、ロジカルな思考図が自動生成されます。

```
テーマ名を入力 → 5ステップの質疑応答 → 各パーツの Mermaid 図 → 合体ロボ図（完成）
```

### 5ステップと合体ロボの身体パーツ

| Step | 身体パーツ | やること | 生成される図 |
|------|-----------|---------|------------|
| 1 | 🫀 胴体（コア） | 現実・理想・提案の3要素を抽出 | コア図 |
| 2 | 💪🛡️ 両腕（ドリルダウン） | 現実の原因・理想の効果を深掘り | 腕の図 |
| 3 | 🦿 両足（What / How） | 何を・どうやって実現するか具体化 | 足の図 |
| 4 | 🔍 合体前の点検 | 矛盾・ブレを検証して解消 | 検証レポート |
| 5 | 🧠🗂️ 頭・台座 | イントロ＋クロージングでシナリオを完成 | 合体ロボ図 |

各ステップの完了時に Mermaid 図がリアルタイムで更新され、最終ステップで全パーツが「合体」します。

---

## 動作モード

| モード | 説明 | API キー |
|--------|------|---------|
| **手動作図** | AI を使わず手動でノードを入力 | 不要 |
| **オーナーモード** | サーバー側の API キーを使用（デプロイ者向け） | Cloudflare 環境変数に設定 |
| **BYOK** | ユーザーが自分のキーをブラウザで入力（Anthropic / Google Gemini / OpenAI） | ブラウザのみで保持・ログなし |

---

## アーキテクチャ

```
ブラウザ (Vanilla JS / ES Modules)
  ├── public/index.html      — スタートページ
  ├── public/session.html    — セッション画面（チャット + 図表示）
  └── public/js/             — ステートマシン操作、図生成、設定 UI

Cloudflare Pages Functions (TypeScript)
  ├── functions/api/chat.ts      — POST /api/chat   ステップ内対話
  ├── functions/api/advance.ts   — POST /api/advance ステップ遷移
  └── functions/_lib/
        ├── session.ts           — ステートマシン・遷移ガード
        ├── prompt.ts            — ステップ別システムプロンプト生成
        ├── mermaid.ts           — Mermaid 図テンプレート駆動生成
        ├── claude.ts            — Claude API（ツール呼び出し・JSON 抽出）
        ├── gemini.ts            — Gemini API アダプタ
        └── openai.ts            — OpenAI API アダプタ

セッション状態: localStorage（クライアント管理）→ サーバーレス・KV 不要
図レンダリング: Mermaid.js v11（CDN）をブラウザで直接描画
```

**設計の特徴:**

- **ビルド工程なし** — HTML / CSS / JS をそのまま配信。`npm run build` 不要
- **ステートマシン** — `step1_core → step2_drilldown → … → complete` の遷移を型安全に管理
- **JSON スキーマ構造化** — LLM の出力はツール呼び出しで `SessionParts` 型に強制変換
- **テンプレート駆動 Mermaid 図** — AI が Mermaid 構文を生成しないため構文エラーゼロ

---

## 技術スタック

| レイヤ | 技術 |
|--------|------|
| ホスティング | Cloudflare Pages |
| API サーバー | Cloudflare Pages Functions (TypeScript) |
| LLM | Claude（Anthropic）/ Gemini（Google）/ GPT-4o（OpenAI） — マルチプロバイダ対応 |
| フロントエンド | HTML5 / CSS3 / Vanilla JS (ES Modules) — フレームワークなし |
| 図生成 | Mermaid.js v11（CDN） |
| セッション管理 | localStorage — サーバーサイド永続化なし |
| セキュリティヘッダー | Cloudflare Pages `_headers`（CSP / X-Frame-Options / Referrer-Policy 等） |
| 型検査 | TypeScript（`tsconfig.json`） |

---

## 開発思想 — SDD × Secure Vibe Coding（CC Terminal 版）

本プロジェクトは **Claude Code（CC）** を AI ペアプログラマーとして全面活用した、**AIネイティブな開発フロー**で構築されています。
単なる "Vibe Coding"（思いつきで AI にコードを書かせる）ではなく、**仕様・セキュリティ・承認ゲート**の三層ハーネスを敷いた構造化された手法です。

### 三層ハーネス構造

| レイヤ | 内容 | 実装 |
|--------|------|------|
| **SDD（仕様駆動）** | コードより仕様を先に書く。仕様にない実装は行わない | `PLAN.md` / `docs/specs/` を先行作成。変更時は仕様を先に更新 |
| **セキュリティ** | 秘密情報をコードに混入させない。環境を完全分離する | APIキーは `.dev.vars`（ローカル）または Cloudflare 環境変数（本番）に隔離。ソースに書かない |
| **HITL ハーネス** | トークン消費・課金・本番反映を人間がゲートする | Level 1（ローカル型検査）は自動可。Level 2（実 API テスト）・Level 3（マージ・デプロイ）は明示承認制 |

### HITL レベル定義

```
Level 1 — ローカル自動検証（自動実行可、API課金ゼロ）
  対象: npm run typecheck / npm run test:unit

Level 2 — 実 LLM 呼び出しを伴うテスト（要承認 / HITL 必須）
  対象: Anthropic / Google / OpenAI の本物の API を消費するテスト

Level 3 — マージ・本番反映（要承認 / HITL 必須）
  対象: main ブランチへのマージ、GitHub push、Cloudflare Pages デプロイ
```

### 保守フェーズへの移行とスケール検討

現在は **CC Terminal（CLI）版**の構成で、すべての実装・レビュー・デプロイをターミナルから行っています。
今後の保守フェーズでは以下を検討しています:

- **エディタ連携**: VS Code / JetBrains の Claude Code 拡張によりインライン編集ワークフローへ移行
- **CI/CD 自動化**: GitHub Actions による typecheck・lint の自動実行とデプロイパイプライン化
- **オブザーバビリティ**: Cloudflare Analytics / Workers Logs によるエラートラッキングと LLM レスポンス品質モニタリング
- **QA 強化**: E2E テスト（Playwright 等）の導入によるステップ遷移と図生成の自動検証

---

## ローカル実行

### 前提

- Node.js 20 以上
- Wrangler CLI（`npx wrangler` で自動インストール可）
- いずれかの LLM プロバイダの API キー（手動作図モードなら不要）

### 手順

```bash
# 1. リポジトリをクローン
git clone https://github.com/t-sumita/logi-bot.git
cd logi-bot

# 2. 依存パッケージをインストール
npm install

# 3. 環境変数ファイルを作成（git 管理外）
cp .dev.vars.example .dev.vars   # ファイルがなければ手動で作成
```

`.dev.vars` の内容（使用するプロバイダに合わせて設定）:

```ini
# オーナーモード用パスコード（任意の文字列）
OWNER_PASSCODE=your_passcode_here

# LLM プロバイダ設定（省略時: gemini）
AI_PROVIDER=gemini           # gemini / anthropic / openai

# API キー（AI_API_KEY を優先。なければプロバイダ別変数にフォールバック）
AI_API_KEY=your_api_key_here
# GEMINI_API_KEY=...
# ANTHROPIC_API_KEY=...
# OPENAI_API_KEY=...
```

```bash
# 4. ローカルサーバーを起動
npx wrangler pages dev public --compatibility-date=2024-09-23

# → http://localhost:8788 でアプリが起動します
```

### 型検査

```bash
npm run typecheck
```

### Cloudflare Pages へのデプロイ

```bash
npx wrangler pages deploy public --project-name=logi-bot --branch=main
```

---

## プロジェクト構成（主要ファイル）

```
logi-bot/
├── public/                   # 静的配信物（Cloudflare Pages のルート）
│   ├── index.html            # スタートページ
│   ├── session.html          # セッション画面
│   ├── config.js             # APP_VERSION の唯一のソース
│   ├── _headers              # Cloudflare Pages セキュリティヘッダー
│   ├── css/                  # スタイルシート（CSS カスタムプロパティ）
│   └── js/                   # ES Modules（フレームワークなし）
├── functions/                # Cloudflare Pages Functions（TypeScript）
│   ├── api/chat.ts           # POST /api/chat
│   ├── api/advance.ts        # POST /api/advance
│   └── _lib/                 # 共有ライブラリ
├── docs/specs/               # 仕様書（ステートマシン / JSON スキーマ / Mermaid テンプレート）
├── PLAN.md                   # 実装計画（SDD の起点）
├── STATUS.md                 # 作業状況・引き継ぎ記録
├── SECURITY.md               # セキュリティポリシー
└── CLAUDE.md                 # AI エージェント向けプロジェクト憲法
```

---

## セキュリティ

脆弱性を発見した場合は [SECURITY.md](./SECURITY.md) の手順に従って非公開で報告してください。

---

## ライセンス

[MIT License](./LICENSE)

---

## Author

**Subutomo Dev** ([@t-sumita](https://github.com/t-sumita))

> 本ツールの構成フレームワークは、永田豊志氏の図解メソッド（*プレゼンがうまい人の「図解思考」の技術*）に着想を得て設計されています。
