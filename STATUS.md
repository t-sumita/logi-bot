# STATUS.md — 作業状況

## 現在のバージョン
`0.1.0`

## 最終更新
2026-10-16

## 現在地
- フェーズ 1（土台）を `feature/phase1-foundation` で完了。**ユーザーのマージ指示待ち**
- フェーズ 2（API 層）は未着手

## 完了したこと

### フェーズ 0（計画）
- CLAUDE.md / docs/specs/ 4本 / .claude/skills/ 整備
- PLAN.md v0→v1（ユーザー承認 2026-10-16）
- 追加仕様（オンボーディング・バルクインプット・ドリルダウン品質）を全仕様書に反映

### フェーズ 1（土台）
- `git init` + `feature/phase1-foundation` ブランチ
- `wrangler.toml` / `package.json`（typescript, wrangler, @cloudflare/workers-types）/ `tsconfig.json`
- `.dev.vars.example` / `public/config.js`（v0.1.0）
- `functions/_lib/types.ts` — 全 TypeScript 型定義（onboarding / fast_track 含む）
- `functions/_lib/session.ts` — ステートマシン（7状態・5イベント・ガード条件・ファストトラック）
- `functions/_lib/mermaid.ts` — Mermaid 生成（5ステップ + 合体ロボ図 + バルク一括生成）
- `npm run typecheck` 通過（エラー 0）

## 次の一手
- ユーザーが `feature/phase1-foundation` をマージ指示 → main へ fast-forward マージ
- フェーズ 2 開始: `feature/phase2-api` ブランチで API 層（prompt.ts / claude.ts / chat.ts / advance.ts / diagram.ts）を実装

## 未確認事項
- npm install の脆弱性警告（7件）は wrangler 依存による推移的なものと想定。公開前に `npm audit` で確認
