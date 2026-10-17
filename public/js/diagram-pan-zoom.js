// 図パネルのパン・ズーム操作コントローラー
// マウスドラッグ／スクロール・タッチスワイプ／ピンチで SVG を操作する。

const MIN_SCALE = 0.1;
const MAX_SCALE = 5.0;
const ZOOM_STEP = 0.15;
const FIT_MARGIN = 12; // フィット時の余白 (px)

/**
 * コンテナ要素にパン・ズーム操作を付与する。
 * コンテナ直下の .pz-viewport div を変換対象とする。
 * @param {HTMLElement} containerEl - overflow:hidden の固定サイズコンテナ
 * @returns {{ fit, zoomIn, zoomOut, reset, destroy }}
 */
export function initPanZoom(containerEl) {
  let scale = 1;
  let tx = 0;
  let ty = 0;
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startTx = 0;
  let startTy = 0;
  let lastPinchDist = 0;

  function vp() {
    return containerEl.querySelector(".pz-viewport");
  }

  function applyTransform() {
    const v = vp();
    if (!v) return;
    v.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`;
    v.style.transformOrigin = "0 0";
  }

  function clampScale(s) {
    return Math.max(MIN_SCALE, Math.min(MAX_SCALE, s));
  }

  function zoomAt(delta, originX, originY) {
    const newScale = clampScale(scale + delta);
    if (newScale === scale) return;
    const factor = newScale / scale;
    tx = originX - factor * (originX - tx);
    ty = originY - factor * (originY - ty);
    scale = newScale;
    applyTransform();
  }

  // ── フィット実装（layout 確定後に実行）──────────────────────────
  function fitInner() {
    console.log("[PanZoom Debug] fit() called");

    const v = vp();
    if (!v) return;
    const svgEl = v.querySelector("svg");
    if (!svgEl) {
      scale = 1; tx = 0; ty = 0; applyTransform(); return;
    }

    // clientWidth/Height が 0 の場合は getBoundingClientRect でフォールバック
    let cw = containerEl.clientWidth;
    let ch = containerEl.clientHeight;
    if (cw <= 0 || ch <= 0) {
      const r = containerEl.getBoundingClientRect();
      cw = r.width;
      ch = r.height;
    }
    console.log("[PanZoom Debug] Container:", { cw, ch });
    if (cw <= 0 || ch <= 0) return;

    // transform をリセットして自然サイズを測定
    scale = 1; tx = 0; ty = 0;
    applyTransform();

    // getBoundingClientRect で実際のレンダリングサイズを取得
    const svgRect = svgEl.getBoundingClientRect();
    const svgW = svgRect.width;
    const svgH = svgRect.height;
    console.log("[PanZoom Debug] SVG BoundingBox:", { svgW, svgH });

    if (svgW <= 0 || svgH <= 0) return;

    // 余白を確保しながらコンテナに収まるスケールを計算
    const availW = cw - FIT_MARGIN * 2;
    const availH = ch - FIT_MARGIN * 2;
    const newScale = clampScale(Math.min(availW / svgW, availH / svgH));
    console.log("[PanZoom Debug] Calculated Scale:", newScale);

    scale = newScale;
    tx = (cw - svgW * scale) / 2;
    ty = Math.max(FIT_MARGIN, (ch - svgH * scale) / 2);
    console.log("[PanZoom Debug] Calculated Translate:", { tx, ty });
    applyTransform();
  }

  /**
   * SVG を全体表示でコンテナ中央にフィットする。
   * double rAF でブラウザのレイアウト確定を待ってから実行する。
   */
  function fit() {
    requestAnimationFrame(() => requestAnimationFrame(fitInner));
  }

  // ── マウス操作 ────────────────────────────────────────────────────
  function onWheel(ev) {
    ev.preventDefault();
    const rect = containerEl.getBoundingClientRect();
    const ox = ev.clientX - rect.left;
    const oy = ev.clientY - rect.top;
    const delta = ev.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
    zoomAt(delta, ox, oy);
  }

  function onMouseDown(ev) {
    if (ev.button !== 0) return;
    dragging = true;
    startX = ev.clientX;
    startY = ev.clientY;
    startTx = tx;
    startTy = ty;
    containerEl.style.cursor = "grabbing";
    ev.preventDefault();
  }

  function onMouseMove(ev) {
    if (!dragging) return;
    tx = startTx + ev.clientX - startX;
    ty = startTy + ev.clientY - startY;
    applyTransform();
  }

  function onMouseUp() {
    if (!dragging) return;
    dragging = false;
    containerEl.style.cursor = "grab";
  }

  // ── タッチ操作 ────────────────────────────────────────────────────
  function onTouchStart(ev) {
    if (ev.touches.length === 1) {
      dragging = true;
      startX = ev.touches[0].clientX;
      startY = ev.touches[0].clientY;
      startTx = tx;
      startTy = ty;
    } else if (ev.touches.length === 2) {
      dragging = false;
      const dx = ev.touches[0].clientX - ev.touches[1].clientX;
      const dy = ev.touches[0].clientY - ev.touches[1].clientY;
      lastPinchDist = Math.hypot(dx, dy);
    }
    ev.preventDefault();
  }

  function onTouchMove(ev) {
    if (ev.touches.length === 1 && dragging) {
      tx = startTx + ev.touches[0].clientX - startX;
      ty = startTy + ev.touches[0].clientY - startY;
      applyTransform();
    } else if (ev.touches.length === 2) {
      const dx = ev.touches[0].clientX - ev.touches[1].clientX;
      const dy = ev.touches[0].clientY - ev.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const rect = containerEl.getBoundingClientRect();
      const cx = (ev.touches[0].clientX + ev.touches[1].clientX) / 2 - rect.left;
      const cy = (ev.touches[0].clientY + ev.touches[1].clientY) / 2 - rect.top;
      zoomAt((dist - lastPinchDist) * 0.008, cx, cy);
      lastPinchDist = dist;
    }
    ev.preventDefault();
  }

  function onTouchEnd(ev) {
    if (ev.touches.length < 1) dragging = false;
  }

  // ── イベント登録 ──────────────────────────────────────────────────
  containerEl.addEventListener("wheel",      onWheel,      { passive: false });
  containerEl.addEventListener("mousedown",  onMouseDown);
  containerEl.addEventListener("touchstart", onTouchStart, { passive: false });
  containerEl.addEventListener("touchmove",  onTouchMove,  { passive: false });
  containerEl.addEventListener("touchend",   onTouchEnd);
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup",   onMouseUp);

  containerEl.style.cursor = "grab";

  function destroy() {
    containerEl.removeEventListener("wheel",      onWheel);
    containerEl.removeEventListener("mousedown",  onMouseDown);
    containerEl.removeEventListener("touchstart", onTouchStart);
    containerEl.removeEventListener("touchmove",  onTouchMove);
    containerEl.removeEventListener("touchend",   onTouchEnd);
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup",   onMouseUp);
  }

  return {
    fit,
    zoomIn:  () => zoomAt( ZOOM_STEP, containerEl.clientWidth / 2, containerEl.clientHeight / 2),
    zoomOut: () => zoomAt(-ZOOM_STEP, containerEl.clientWidth / 2, containerEl.clientHeight / 2),
    reset:   () => { scale = 1; tx = 0; ty = 0; applyTransform(); },
    destroy,
  };
}

/**
 * diagramContent の内容を .pz-viewport でラップする（再ラップも安全）。
 * renderDiagram() の直後に呼ぶ。
 * @param {HTMLElement} containerEl
 */
export function wrapForPanZoom(containerEl) {
  const existing = containerEl.querySelector(".pz-viewport");
  if (existing) {
    while (existing.firstChild) {
      containerEl.appendChild(existing.firstChild);
    }
    existing.remove();
  }

  const vp = document.createElement("div");
  vp.className = "pz-viewport";

  while (containerEl.firstChild) {
    vp.appendChild(containerEl.firstChild);
  }
  containerEl.appendChild(vp);
}
