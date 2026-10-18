# STATUS.md — 作業状況

## 現在のバージョン
`0.9.5`

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

## v0.8.8 追加修正（2026-10-18）

- **パン・ズーム `fit()` scale(0.1) 固着バグ根本修正**:
  - 原因: `getBoundingClientRect()` が Mermaid SVG のレンダリング前に呼ばれ `{svgW:0, svgH:0}` を返していた
  - 修正: `viewBox.baseVal` → `getAttribute('viewBox')` → `getBoundingClientRect()` の優先順位でサイズ取得
  - Mermaid が必ず生成する `viewBox` 属性を使うことでタイミング依存ゼロに
  - 全サイズ 0 のときは `console.warn` してスキップ（クラッシュ防止）

## v0.8.9 追加修正（2026-10-18）

- **SVG・ビューポート可視性を CSS で強制保証**:
  - `.pz-viewport` に `display/visibility/opacity !important` を追加
  - `.pz-viewport svg` に `display/visibility/opacity/width/height/overflow !important` を追加
  - `.pz-viewport svg .node rect/polygon/circle` にも `visibility/opacity !important` を追加
- **レンダリング後 DOM 状態確認ログを追加**: `applyTransform()` 後に `getBoundingClientRect` + `getComputedStyle` で `display/opacity/visibility` を出力

## v0.9.0（2026-10-18）

- **パン・ズーム 根本修正完了・デバッグログ除去**:
  - 原因確定: `width: auto !important` により SVG の物理サイズが 0x0 に潰れていた
  - `fitInner()` で viewBox 由来の `svgW/svgH` を `svgEl.style.width/height` に直接付与
  - `app.css` の `width: auto !important; height: auto !important;` を削除
  - `[PanZoom Debug]` ログを全除去（クリーンアップ）

## v0.8.x → v0.9.0 パン・ズーム修正の全経緯

| バージョン | 修正内容 | 結果 |
|---|---|---|
| v0.8.6 | double rAF + getBoundingClientRect | → svgW/H=0（タイミング問題）|
| v0.8.7 | デバッグログ追加 | → Container 正常・SVG=0 を確認 |
| v0.8.8 | viewBox から svgW/H 取得 | → 計算値 scale=0.254 正常 |
| v0.8.9 | CSS で可視性強制 | → width:auto が原因と判明 |
| v0.9.0 | svgEl.style.width/height 直接付与 + CSS 修正 | → 解決 |

## v0.9.1（2026-10-18 — HTML固定レイアウト刷新・印刷・サンプル・逆インポート）

- **Task 1 / HTML/CSS 固定レイアウトビューア（脱 Mermaid メイン表示）**:
  - `public/js/html-diagram.js` 新規作成。`renderHtmlDiagram(plotData, { container, onNodeClick })` が
    頭→上半身（左腕・胴体・右腕の横並び）→下半身（左足・右足）→台座の固定 DOM を組み立てる
  - 右側 `#diagramContent` の Mermaid レンダリングを廃止し、自動レイアウト崩れを根本解消
  - 各ボックスは CSS（配色・ボーダー・角丸・影）でスタイリング、線は `.rb-connector`/`.rb-arrow` で疑似表現
  - ノードクリックでチャット入力欄に修正テキストを挿入（従来機能を DOM ベースで維持）
  - ズームコントローラー（⊡/＋/－）は `.robot` への `transform: scale()` 方式に変更
  - Mermaid コード生成（`buildRobotDiagram`）はエクスポート・コード表示・SVG 拡大用に内部的に存続
  - 脚は「左足・右足を横に並べ、各足内の項目を縦に積む」ロボシルエット構成で実装
- **Task 2 / 印刷・PDF 出力（別タブ）**: 図コントローラーに「🖨️ 印刷・PDF」ボタン追加。
  `window.open('', '_blank')` で開いたタブに図 DOM + 自己完結 CSS（`ROBOT_CSS`/`PRINT_CSS`）を流し込み、
  `load` 後に `window.print()` を自動呼び出し
- **Task 3 / サンプル一発読み込み**: トップ（クイック）画面に「📝 サンプルで試す（社内情報共有ツール刷新）」
  ボタン追加。`plotData` に業務サンプル（現実/理想/提案 + 期待効果→イントロ/台座）を一括セットし即遷移
- **Task 4 / Mermaid 逆インポート（MOCK・正規表現）**: `import-parser.js` を拡張。
  `isMermaidLike` 検出 + `parseMermaidInto`（`[N]`/`[N-M]` ナンバリングを正規表現抽出し plotData へ復元）。
  ノード割り当てを `assignNodesToParts` に共通化。`cleanMermaidValue` で「見出し\\n本文」整形・（未入力）スキップ
- **テスト**: 61/61 全通過（Mermaid 逆インポート 7 件追加）。typecheck 0 エラー

## v0.9.2（2026-10-18 — 手描き図準拠の改修5点）

- **1. 胴体を T字（逆三角形）レイアウトへ**: `.rb-torso-top`（[1]現実 ←なぜ？→ [2]理想 を横並び）＋
  `.rb-torso-bottom`（[3]提案 を中央下）に変更。現実と理想のギャップから提案が生まれる配置に
- **2. 印刷ヘッダーの簡素化**: 🤖 絵文字・「合体ロボ図（全体シナリオ）— 日時」サブタイトルを削除し、
  プロジェクトのタイトル文字列のみを太字表示（`printDiagram`）
- **3. 腕・足の複数ノード描画**: `limbBoxesHtml` は配列を `map` で展開（元々複数対応）。
  サンプルデータ（`SAMPLE_PLOT`）に drilldown/what_how を各3件追加し、複数ボックス描画を即確認可能に。
  未入力時は薄い枠（`is-empty`）を1つだけ表示
- **4. .md エクスポートのファイル名改善**: デフォルト名を `[タイトル]_YYYYMMDD_HHMMSS.md` にし、
  ダウンロード直前に `prompt()` で任意名に変更可能（キャンセル対応）
- **5. 直接貼り付けインポートのバグ修正**: `startBulk` がタイトル未入力の通常メモで silent return していた問題を修正。
  先頭行から仮タイトルを自動生成（`deriveTitle`）し必ず発火。空入力時は `.shake` 演出（CSS 追加）
- **テスト**: 65/65 全通過（HTML 固定レイアウト 4 件追加）。typecheck 0 エラー

## v0.9.3（2026-10-18 — 手描き図の接続線・スプリッター・印刷日時・貼付保証）

- **1. 接続線（コネクタ）**: `html-diagram.js` に自己完結な `drawConnectors(root)` を追加。
  `.robot` 背面に `<svg class="diagram-connectors">` を敷き、レイアウト座標（offsetParent 走査）で線を描画。
  - 左腕: 左詳細の右辺 → [1]現実の左辺（放射）／右腕: [2]理想の右辺 → 右詳細の左辺（放射）
  - 胴体T字: [1]現実 →（矢印マーカー）→ [2]理想、中間から下へ折れて [3]提案の上辺中央へ
  - 両足: [3]提案の下辺から左右へ分岐（L字）＋各足内は詳細ボックスを縦直列で接続
  - 腕・足の箱間の `↓` テキストは廃止し線で表現。ラベル（なぜ？等）は白背景＋前面で線をマスク
  - ズーム時は `.robot` ごと scale されるため追従。印刷タブへは `drawConnectors.toString()` を埋め込み再描画
- **2. ペインのスプリッター**: チャット／図解の境界に `#paneSplitter` を追加。
  Pointer Events（マウス・タッチ）でドラッグし図解ペイン幅を可変（最小240px／チャット最低320px確保）。
  縦積み（≤720px）では無効化
- **3. 印刷の日時表示復元**: 印刷タブのヘッダー右上に「生成日時: YYYY/MM/DD HH:mm:ss」を控えめに表示（`.print-meta`）
- **4. 直接貼り付けインポートの保証**: `deriveTitle`（先頭行から仮タイトル）で通常メモ貼付も必ず遷移。
  単体テストを追加（deriveTitle 3件＋STATUS.md/通常メモ貼付 2件）
- **堅牢化**: `drawConnectors` 呼び出しを try/catch で保護（線描画失敗が図・印刷を壊さない）
- **テスト**: 70/70 全通過。typecheck 0 エラー。変更 JS は `node --check` 通過

## v0.9.4（2026-10-18 — 擬似縦棒の除去・接続線のリサイズ追従・印刷日時削除）

- **1. 不要な縦棒の削除**: 擬似コネクタ `.rb-connector`（頭下／提案下＝上半身と下半身の間／台座上）を
  マークアップ・CSS から完全除去。頭・台座は手描き図どおりどこにも繋がず単独配置に。
  行間隔は `.robot { gap: 20px }` で確保（接続線 SVG が提案→両足などを描画）
- **2. 接続線のリサイズ追従**: `redrawConnectors(container)` を新規 export。
  スプリッタードラッグ中（`pointermove` 内で `requestAnimationFrame` 間引き）・ドラッグ終了（`pointerup`）、
  および `window resize`（150ms デバウンス）で接続線を再描画。`.robot` の `min-width:100%` により
  ペイン幅変化で中央寄せ座標がずれる問題を解消
- **3. 印刷の日時表示削除**: ブラウザ標準印刷（Ctrl+P）の日時と二重になるため `.print-meta` と
  `formatDateTime` を削除。印刷ヘッダーはタイトルのみに
- **テスト**: 70/70 全通過（既存を維持）。typecheck 0 エラー・`node --check` 通過

## v0.9.5（2026-10-18 — 印刷時の接続線非表示・別タブの接続線トグル）

- **背景**: 別タブで Ctrl+P を開くと用紙幅へのリサイズで接続線の座標がズレる。座標再計算は泥沼化するため割り切り
- **1. 印刷時は接続線を非表示**: `PRINT_CSS` の `@media print` で `.diagram-connectors { display: none !important }`。
  印刷プレビュー／PDF 出力はボックス配置のみ
- **2. 別タブに「接続線を表示する」トグル**: 上部に控えめな操作バー（`.print-toolbar`、印刷時は非表示）。
  チェック ON（既定）で線あり、OFF で `body.hide-connectors` により画面上も線を消す
- **デプロイ**: `npx wrangler pages deploy public --project-name=logi-bot --branch=main --commit-dirty=true`
  （Pages は git 連携なし。main への push だけでは本番に反映されない）

## 次の一手

v0.9.5 本番確認: 別タブのトグルで線が消える／印刷プレビューで線が出ないか
