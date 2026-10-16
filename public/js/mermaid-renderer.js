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
 */
export async function renderDiagram(source, container) {
  initMermaid();
  if (!source || source.trim() === "") {
    container.innerHTML = `
      <div class="diagram-placeholder">
        <div class="placeholder-icon">📊</div>
        <div class="placeholder-text">このステップが完了すると図が生成されます</div>
      </div>`;
    return;
  }
  if (typeof mermaid === "undefined") {
    container.innerHTML = '<div class="diagram-error">Mermaid.js が読み込めていません</div>';
    return;
  }
  const id = `mm-${++renderSeq}`;
  try {
    const { svg } = await mermaid.render(id, source);
    container.innerHTML = svg;
    const svgEl = container.querySelector("svg");
    if (svgEl) {
      svgEl.removeAttribute("width");
      svgEl.removeAttribute("height");
      svgEl.style.maxWidth = "100%";
      svgEl.style.height = "auto";
    }
  } catch (e) {
    container.innerHTML = `<div class="diagram-error">レンダリングエラー: ${escHtml(e.message)}</div>`;
  }
}

/**
 * ズームモーダルを開く。
 * modal — .modal-overlay 要素
 * svgContainer — SVG を挿入する要素
 * codeEl — コードを表示する &lt;pre&gt; 要素
 * titleEl — モーダルタイトル要素
 * initialMode — "svg" | "code"
 */
export async function openZoomModal(source, modal, svgContainer, codeEl, titleEl, initialMode = "svg") {
  if (!modal) return;
  initMermaid();

  // コードを設定
  codeEl.textContent = source || "（図がありません）";

  // SVG をレンダリング
  await renderDiagram(source, svgContainer);

  // タイトル
  if (titleEl) titleEl.textContent = initialMode === "code" ? "Mermaid コード" : "図の拡大表示";

  // タブ切り替え
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
