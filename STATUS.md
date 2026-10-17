# STATUS.md — 作業状況

## 現在のバージョン
`0.7.0`

## 最終更新
2026-10-17

## 現在地
- `feature/phase7-robot-refactor` ブランチで v0.7.0 実装完了。main へのマージ・デプロイ指示待ち。

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

### フェーズ 7（ロボット部位再定義 v0.7.0）
- **合体ロボ5パーツ全面刷新**: 旧5ステップ（胸・腹/両腕/両脚/点検/頭・台座）を廃止し、本来の合体ロボレイアウトに合わせた新5部位に再設計
  - Step 1: 🧠 頭（ヘッド）— コンセプト・結論（head.concept + head.message）
  - Step 2: 🫀 胴体（ボディ）— コアシステム（body.core_system）
  - Step 3: 💪 右腕（ライトアーム）— 攻めの施策 2〜3項目（right_arm.items[]）
  - Step 4: 🛡️ 左腕（レフトアーム）— 守りの施策 2〜3項目（left_arm.items[]）
  - Step 5: 🦿 両足（レッグス）— 土台・基盤・ネクストアクション（legs.foundation + legs.next_action）
- **合体ロボ図レイアウト**: H→B, B→RA & LA, RA→FL, LA→FR の flowchart TD
- **セッション開始を step1_head から直接開始**（onboarding/idle 廃止）
- **サブステップインジケーター廃止**（Step 1 の現実→理想→提案の3段階UI を削除）
- **動的プレースホルダー**: 各ステップ固有の具体例テキスト
- **モバイル CSS**: `100dvh` + `env(safe-area-inset-bottom)` でiOS Safari対応
- `typecheck` 0エラー / `test:unit` 33/33 全通過

## 次の一手
- ユーザーが `feature/phase7-robot-refactor` の動作確認後、main へ fast-forward マージ指示
- GitHub push → Cloudflare Pages 自動デプロイ
