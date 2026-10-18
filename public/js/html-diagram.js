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
  --rb-ink: #1E293B; --rb-sub: #64748B; --rb-line: #94A3B8;
  font-family: 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', system-ui, sans-serif;
  position: relative;
  display: flex; flex-direction: column; align-items: center;
  gap: 20px; padding: 18px 14px; color: var(--rb-ink);
  transform-origin: top center; width: max-content; min-width: 100%;
  margin: 0 auto;
}
/* 接続線オーバーレイ（ボックスの背面に敷く） */
.diagram-connectors {
  position: absolute; top: 0; left: 0; z-index: 0;
  pointer-events: none; overflow: visible;
}
.robot-row { display: flex; justify-content: center; align-items: stretch; gap: 14px; }
.robot-upper { align-items: flex-start; }
.robot-head-row, .robot-base-row { width: 100%; }

/* 共通ボックス（接続線より前面に出す） */
.rb-box {
  position: relative; z-index: 1;
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
.rb-torso { display: flex; flex-direction: column; align-items: center; gap: 0; }
.rb-torso-top { display: flex; align-items: center; justify-content: center; gap: 26px; }
.rb-torso-gap { height: 26px; }
.rb-torso-bottom { display: flex; justify-content: center; }
.rb-torso .rb-box.rb-core { border-color: #4F46E5; background: #EEF2FF; min-width: 120px; max-width: 170px; }
.rb-torso .rb-box.rb-core .rb-tag { color: #4338CA; }
/* ラベル類は接続線より前面に出し、背景で線を隠す */
.rb-arrow { position: relative; z-index: 1; font-size: .66rem; color: var(--rb-sub); line-height: 1.2; text-align: center; background: #fff; padding: 0 3px; }
.rb-arrow-h { font-size: .64rem; font-weight: 800; color: #4338CA; white-space: nowrap; background: #fff; padding: 1px 4px; }

/* 腕・足の箱は縦に積む（間隔は接続線用に確保） */
.rb-limb .rb-box + .rb-box { margin-top: 14px; }

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
.print-toolbar { display: flex; justify-content: flex-end; margin: 0 0 12px; font-size: 0.8rem; color: #64748B; }
.print-toolbar label { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
body.hide-connectors .diagram-connectors { display: none; }
@media print {
  body { padding: 0; }
  .robot { transform: none !important; }
  .print-toolbar { display: none !important; }
  .diagram-connectors { display: none !important; }
}
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
  // 箱は縦に積むだけ（箱同士のつながりは接続線 SVG が描画する）
  return filled
    .map((v, i) => boxHtml({ nodeId: `${group}-${i + 1}`, cls, tag: `${emoji} [${group}-${i + 1}]`, value: v }))
    .join("");
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

  // T字（逆三角形）: 上段 [1]現実 →なぜ？→ [2]理想、下段中央 [3]提案（つながりは接続線 SVG）
  const torso =
    '<div class="rb-torso-top">' +
      boxHtml({ nodeId: "1", cls: "rb-core", tag: "🫀 [1] 現実", value: core.reality }) +
      '<div class="rb-arrow rb-arrow-h">なぜ？</div>' +
      boxHtml({ nodeId: "2", cls: "rb-core", tag: "🫀 [2] 理想", value: core.ideal }) +
    '</div>' +
    '<div class="rb-torso-gap"></div>' +
    '<div class="rb-torso-bottom">' +
      boxHtml({ nodeId: "3", cls: "rb-core", tag: "🫀 [3] 提案", value: core.proposal }) +
    '</div>';

  const leftLeg = limbBoxesHtml(wh.what_items, "6", "rb-leg-l", "🦿");
  const rightLeg = limbBoxesHtml(wh.how_items, "7", "rb-leg-r", "⚡");

  // 頭・台座はどこにも繋がず単独で浮かぶ（手描き図どおり）。
  // ボックス間のつながりはすべて接続線 SVG（drawConnectors）で描画し、擬似縦棒は置かない。
  return (
    '<div class="robot">' +
      `<div class="robot-row robot-head-row">${head}</div>` +
      '<div class="robot-row robot-upper">' +
        `<div class="rb-limb"><div class="rb-limb-title">💪 左腕 / 現実の詳細</div>${leftArm}</div>` +
        `<div class="rb-limb rb-torso"><div class="rb-limb-title">🫀 胴体（コア）</div>${torso}</div>` +
        `<div class="rb-limb"><div class="rb-limb-title">🛡️ 右腕 / 理想の詳細</div>${rightArm}</div>` +
      '</div>' +
      '<div class="robot-row robot-legs">' +
        `<div class="rb-limb"><div class="rb-limb-title">🦿 左足 / What（何を）</div>${leftLeg}</div>` +
        `<div class="rb-limb"><div class="rb-limb-title">⚡ 右足 / How（どうやって）</div>${rightLeg}</div>` +
      '</div>' +
      `<div class="robot-row robot-base-row">${base}</div>` +
    '</div>'
  );
}

// ── 画面描画 ──────────────────────────────────────────────────────

/**
 * .robot 内の各ボックス間に接続線（SVG オーバーレイ）を描画する。
 * ボックスの背面に <svg class="diagram-connectors"> を敷き、レイアウト座標で線を引く。
 * ※印刷タブでも toString() で使い回すため、外部の関数・定数に依存しない自己完結実装にする。
 * @param {Element} root - .robot 要素
 */
function drawConnectors(root) {
  if (!root) return;
  const NS = "http://www.w3.org/2000/svg";
  const existing = root.querySelector("svg.diagram-connectors");
  if (existing) existing.remove();

  const W = root.offsetWidth, H = root.offsetHeight;
  if (!W || !H) return;

  const COLOR = "#94A3B8", WIDTH = "2";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "diagram-connectors");
  svg.setAttribute("width", W);
  svg.setAttribute("height", H);
  svg.setAttribute("viewBox", "0 0 " + W + " " + H);

  // 矢印マーカー（現実→理想 用）
  const defs = document.createElementNS(NS, "defs");
  const marker = document.createElementNS(NS, "marker");
  marker.setAttribute("id", "rb-arrowhead");
  marker.setAttribute("markerWidth", "8"); marker.setAttribute("markerHeight", "8");
  marker.setAttribute("refX", "5"); marker.setAttribute("refY", "3");
  marker.setAttribute("orient", "auto");
  const mp = document.createElementNS(NS, "path");
  mp.setAttribute("d", "M0,0 L6,3 L0,6 Z"); mp.setAttribute("fill", COLOR);
  marker.appendChild(mp); defs.appendChild(marker); svg.appendChild(defs);

  // root を基準としたレイアウト座標を返す
  const pos = function (el) {
    let x = 0, y = 0, n = el;
    while (n && n !== root) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return { x: x, y: y, w: el.offsetWidth, h: el.offsetHeight, cx: x + el.offsetWidth / 2, cy: y + el.offsetHeight / 2 };
  };
  const line = function (x1, y1, x2, y2, arrow) {
    const l = document.createElementNS(NS, "line");
    l.setAttribute("x1", x1); l.setAttribute("y1", y1);
    l.setAttribute("x2", x2); l.setAttribute("y2", y2);
    l.setAttribute("stroke", COLOR); l.setAttribute("stroke-width", WIDTH); l.setAttribute("stroke-linecap", "round");
    if (arrow) l.setAttribute("marker-end", "url(#rb-arrowhead)");
    svg.appendChild(l);
  };
  const poly = function (pts) {
    const p = document.createElementNS(NS, "polyline");
    p.setAttribute("points", pts.map(function (a) { return a[0] + "," + a[1]; }).join(" "));
    p.setAttribute("fill", "none"); p.setAttribute("stroke", COLOR);
    p.setAttribute("stroke-width", WIDTH); p.setAttribute("stroke-linejoin", "round"); p.setAttribute("stroke-linecap", "round");
    svg.appendChild(p);
  };
  const q = function (s) { return root.querySelector(s); };
  const qa = function (s) { return Array.prototype.slice.call(root.querySelectorAll(s)); };

  const real = q('[data-node="1"]'), ideal = q('[data-node="2"]'), prop = q('[data-node="3"]');

  // 左腕: 左詳細の右辺 → 現実の左辺（放射）
  if (real) { const r = pos(real); qa(".rb-arm-l").forEach(function (b) { const p = pos(b); line(p.x + p.w, p.cy, r.x, r.cy); }); }
  // 右腕: 理想の右辺 → 右詳細の左辺（放射）
  if (ideal) { const idl = pos(ideal); qa(".rb-arm-r").forEach(function (b) { const p = pos(b); line(idl.x + idl.w, idl.cy, p.x, p.cy); }); }

  // 胴体 T字: 現実→理想（矢印）＋ 中間から下へ提案の上辺中央へ
  if (real && ideal) {
    const r = pos(real), idl = pos(ideal);
    line(r.x + r.w, r.cy, idl.x, idl.cy, true);
    if (prop) {
      const pr = pos(prop);
      const midX = (r.x + r.w + idl.x) / 2;
      poly([[midX, r.cy], [midX, pr.y], [pr.cx, pr.y]]);
    }
  }

  // 両足: 提案の下辺 → 各足先頭（L字）＋ 足内は縦直列
  if (prop) {
    const pr = pos(prop);
    const leg = function (boxes) {
      if (!boxes.length) return;
      const first = pos(boxes[0]);
      const midY = (pr.y + pr.h + first.y) / 2;
      poly([[pr.cx, pr.y + pr.h], [pr.cx, midY], [first.cx, midY], [first.cx, first.y]]);
      for (let i = 1; i < boxes.length; i++) { const a = pos(boxes[i - 1]), b = pos(boxes[i]); line(a.cx, a.y + a.h, b.cx, b.y); }
    };
    leg(qa(".rb-leg-l"));
    leg(qa(".rb-leg-r"));
  }

  root.insertBefore(svg, root.firstChild);
}

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

  // レイアウト確定後に接続線を描画（フォント読込で箱サイズが変わった場合も再描画）
  // 接続線描画の失敗が図全体の表示を壊さないよう保護する。
  const safeDraw = () => { try { drawConnectors(container.querySelector(".robot")); } catch (_e) { /* 線描画失敗は無視 */ } };
  safeDraw();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(safeDraw).catch(() => {});
  }
}

/**
 * 既存の .robot に対して接続線だけを再描画する（ペイン／ウィンドウのリサイズ追従用）。
 * @param {Element} container - #diagramContent など .robot を内包する要素
 */
export function redrawConnectors(container) {
  if (!container) return;
  try { drawConnectors(container.querySelector(".robot")); } catch (_e) { /* 線描画失敗は無視 */ }
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

  // 印刷タブ内でも接続線を描画するため drawConnectors を関数ソースごと埋め込み、
  // レイアウト確定（load）後に描画 → 印刷ダイアログを開く。
  const connectorScript =
    '<' + 'script>(function(){var draw=' + drawConnectors.toString() + ';' +
    'function run(){try{draw(document.querySelector(".robot"));}catch(e){}}' +
    'var cb=document.getElementById("toggleConnectors");' +
    'if(cb){cb.addEventListener("change",function(){document.body.classList.toggle("hide-connectors",!cb.checked);});}' +
    'window.addEventListener("load",function(){run();setTimeout(function(){run();window.print();},300);});' +
    '})();<' + '/script>';

  // ヘッダーはプロジェクトのタイトルのみ（印刷の日時はブラウザ標準機能に任せる）
  const html =
    '<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">' +
    `<title>${title}</title>` +
    `<style>${PRINT_CSS}${ROBOT_CSS}</style></head><body>` +
    '<div class="print-toolbar"><label><input type="checkbox" id="toggleConnectors" checked> 接続線を表示する</label></div>' +
    `<h1 class="print-title">${title}</h1>` +
    markup +
    connectorScript +
    "</body></html>";

  w.document.open();
  w.document.write(html);
  w.document.close();
}
