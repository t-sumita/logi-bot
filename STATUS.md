# STATUS.md — 作業状況

## 現在のバージョン
`0.6.0`

## 最終更新
2026-10-17

## 現在地
- `feature/phase6-ux` ブランチで v0.6.0 実装完了。ユーザーのマージ・デプロイ指示待ち。

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
- **バッジ修正**: 常時表示はアイコンのみ（`.su-badge span { display: none }`）、ポップオーバーにバージョン・コピーライト・Donation・Contact を集約
- **ステップ表記2行化**: `.sn-main` / `.sn-sub` で パーツ名＋サブ説明を表示
- **Step 1 順次ガイド**: 現実→理想→提案の3段階。サブステップインジケーター追加、部分図をクライアントサイドで即時生成
- **初期化バグ修正**: `idle→onboarding` をクライアントサイドで即時実施（API呼び出し廃止・"初期化中"フリーズ解消）
- **動的プレースホルダー**: ステップ・サブステップに応じた具体的な入力例を表示
- `typecheck` 0エラー（`npm run typecheck` 確認済み）

## 次の一手
- ユーザーが `feature/phase6-ux` の動作確認後、main へ fast-forward マージ指示
- GitHub push → Cloudflare Pages 自動デプロイ
