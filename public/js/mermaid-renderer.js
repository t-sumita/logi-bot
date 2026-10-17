// Mermaid.js レンダリングラッパー — SVG 生成・ズームモーダル

let initialized = false;
let renderSeq = 0;

function initMermaid() {
  if (initialized) return;
  if (typeof mermaid === "undefined") return;
  mermaid.initialize({
    startOnLoad: false,
    theme: "default",
    themeVariables: {
      primaryColor: "#EEF2FF",
      primaryTextColor: "#1E293B",
      primaryBorderColor: "#4F46E5",
      lineColor: "#94A3B8",
      fontFamily: "'Hiragino Kaku Gothic ProN', 'Noto Sans JP', system-ui, sans-serif",
    },
    flowchart: { htmlLabels: true, curve: "basis" },
  });
  initialized = true;
}

/**
 * Mermaid ソースを container 内に SVG としてレンダリングする。
 * ソースが空の場合はプレースホルダーを表示する。
 * @returns {{ ok: boolean }} — ok=true で SVG が挿入済み、ok=false でエラー
 */
export async function renderDiagram(source, container) {
  initMermaid();
  if (!source || source.trim() === "") {
    container.innerHTML = `
      <div class="diagram-placeholder">
        <div class="placeholder-icon">📊</div>
        <div class="placeholder-text">このステップが完了すると図が生成されます</div>
      </div>`;
    return { ok: false };
  }
  if (typeof mermaid === "undefined") {
    container.innerHTML = '<div class="diagram-error">Mermaid.js が読み込めていません</div>';
    return { ok: false };
  }
  const id = `mm-${++renderSeq}`;
  try {
    const { svg } = await mermaid.render(id, source);
    container.innerHTML = svg;
    const svgEl = container.querySelector("svg");
    if (svgEl) {
      svgEl.removeAttribute("width");
      svgEl.removeAttribute("height");
      svgEl.style.maxWidth = "none";
      svgEl.style.height = "auto";
    }
    return { ok: true };
  } catch (e) {
    console.error("[mermaid] render error:", e.message);
    console.error("[mermaid] source:\n", source);
    container.innerHTML = `
      <div class="diagram-error">
        <div class="diagram-error-msg">⚠️ レンダリングエラー: ${escHtml(e.message)}</div>
        <pre class="diagram-error-code">${escHtml(source)}</pre>
      </div>`;
    return { ok: false };
  }
}

/**
 * ズームモーダルを開く。
 */
export async function openZoomModal(source, modal, svgContainer, codeEl, titleEl, initialMode = "svg") {
  if (!modal) return;
  initMermaid();

  codeEl.textContent = source || "（図がありません）";

  await renderDiagram(source, svgContainer);

  if (titleEl) titleEl.textContent = initialMode === "code" ? "Mermaid コード" : "図の拡大表示";

  const svgMode = initialMode === "svg";
  svgContainer.hidden = !svgMode;
  codeEl.hidden = svgMode;
  modal.querySelectorAll(".modal-tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.mode === initialMode);
  });

  modal.removeAttribute("hidden");
}

function escHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
