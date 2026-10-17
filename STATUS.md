# STATUS.md — 作業状況

## 現在のバージョン
`0.8.7`

## 最終更新
2026-10-18

## 現在地
- v0.8.1 main マージ・GitHub push・Cloudflare Pages デプロイ済み
- 本番 URL: https://logi-bot.pages.dev
- typecheck 0エラー / test:unit 34/34 全通過

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

## v0.8.1 追加修正（2026-10-17）

- **Undo 機能追加**: 「↩ 1手戻す」ボタン（送信前スナップショット保存、セッション/履歴/図を1手前に復元、元テキストを入力欄に戻す）
- **MOCKモード Step1 ループバグ修正**: `detectStep1Substep()` が旧マーカー（`【①現実】`等）を検索して常にデフォルト`"reality"`を返していた問題を修正。v0.8.0 の新マーカー(`**[1] 現実** を聞く`)に対応
- **バッジ重なり解消**: `.page-session .su-badge` の `bottom` を `calc(--nav-h + 8px)` に上書き

## v0.8.2 追加修正（2026-10-17）

- **バッジポップオーバーのリンク構成を標準仕様に整理**
  - github-site・cloudflare-ai-lab-site を削除
  - spctrl-site / strata-site / subuta-site を `{description:{en,ja}}` 標準形式に統一
  - Ko-fi（donation-site）・GitHub Sponsors（sponsors-site）を追加
  - contact-site を `mailto:` → Google Forms URL に変更
  - CONTACT_URL も Google Forms に更新

## v0.8.3 追加修正（2026-10-17）

- **トップ画面レイアウト修正**: Hero（タイトル+サブコピー+5ステップフロー）→ 履歴再開 → 新規フォームの自然な順序に修正
- **セッション復元バグ修正**: 旧バージョンの無効 step（onboarding/idle）を `inferStep()` で自動移行。インポートセッション識別と専用メッセージ表示
- **STATUS.md / Markdown インポート機能**: `import-parser.js` 新規作成。📁 ファイル選択ボタン（.md/.txt）。STATUS.md 形式・Markdown エクスポート形式をローカルパースして AI 不要で即時図描画。通常メモは API バルク抽出へフォールバック
- **テスト拡充**: 45/45 通過（11 件の import-parser テスト追加）

## v0.8.4 追加修正（2026-10-17）

- **Mermaid 図構造の全面修正**: 元図（手描きロボ）通りの配置・接続に変更
  - `CORE` サブグラフ（`direction LR`）で [1]現実・[2]理想を横並び
  - `LARM`/`RARM` サブグラフ廃止 → [4-N][5-N] をスタンドアロンノードとして [1][2] に直接 `---` 接続
  - HEAD/BASE サブグラフ廃止 → [0][8] をスタンドアロンに変更
  - `CORE --> nn3`（T字接続）→ `nn3 --> LLEG / RLEG`（二股）→ `nn8`（台座）の接続順
- **図パネルのパン・ズーム対応**: `diagram-pan-zoom.js` 新規作成
  - マウスドラッグ・スクロール・スワイプ・ピンチで自由にパン・ズーム
  - 右下に「全体表示（⊡）」「＋」「－」コントローラー設置
  - 描画後に自動フィット
- **MOCKモードのデータ格納バグ修正**:
  - Step 2: systemPrompt から収集済みフラグを判定し、[4]現実の詳細→[5]理想の詳細を順番に収集
  - Step 3: [6]What→[7]How を順番に収集（メッセージ分割方式を廃止）
  - Step 5: [0]イントロ→[8]クロージングを順番に収集

## v0.8.5 追加修正（2026-10-18）

- **Mermaid図 構文エラー修正（真っ白バグ解消）**: v0.8.4 で LARM/RARM をサブグラフ外ノードと接続していた構造を廃止。ユーザー指定の新構造に刷新:
  - `UPPER_BODY`（透明枠, direction LR）内に `LEFT_ARM`・`CORE`・`RIGHT_ARM` を横並び
  - `LEGS`（透明枠, direction LR）内に `LEFT_LEG`・`RIGHT_LEG` を横並び
  - `INTRO → CORE → PROP → LEGS → BASE` の縦主軸
  - 外枠サブグラフを `style ... fill:none,stroke:none` で非表示化
  - `[` `]` `{` `}` をサニタイズで全角変換（Mermaid パーサー干渉回避）
- **mermaid-renderer.js エラーハンドリング強化**: `mermaid.render()` に try-catch 追加。エラー時に `console.error` で原因出力 + 画面に `<pre class="diagram-error-code">` でソース表示。`renderDiagram` が `{ ok: boolean }` を返すように変更
- **パン・ズーム安全初期化**: `renderDiagram` の戻り値 `ok` が `false` のときはラップ・初期化をスキップ。DOM 未確定時のクラッシュを防止
- **単体テスト拡充**: `buildRobotDiagram` を `mermaid-builder.js` から直接 import し、空/途中/全入力/特殊文字の 9 件テスト追加。54/54 全通過

## v0.8.6 追加修正（2026-10-18）

- **パン・ズーム初期フィット計算バグ修正（translate(228px,0px) scale(0.31) 吹き飛び解消）**:
  - 原因: ① `.pz-viewport` に `padding: 16px` があり tx 計算に混入 ② `setTimeout 60ms` では Mermaid SVG の layout 未確定でサイズが正しく取れなかった
  - `.pz-viewport` からパディングを除去（centering 計算を `tx = (cw - svgW * scale) / 2` と単純化）
  - `fit()` を double `requestAnimationFrame` で layout 確定後に実行するよう変更
  - `getBoundingClientRect()` でレンダリング後の実サイズを測定（viewBox.baseVal 依存を廃止）
  - `ty = Math.max(FIT_MARGIN, (ch - svgH * scale) / 2)` で上端が見切れないよう保護
- **SVG スタイルの確実な適用**: CSS で `.pz-viewport svg { max-width: none !important; height: auto; }` を追加
- `session-app.js`: `setTimeout(..., 60)` を廃止し `panZoom.fit()` を直接呼び出し（rAF は内部）

## v0.8.7 追加修正（2026-10-18）

- **パン・ズーム `fit()` デバッグログ追加 & フェイルセーフ強化**:
  - `fitInner()` に詳細ログ追加（`[PanZoom Debug]` プレフィックス）:
    - `fit() called` / `Container: {cw, ch}` / `SVG BoundingBox: {svgW, svgH}` / `Calculated Scale:` / `Calculated Translate: {tx, ty}`
  - フェイルセーフ: `containerEl.clientWidth/Height` が 0 の場合、`getBoundingClientRect()` でフォールバック取得
  - 原因特定後は `console.log` を除去予定

## 次の一手
- ユーザーが https://logi-bot.pages.dev で動作確認し、DevTools Console で `[PanZoom Debug]` ログを確認
  1. `Container: {cw, ch}` の値が正しいか（cw/ch が 0 でないか）
  2. `SVG BoundingBox: {svgW, svgH}` の値が正しいか（0 でないか）
  3. `Calculated Scale:` が MIN_SCALE=0.1 より大きいか
