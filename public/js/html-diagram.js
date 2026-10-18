// HTML/CSS 固定レイアウト合体ロボ図ビューア（脱 Mermaid メイン表示）
// plotData（SessionParts: core / drilldown / what_how / frame）から
// 頭・上半身（左腕・胴体・右腕）・下半身（左足・右足）・台座の固定 DOM を組み立てる。
// 画面表示と「印刷・PDF 出力（別タブ）」の両方で同じマークアップ／CSS を使い回す。

// ── 定数 ──────────────────────────────────────────────────────────

/** ノード番号 → 日本語ラベル（クリック修正時のラベルに使用） */
const NODE_LABELS = {
  "0": "イントロ",
  "1": "現実",
  "2": "理想",
  "3": "提案",
  "4": "現実の詳細",
  "5": "理想の詳細",
  "6": "What",
  "7": "How",
  "8": "クロージング",
};

/** 配列ノード番号 → 日本語ラベル（例: "4-2" → "現実の詳細 2番目"） */
function labelOf(nodeId) {
  if (NODE_LABELS[nodeId]) return NODE_LABELS[nodeId];
  const m = String(nodeId).match(/^(\d+)-(\d+)$/);
  if (m) return `${NODE_LABELS[m[1]] ?? `グループ${m[1]}`} ${m[2]}番目`;
  return String(nodeId);
}

/** 未入力表示テキスト */
const EMPTY_TEXT = "（未入力）";

/**
 * 画面・印刷の両方で使う自己完結型 CSS。
 * tokens.css に依存せず literal な配色で記述し、別タブ印刷でも崩れないようにする。
 */
export const ROBOT_CSS = `
.robot {
  --rb-ink: #1E293B; --rb-sub: #64748B; --rb-line: #CBD5E1;
  font-family: 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', system-ui, sans-serif;
  display: flex; flex-direction: column; align-items: center;
  gap: 6px; padding: 18px 14px; color: var(--rb-ink);
  transform-origin: top center; width: max-content; min-width: 100%;
  margin: 0 auto;
}
.robot-row { display: flex; justify-content: center; align-items: stretch; gap: 14px; }
.robot-upper { align-items: flex-start; }
.robot-head-row, .robot-base-row { width: 100%; }

/* 縦コネクタ（疑似的な体の中心線） */
.rb-connector { width: 3px; height: 16px; background: var(--rb-line); border-radius: 2px; }

/* 共通ボックス */
.rb-box {
  border: 2px solid var(--rb-line); border-radius: 12px; background: #fff;
  padding: 8px 12px; min-width: 120px; max-width: 220px; text-align: center;
  box-shadow: 0 2px 6px rgba(15,23,42,.08); transition: box-shadow .15s ease, transform .15s ease;
}
.rb-tag { font-size: .68rem; font-weight: 800; letter-spacing: .02em; margin-bottom: 3px; }
.rb-val { font-size: .8rem; line-height: 1.45; word-break: break-word; white-space: pre-wrap; }
.rb-box.is-empty { border-style: dashed; background: #F8FAFC; }
.rb-box.is-empty .rb-val { color: #94A3B8; }

/* クリック可能（画面表示時のみ付与） */
.rb-box.rb-clickable { cursor: pointer; }
.rb-box.rb-clickable:hover { box-shadow: 0 4px 14px rgba(79,70,229,.25); transform: translateY(-1px); }

/* 頭・台座 */
.rb-box.rb-head { border-color: #7C3AED; background: #F5F3FF; }
.rb-box.rb-head .rb-tag { color: #6D28D9; }
.rb-box.rb-base { border-color: #0EA5E9; background: #F0F9FF; }
.rb-box.rb-base .rb-tag { color: #0369A1; }

/* 上半身 */
.robot-upper { gap: 10px; }
.rb-limb { display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 130px; }
.rb-limb-title { font-size: .7rem; font-weight: 800; color: var(--rb-sub); white-space: nowrap; }

/* 胴体（コア）: 上段に [1]現実←→[2]理想 を横並び、下段中央に [3]提案（T字／逆三角形） */
.rb-torso { display: flex; flex-direction: column; align-items: center; gap: 3px; }
.rb-torso-top { display: flex; align-items: center; justify-content: center; gap: 8px; }
.rb-torso-bottom { display: flex; justify-content: center; margin-top: 2px; }
.rb-torso .rb-box.rb-core { border-color: #4F46E5; background: #EEF2FF; min-width: 120px; max-width: 170px; }
.rb-torso .rb-box.rb-core .rb-tag { color: #4338CA; }
.rb-arrow { font-size: .66rem; color: var(--rb-sub); line-height: 1.2; text-align: center; }
.rb-arrow-h { font-size: .64rem; font-weight: 800; color: #4338CA; white-space: nowrap; }

/* 左腕（現実系=赤）・右腕（理想系=緑） */
.rb-box.rb-arm-l { border-color: #F87171; background: #FEF2F2; }
.rb-box.rb-arm-l .rb-tag { color: #B91C1C; }
.rb-box.rb-arm-r { border-color: #34D399; background: #ECFDF5; }
.rb-box.rb-arm-r .rb-tag { color: #047857; }

/* 下半身（左足=What=橙 / 右足=How=紫） */
.robot-legs { gap: 24px; align-items: flex-start; }
.rb-box.rb-leg-l { border-color: #FB923C; background: #FFF7ED; }
.rb-box.rb-leg-l .rb-tag { color: #C2410C; }
.rb-box.rb-leg-r { border-color: #A78BFA; background: #F5F3FF; }
.rb-box.rb-leg-r .rb-tag { color: #6D28D9; }
`;

/** 印刷タブ専用の追加 CSS（画面用 app.css の代替として最低限の体裁を整える） */
export const PRINT_CSS = `
* { box-sizing: border-box; }
body { margin: 0; padding: 24px; background: #fff;
  font-family: 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', system-ui, sans-serif; color: #1E293B; }
.print-title { text-align: center; font-size: 1.3rem; font-weight: 800; margin: 0 0 20px; }
@media print { body { padding: 0; } .robot { transform: none !important; } }
`;

// ── マークアップ生成 ──────────────────────────────────────────────

/** HTML エスケープ */
function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * 1 ノード分のボックス HTML を生成する。
 * @param {object} o
 * @param {string} o.nodeId  - 番号文字列（"0"〜"8" または "4-1" 等）
 * @param {string} o.cls     - 追加クラス（rb-core / rb-arm-l 等）
 * @param {string} o.tag     - 見出し（例: "🫀 [1] 現実"）
 * @param {string} o.value   - 本文（空なら未入力表示）
 * @returns {string}
 */
function boxHtml({ nodeId, cls, tag, value }) {
  const filled = !!(value && value.trim());
  const body = filled ? escHtml(value.trim()) : EMPTY_TEXT;
  return (
    `<div class="rb-box ${cls}${filled ? "" : " is-empty"}"` +
    ` data-node="${escHtml(nodeId)}" data-label="${escHtml(labelOf(nodeId))}">` +
    `<div class="rb-tag">${escHtml(tag)}</div>` +
    `<div class="rb-val">${body}</div></div>`
  );
}

/**
 * 1 本の腕／脚（配列ノード群）の HTML を生成する。
 * データが無い場合はグループ番号のプレースホルダーを 1 つ表示する。
 * @param {string[]} items - 値の配列
 * @param {string} group   - グループ番号（"4"〜"7"）
 * @param {string} cls     - ボックス追加クラス
 * @param {string} emoji   - タグ用絵文字
 * @returns {string}
 */
function limbBoxesHtml(items, group, cls, emoji) {
  const filled = (items || []).filter((x) => x && x.trim());
  if (filled.length === 0) {
    return boxHtml({ nodeId: group, cls, tag: `${emoji} [${group}]`, value: "" });
  }
  return filled
    .map((v, i) => boxHtml({ nodeId: `${group}-${i + 1}`, cls, tag: `${emoji} [${group}-${i + 1}]`, value: v }))
    .join('<div class="rb-arrow">↓</div>');
}

/**
 * plotData（SessionParts）から合体ロボ図の HTML マークアップ文字列を生成する。
 * 画面表示・印刷の両方で使う純粋関数（副作用なし）。
 * @param {object} plotData - core / drilldown / what_how / frame を持つ SessionParts
 * @returns {string} ロボ図のルート要素 HTML
 */
export function buildDiagramMarkup(plotData) {
  const core = plotData.core ?? {};
  const dd = plotData.drilldown ?? {};
  const wh = plotData.what_how ?? {};
  const frame = plotData.frame ?? { intro: {}, closing: {} };

  const head = boxHtml({ nodeId: "0", cls: "rb-head", tag: "🧠 [0] 頭・イントロ", value: frame.intro?.hook });
  const base = boxHtml({ nodeId: "8", cls: "rb-base", tag: "🗂️ [8] 台座・クロージング", value: frame.closing?.cta });

  const leftArm = limbBoxesHtml(dd.reality_factors, "4", "rb-arm-l", "💪");
  const rightArm = limbBoxesHtml(dd.ideal_goals, "5", "rb-arm-r", "🛡️");

  // T字（逆三角形）: 上段 [1]現実 ←→ [2]理想、下段中央 [3]提案
  const torso =
    '<div class="rb-torso-top">' +
      boxHtml({ nodeId: "1", cls: "rb-core", tag: "🫀 [1] 現実", value: core.reality }) +
      '<div class="rb-arrow rb-arrow-h">→<br>なぜ？</div>' +
      boxHtml({ nodeId: "2", cls: "rb-core", tag: "🫀 [2] 理想", value: core.ideal }) +
    '</div>' +
    '<div class="rb-arrow">↓ どうする？</div>' +
    '<div class="rb-torso-bottom">' +
      boxHtml({ nodeId: "3", cls: "rb-core", tag: "🫀 [3] 提案", value: core.proposal }) +
    '</div>';

  const leftLeg = limbBoxesHtml(wh.what_items, "6", "rb-leg-l", "🦿");
  const rightLeg = limbBoxesHtml(wh.how_items, "7", "rb-leg-r", "⚡");

  return (
    '<div class="robot">' +
      `<div class="robot-row robot-head-row">${head}</div>` +
      '<div class="rb-connector"></div>' +
      '<div class="robot-row robot-upper">' +
        `<div class="rb-limb"><div class="rb-limb-title">💪 左腕 / 現実の詳細</div>${leftArm}</div>` +
        `<div class="rb-limb rb-torso"><div class="rb-limb-title">🫀 胴体（コア）</div>${torso}</div>` +
        `<div class="rb-limb"><div class="rb-limb-title">🛡️ 右腕 / 理想の詳細</div>${rightArm}</div>` +
      '</div>' +
      '<div class="rb-connector"></div>' +
      '<div class="robot-row robot-legs">' +
        `<div class="rb-limb"><div class="rb-limb-title">🦿 左足 / What（何を）</div>${leftLeg}</div>` +
        `<div class="rb-limb"><div class="rb-limb-title">⚡ 右足 / How（どうやって）</div>${rightLeg}</div>` +
      '</div>' +
      '<div class="rb-connector"></div>' +
      `<div class="robot-row robot-base-row">${base}</div>` +
    '</div>'
  );
}

// ── 画面描画 ──────────────────────────────────────────────────────

/** ROBOT_CSS を document に一度だけ注入する */
function ensureStyleInjected() {
  if (document.getElementById("robot-diagram-css")) return;
  const styleEl = document.createElement("style");
  styleEl.id = "robot-diagram-css";
  styleEl.textContent = ROBOT_CSS;
  document.head.appendChild(styleEl);
}

/**
 * plotData を container に固定レイアウトで描画し、クリックハンドラを付与する。
 * plotData が更新されるたびに呼び出すと、該当 DOM が再構築される。
 * @param {object} plotData - SessionParts（core / drilldown / what_how / frame）
 * @param {object} [opts]
 * @param {Element} opts.container - 描画先 DOM 要素
 * @param {function} [opts.onNodeClick] - (nodeId, label) を受け取るクリックコールバック
 */
export function renderHtmlDiagram(plotData, opts = {}) {
  const { container, onNodeClick } = opts;
  if (!container) return;
  ensureStyleInjected();
  container.innerHTML = buildDiagramMarkup(plotData);

  if (typeof onNodeClick === "function") {
    container.querySelectorAll(".rb-box").forEach((box) => {
      box.classList.add("rb-clickable");
      box.addEventListener("click", (ev) => {
        ev.stopPropagation();
        onNodeClick(box.dataset.node, box.dataset.label || "");
      });
    });
  }
}

// ── 印刷・PDF 出力（別タブ） ───────────────────────────────────────

/**
 * 図解 DOM と必要な CSS だけを新しいタブに流し込み、自動で印刷ダイアログを開く。
 * ユーザーはブラウザ標準機能で PDF 保存／印刷できる。
 * @param {object} session - LogiSession（parts と title を使用）
 */
export function printDiagram(session) {
  const markup = buildDiagramMarkup(session.parts);
  const title = escHtml(session.title || "無題");

  const w = window.open("", "_blank");
  if (!w) {
    alert("ポップアップがブロックされました。ブラウザのポップアップ許可を確認してください。");
    return;
  }

  // ヘッダーはプロジェクトのタイトル文字列のみ（太字・シンプル）
  const html =
    '<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">' +
    `<title>${title}</title>` +
    `<style>${PRINT_CSS}${ROBOT_CSS}</style></head><body>` +
    `<h1 class="print-title">${title}</h1>` +
    markup +
    // 画像・フォントのレイアウト確定を待ってから印刷ダイアログを開く
    '<' + 'script>window.addEventListener("load",function(){setTimeout(function(){window.print();},300);});<' + '/script>' +
    "</body></html>";

  w.document.open();
  w.document.write(html);
  w.document.close();
}
