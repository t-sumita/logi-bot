# STATUS.md — 作業状況

## 現在のバージョン
`0.8.0`

## 最終更新
2026-10-17

## 現在地
- feature/v0.8.0-dynamic-svg ブランチ実装完了
- typecheck 0エラー / test:unit 34/34 全通過
- ユーザーによる main マージ・デプロイ確認待ち

## 完了したこと

### フェーズ 0〜7a（v0.7.1まで）
（上記 STATUS.md 履歴参照）

### フェーズ 8（v0.8.0 — 動的SVG・番号付きノード・書籍準拠ステップ）

#### 新規ファイル
- `public/js/mermaid-builder.js` — クライアントサイド合体ロボMermaid生成
  - `buildRobotDiagram(session)`: セッション状態から flowchart TB を生成
  - `attachNodeClickHandlers(container, cb)`: SVGノードクリックで修正入力

#### 変更ファイル
- `functions/_lib/types.ts` — NodeStatus 型・LogiSession.nodeStatuses 追加
- `functions/_lib/session.ts` — createSession に nodeStatuses: {} 追加
- `functions/_lib/prompt.ts` — [番号] 参照形式・チェックポイントメッセージ全面更新
- `functions/_lib/claude.ts` — モックレスポンスを [番号] 形式に更新
- `public/js/storage.js` — createNewSession に nodeStatuses: {} 追加
- `public/js/session-app.js` — mermaid-builder 連携・タブ廃止・onNodeClick・WELCOME更新
- `public/js/export.js` — buildRobotDiagram 使用・STATUS.md形式エクスポート追加
- `public/session.html` — 図タブ→diagram-label 簡略化・STATUS.md ボタン追加
- `public/css/app.css` — モバイル column-reverse レイアウト・クリッカブルノードCSS
- `public/index.html` — スタートフォーム最上部・コンパクトヒーロー・横並びステップフロー
- `public/config.js` — v0.8.0 バンプ
- `.claude/skills/logi-session/SKILL.md` — [0]〜[8] ノード体系・STATUS.md形式追記

## v0.8.0 の主な機能

1. **クライアントサイドMermaid**: AI生成文字列に依存しない構文エラーゼロの図
2. **番号付きノード**: [0]〜[8] でノードをクリック→チャットへ修正入力
3. **書籍準拠ステップ**: [1]→[2]→[3] 厳密順序・チェックポイント確認
4. **モバイルレイアウト**: 上40%図・下60%チャット (column-reverse)
5. **STATUS.md出力**: 確定/AI案/未確認の分類エクスポート＋引き継ぎ指示

## 次の一手
1. ユーザーが動作確認（ブラウザで session.html を開いて全ステップを試す）
2. 問題なければ `main` へ fast-forward マージ
3. GitHub push → Cloudflare Pages 自動デプロイ
