# STATUS.md — 作業状況

## 現在のバージョン
`0.7.1`

## 最終更新
2026-10-17

## 現在地
- v0.7.1 実装完了・main マージ・GitHub push・Cloudflare Pages デプロイ済み
- 本番 URL: https://logi-bot.pages.dev

## 完了したこと

### フェーズ 0（計画）
- CLAUDE.md / docs/specs/ 4本 / .claude/skills/ 整備
- PLAN.md v0→v1（ユーザー承認 2026-10-16）
- 追加仕様（オンボーディング・バルクインプット・ドリルダウン品質）を全仕様書に反映

### フェーズ 1（土台）
- `git init` + `feature/phase1-foundation` ブランチ → main マージ済み
- `wrangler.toml` / `package.json` / `tsconfig.json`
- `functions/_lib/types.ts` / `functions/_lib/session.ts` / `functions/_lib/mermaid.ts`
- `npm run typecheck` 通過（エラー 0）

### フェーズ 2（API 層）
- `functions/_lib/prompt.ts` / `functions/_lib/claude.ts`
- `functions/api/chat.ts` / `functions/api/advance.ts` / `functions/api/diagram.ts`
- `scripts/test-unit.mjs` / `scripts/smoke-api.mjs`
- `test:unit` 28/28 / `smoke` 16/16 全通過

### フェーズ 3（フロントエンド）
- `public/css/tokens.css` / `public/css/app.css`
- `public/js/storage.js` / `public/js/api.js` / `public/js/mermaid-renderer.js` / `public/js/export.js`
- `public/js/index-app.js` / `public/js/session-app.js`
- `public/index.html` / `public/session.html`

### フェーズ 4（モード切り替え・BYOK・デプロイ準備）
- マルチプロバイダー（Anthropic/Gemini/OpenAI）対応
- `public/js/settings.js` — モード設定モーダル
- GitHub 公開・Cloudflare Pages デプロイ完了（v0.4.0）

### フェーズ 5（UI v0.5.0）
- ファビコン + subutomo バッジ導入
- JA/EN 言語切り替え（i18n.js 新規）
- モードバッジ改善・ℹ️ Info モーダル追加

### フェーズ 6（UX v0.6.0）
- バッジ修正・ステップ表記2行化・Step 1 順次ガイド
- 初期化バグ修正・動的プレースホルダー

### フェーズ 7a（ロボット部位誤実装 v0.7.0 → 修正 v0.7.1）
- **v0.7.0 では誤った合体ロボ構成（step1_head/step2_body等）を実装してしまった**
- **v0.7.1 で正しい図解思考5ステップに全面修正**:
  - Step 1: 🫀 胴体（コア）— 現実・理想・提案（core.reality/ideal/proposal）
  - Step 2: 💪🛡️ 左腕・右腕 — 現実・理想の深掘り（drilldown）
  - Step 3: 🦿 両足（2本柱）— What/How（what_how）
  - Step 4: 🔍 合体前の点検 — 矛盾・ブレ検証（verification）
  - Step 5: 🧠🗂️ 頭・台座 — イントロ・クロージング（frame）
- **セッション開始**: step1_core から直接開始（準備ステップ廃止）
- **プレースホルダーバグ修正**: data-t-attr を textarea から削除、JS のみで制御
- **サブステップインジケーター復活**: Step 1 の ①現実→②理想→③提案 を表示
- **モバイルナビ修正**: stepLabel を max-width+ellipsis で1行省略
- `typecheck` 0エラー / `test:unit` 34/34 / `smoke` 18/18 全通過

## 次の一手
- ユーザーが https://logi-bot.pages.dev で動作確認
- 必要に応じて追加調整
