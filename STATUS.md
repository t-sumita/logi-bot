# STATUS.md — 作業状況

## 現在のバージョン
`0.2.0`

## 最終更新
2026-10-16

## 現在地
- フェーズ 2（API 層）を `feature/phase2-api` で完了。**ユーザーのマージ指示待ち**
- フェーズ 3（フロントエンド）は未着手

## 完了したこと

### フェーズ 0（計画）
- CLAUDE.md / docs/specs/ 4本 / .claude/skills/ 整備
- PLAN.md v0→v1（ユーザー承認 2026-10-16）
- 追加仕様（オンボーディング・バルクインプット・ドリルダウン品質）を全仕様書に反映

### フェーズ 1（土台）
- `git init` + `feature/phase1-foundation` ブランチ → main マージ済み
- `wrangler.toml` / `package.json`（typescript, wrangler, @cloudflare/workers-types）/ `tsconfig.json`
- `.dev.vars.example` / `public/config.js`（v0.1.0）
- `functions/_lib/types.ts` — 全 TypeScript 型定義（onboarding / fast_track 含む）
- `functions/_lib/session.ts` — ステートマシン（7状態・5イベント・ガード条件・ファストトラック）
- `functions/_lib/mermaid.ts` — Mermaid 生成（5ステップ + 合体ロボ図 + バルク一括生成）
- `npm run typecheck` 通過（エラー 0）

### フェーズ 2（API 層）
- `functions/_lib/mermaid.ts` — サニタイズ強化（改行→スペース、`"`→`'`、200文字制限）
- `functions/_lib/session.ts` — `mergeExtracted()` 追加（空値で上書きしないマージルール）
- `functions/_lib/prompt.ts` — 新規: Tool 定義・システムプロンプト・ドリルダウン7パターン・バルクプロンプト
- `functions/_lib/claude.ts` — 新規: Anthropic SDK ラッパー（Tool Use / MOCK モード対応）
- `functions/api/chat.ts` — 新規: POST /api/chat（バルク検知・ファストトラック・通常会話）
- `functions/api/advance.ts` — 新規: POST /api/advance（状態遷移・Mermaid 生成・BACK/RESET）
- `functions/api/diagram.ts` — 新規: POST /api/diagram（オンデマンド図再生成）
- `scripts/test-unit.mjs` — 新規: 単体テスト 28 件（Node.js 組み込みテストランナー）
- `scripts/smoke-api.mjs` — 新規: 疎通テスト 16 件（MOCK サーバー対象）
- `npm run typecheck` 通過（エラー 0）
- `npm run test:unit` 通過（28/28）
- `npm run smoke` 通過（16/16、MOCK モード）

## 次の一手
- ユーザーが `feature/phase2-api` をマージ指示 → main へ fast-forward マージ
- フェーズ 3 開始: `feature/phase3-ui` ブランチでフロントエンド実装
  - `public/index.html`（セッション一覧・新規作成）
  - `public/session.html`（チャット・図表示・ステップナビ）
  - `public/js/` / `public/css/`
  - `npm run dev:mock` でブラウザ動作確認

## 未確認事項
- npm install の脆弱性警告（7件）は wrangler 依存による推移的なものと想定。公開前に `npm audit` で確認
