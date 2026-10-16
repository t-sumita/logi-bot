# プロジェクト憲法 (CLAUDE.md)

## プロジェクト基本情報

| 項目 | 値 |
|------|-----|
| プロジェクト名 | logi-bot |
| 目的 | 図解思考（ドリルダウン＋合体ロボ作戦）でアイデアを整理する対話型AIエージェント。5ステップの質疑応答を通じて各パーツのMermaid図を生成し、最終的に「合体ロボ図（全体シナリオ図）」を完成させる |
| ホスティング予定 | Cloudflare Pages + Pages Functions |
| ブランチ | main |

---

## 開発ルール

### 仕様駆動開発 (SDD)
- **実装は `PLAN.md` と `docs/specs/` の仕様に従う。** 仕様にない実装を先に書かない。
- 設計判断・仕様変更が生じたら、コードより先に PLAN.md / `docs/specs/` を更新する。
- タスクの実装・検証が完了したら PLAN.md のチェックボックス (`- [x]`) を更新する。
- 作業の区切りには `STATUS.md` に「現在地」「完了したこと」「次の一手」を記録する。

### 指示・コミュニケーション
- CC (Claude Code) への指示は **日本語** で行う
- タスクは **1つずつ** 依頼する。前のタスクが完了してから次を依頼すること

### バージョン管理
- タスク完了ごとに **SemVer** をバンプする (`MAJOR.MINOR.PATCH`)
  - 破壊的変更: MAJOR、機能追加: MINOR、バグ修正: PATCH
- バージョンは `public/config.js` の `APP_VERSION` 単一定数で管理する
- **他の場所に重複定義しない** (`package.json` に `version` を持たせない)

### コミット
- コミットメッセージは **日本語** で書く
- 形式: `種別: 内容の要約` (例: `feat: v0.2.0 ステップ1コア抽出UIを追加`)

### ブランチ運用
- 機能追加・非自明な修正は必ず `feature/<name>` ブランチで行い、そこへコミットする
- **ユーザーの承認なしに main へマージしない。** 実装完了後は停止し、ブラウザ等での確認をユーザーに依頼する
- ユーザーが明示的にマージを指示したときだけ、main へ fast-forward マージ → push → feature ブランチ削除
- GitHub リポジトリ作成・push もユーザーの明示指示があるまで行わない

### ファイル操作
- 日本語を含むファイルの作成・編集は必ず **Edit/Write ツール** を使う
- PowerShell 経由の日本語書き込みは UTF-8 破損の恐れがあるため **禁止**

### API キー管理
- Claude API キー・Cloudflare トークン等の秘密値をソース・リポジトリ・CLI 引数に書かない
- ローカルは `.dev.vars` (git 管理外)、本番は Pages の環境変数シークレット

---

## 技術スタック・設計原則

- ホスティング: Cloudflare Pages / API: Pages Functions (TypeScript) + Claude API (`@anthropic-ai/sdk`)
- フロント: HTML5 / CSS3 / Vanilla JS (ES Modules)。**ビルド工程なし**
- 静的配信物は `public/` に隔離する（`wrangler.toml` や `PLAN.md` を公開しない）
- **セッション状態はクライアント管理**（`sessionStorage`）。MVP では KV 不要
- **Mermaid.js** は CDN から読み込み、ブラウザでレンダリング
- ステップ進行は **ステートマシン**（`docs/specs/state-machine.md`）で管理
- 各ステップの対話内容を **JSONスキーマ**（`docs/specs/json-schema.md`）で構造化
- Mermaid 図は **テンプレート駆動**（`docs/specs/mermaid-templates.md`）で生成

## コーディングルール

- ファイル冒頭に、そのファイルの役割を 1 行コメントで書く。関数には JSDoc (日本語) を書く
- ハードコードは避け、定数化する
- エラーは握りつぶさず、UI のエラー欄に原因が分かる形で表示する
- コールバックの仮引数に `t` を使わない（i18n の `t()` をシャドウイングしないため）
- **ルート絶対パス（`/` 始まり）を使わない。** HTML・CSS・JS 内のアセット参照はすべて相対パスで記述する

### パス解決・配信環境

- Cloudflare Pages（ルート直下）と GitHub Pages（`/<repo>/`）の両配信で壊れない設計にする
- 新しいアセット参照を追加したら実装完了前に絶対パス混入がないか grep で確認する

---

## 参考資料

- 実装計画: `PLAN.md` / 仕様書: `docs/specs/`（state-machine / json-schema / mermaid-templates / api）
- コアスキル仕様: `.claude/skills/logi-session/SKILL.md`
- 作業状況: `STATUS.md`
- 共通パーツの正本: `C:\dev\subutomo-template`

---

## スキル台帳

スキルの増設は「事故・ヒヤリの再発」をトリガーに行う。
有効化は対象フォルダの `SKILL.md.draft` を `SKILL.md` にリネームするだけ。

| スキル | 状態 | 役割 | 有効化の条件 |
|---|---|---|---|
| env-guard | ✅ 有効 | 実行前の環境確認(CWD/ブランチ/パス境界) | - |
| dev-prep-checklist | ✅ 有効 | コーディング開始前チェック(新規/継続分岐) | - |
| logi-session | ✅ 有効 | logiセッションの進行管理(ステートマシン操作・図生成) | - |
| commit-guard | 📝 草稿 | コミット前チェック(秘密情報/ゴミファイル/バージョン) | 秘密情報系のヒヤリが再発したら |
| session-handoff | 📝 草稿 | セッション終了処理(STATUS.md更新+次回の一手) | STATUS.md の更新漏れが2回起きたら |

### 運用ルール

- スキルの内容を変更したら、テンプレリポジトリ (`subutomo-template`) 側を正として更新する
- 新しいスキルを思いついたら、まず草稿(.draft)として追加し、台帳に有効化条件を書く。即有効化はしない。
