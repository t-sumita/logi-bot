// session.html — セッション画面のメインアプリケーションロジック

import { loadSession, saveSession, createNewSession, consumePendingMessage } from "./storage.js";
import { chat as apiChat, advance as apiAdvance } from "./api.js";
import { openZoomModal } from "./mermaid-renderer.js";
import { copyMarkdown, downloadMarkdown, downloadStatusMd } from "./export.js";
import { buildRobotDiagram } from "./mermaid-builder.js";
import { renderHtmlDiagram, printDiagram, redrawConnectors } from "./html-diagram.js";

// ── ステップ定義 ──────────────────────────────────────────────────
const STEP_META = {
  step1_core:      { label: "Step 1 / 5 — 🫀 胴体（コア）",   index: 1,
    placeholder: "" },
  step2_drilldown: { label: "Step 2 / 5 — 💪🛡️ 左腕・右腕",   index: 2,
    placeholder: "【[4] 現実の詳細・[5] 理想の詳細を入力】例：現実＝1日120通受信・月3件見落とし ／ 理想＝見落としゼロ・確認5分以内" },
  step3_what_how:  { label: "Step 3 / 5 — 🦿 両足（2本柱）",   index: 3,
    placeholder: "【[6] What（何を）／[7] How（体制・予算・時期）を入力】例：What＝自動フィルタと要約通知 ／ How＝開発2週間・予算0円・来月開始" },
  step4_verify:    { label: "Step 4 / 5 — 🔍 合体前の点検",     index: 4,
    placeholder: "【[1]〜[7] を俯瞰し、修正したい点があれば入力】（問題なければ「次のステップへ」）" },
  step5_combine:   { label: "Step 5 / 5 — 🧠🗂️ 頭・台座",       index: 5,
    placeholder: "【[0] 頭（イントロ）／[8] 台座（クロージング）を入力】例：イントロ＝メール処理に追われていませんか？ ／ 締め＝今週テスト導入しましょう" },
  complete:        { label: "合体完了 🎉",                       index: 6,
    placeholder: "" },
};

const STEP_ORDER = ["step1_core","step2_drilldown","step3_what_how","step4_verify","step5_combine","complete"];

/**
 * parts の充填度からステップを推定する（index-app.js の inferStep と同一ロジック）
 * @param {object} parts - SessionParts
 * @returns {string} StepName
 */
function inferStep(parts) {
  if (!parts.core.reality || !parts.core.ideal || !parts.core.proposal) return "step1_core";
  if (!parts.drilldown.reality_factors.length || !parts.drilldown.ideal_goals.length) return "step2_drilldown";
  if (!parts.what_how.what_items.length || !parts.what_how.how_items.length) return "step3_what_how";
  if (!parts.verification.is_consistent) return "step4_verify";
  if (!parts.frame.intro.hook || !parts.frame.closing.cta) return "step5_combine";
  return "complete";
}

const WELCOME_MESSAGE = (title) =>
`🤖 **logi-botへようこそ！**「${title}」の構想を合体ロボ🤖で図解しましょう！

## 合体ロボの全パーツ（[0]〜[8]）
| 番号 | パーツ | 役割 |
|---|---|---|
| [0] | 🧠 頭（イントロ） | フック・導入文 |
| [1] | 🫀 胴体（現実） | 現状の課題 |
| [2] | 🫀 胴体（理想） | あるべき姿 |
| [3] | 🫀 胴体（提案） | 解決策の核 |
| [4-N] | 💪 左腕 | 現実の詳細 |
| [5-N] | 🛡️ 右腕 | 理想の詳細 |
| [6-N] | 🦿 左足 | What（何を） |
| [7-N] | ⚡ 右足 | How（どうやって） |
| [8] | 🗂️ 台座（クロージング） | 次の行動・CTA |

---

まず **Step 1** から始めましょう。

**[1] 現実**（今、困っていること・課題の状況）を教えてください。`;

const IMPORT_MESSAGE = (title, parts) => {
  const step = inferStep(parts);
  const stepLabels = {
    step1_core: "Step 1（胴体）",
    step2_drilldown: "Step 2（両腕）",
    step3_what_how: "Step 3（両足）",
    step4_verify: "Step 4（点検）",
    step5_combine: "Step 5（頭・台座）",
    complete: "完成確認",
  };
  const filled = [];
  if (parts.core.reality)  filled.push(`✅ [1] 現実: ${parts.core.reality.slice(0, 35)}${parts.core.reality.length > 35 ? "…" : ""}`);
  if (parts.core.ideal)    filled.push(`✅ [2] 理想: ${parts.core.ideal.slice(0, 35)}${parts.core.ideal.length > 35 ? "…" : ""}`);
  if (parts.core.proposal) filled.push(`✅ [3] 提案: ${parts.core.proposal.slice(0, 35)}${parts.core.proposal.length > 35 ? "…" : ""}`);
  const more = parts.drilldown.reality_factors.length + parts.drilldown.ideal_goals.length +
    parts.what_how.what_items.length + parts.what_how.how_items.length;
  if (more > 0) filled.push(`✅ その他 ${more} 件のノードデータ`);

  return `📂 **「${title}」のデータを読み込みました。**

${filled.join("\n")}

右パネルの合体ロボ図を確認してください。ノードをクリックすると内容を修正できます。
「次のステップへ」ボタンで **${stepLabels[step] ?? step}** から続けることができます。`;
};

// ── アプリ状態 ────────────────────────────────────────────────────
let session = null;
let isLoading = false;
let currentDiagramSource = "";
/** 1手戻し用スナップショット: { session, message } */
let undoSnapshot = null;
/** 固定レイアウト図の表示倍率（ズームコントローラー用） */
let diagramScale = 1;

// ── DOM refs ─────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const el = {
  title:            $("sessionTitle"),
  stepIndicator:    $("stepIndicator"),
  substepIndicator: $("substepIndicator"),
  chatMessages:     $("chatMessages"),
  guardNotice:      $("guardNotice"),
  guardMissingList: $("guardMissingList"),
  forceNextBtn:     $("forceNextBtn"),
  chatForm:         $("chatForm"),
  chatInput:        $("chatInput"),
  chatSendBtn:      $("chatSendBtn"),
  diagramContent:   $("diagramContent"),
  showCodeBtn:      $("showCodeBtn"),
  printDiagramBtn:  $("printDiagramBtn"),
  diagramFitBtn:    $("diagramFitBtn"),
  diagramZoomInBtn: $("diagramZoomInBtn"),
  diagramZoomOutBtn:$("diagramZoomOutBtn"),
  backBtn:          $("backBtn"),
  nextBtn:          $("nextBtn"),
  stepLabel:        $("stepLabel"),
  zoomModal:        $("zoomModal"),
  zoomModalTitle:   $("zoomModalTitle"),
  zoomModalClose:   $("zoomModalClose"),
  modalDiagram:     $("modalDiagram"),
  modalCode:        $("modalCode"),
  copyMdBtn:        $("copyMdBtn"),
  downloadMdBtn:    $("downloadMdBtn"),
  statusMdBtn:      $("statusMdBtn"),
  undoBtn:          $("undoBtn"),
  sessionBody:      $("sessionBody"),
  diagramPane:      $("diagramPane"),
  paneSplitter:     $("paneSplitter"),
};

// ── 初期化 ────────────────────────────────────────────────────────
async function init() {
  const params = new URLSearchParams(location.search);
  const sessionId = params.get("id");

  if (sessionId) {
    session = loadSession(sessionId);
  }
  if (!session) {
    session = createNewSession("新しいセッション");
    saveSession(session);
    history.replaceState(null, "", `session.html?id=${encodeURIComponent(session.sessionId)}`);
  }

  // 旧バージョンの無効な step 値（"onboarding"/"idle" など）を現在のスキーマに移行する
  if (!STEP_ORDER.includes(session.step)) {
    session.step = inferStep(session.parts);
    saveSession(session);
  }

  renderAll();

  if (session.history.length === 0) {
    // インポートセッション（parts にデータがあるが会話履歴がない）
    const hasData = session.parts.core.reality || session.parts.core.ideal ||
                    session.parts.drilldown.reality_factors.length > 0;
    if (hasData) {
      addMessage("assistant", IMPORT_MESSAGE(session.title, session.parts));
    } else {
      addMessage("assistant", WELCOME_MESSAGE(session.title));
    }
  } else {
    restoreHistory();
  }

  // バルクインプットの pending メッセージがあれば自動送信
  const pending = consumePendingMessage(session.sessionId);
  if (pending) {
    el.chatInput.value = pending;
    await sendChat();
  }
}

// ── 履歴復元 ──────────────────────────────────────────────────────
function restoreHistory() {
  el.chatMessages.innerHTML = "";
  const recent = session.history.slice(-30);
  if (recent.length === 0) {
    addMessage("assistant", WELCOME_MESSAGE(session.title));
    return;
  }
  recent.forEach((turn) => addMessage(turn.role, turn.content));
}

// ── 全体再描画 ────────────────────────────────────────────────────
function renderAll() {
  el.title.textContent = session.title;
  document.title = `${session.title} — logi-bot`;
  renderStepIndicator();
  updateStep1SubstepIndicator();
  renderNavButtons();
  updateDiagramPanel();
  updateChatPlaceholder();
}

function renderStepIndicator() {
  const currentIdx = STEP_ORDER.indexOf(session.step);
  el.stepIndicator.querySelectorAll(".step-item").forEach((item) => {
    const s = item.dataset.step;
    const idx = STEP_ORDER.indexOf(s);
    item.classList.remove("done", "active", "todo");
    if (idx < currentIdx)       item.classList.add("done");
    else if (idx === currentIdx) item.classList.add("active");
    else                        item.classList.add("todo");
  });
  // コネクタの色を更新
  const connectors = el.stepIndicator.querySelectorAll(".step-connector");
  connectors.forEach((c, i) => {
    c.style.background = i < currentIdx ? "var(--c-step-done)" : "var(--c-step-todo)";
  });
  // ステップラベル
  const meta = STEP_META[session.step];
  el.stepLabel.textContent = meta ? meta.label : session.step;
}

function renderNavButtons() {
  const step = session.step;
  const canBack = ["step2_drilldown","step3_what_how","step4_verify","step5_combine"].includes(step);
  const canNext = ["step1_core","step2_drilldown","step3_what_how","step4_verify","step5_combine"].includes(step);

  el.backBtn.disabled = !canBack || isLoading;
  el.nextBtn.disabled = !canNext || isLoading;

  if (step === "step5_combine") el.nextBtn.textContent = "合体ロボを完成させる 🤖";
  else if (step === "complete") { el.nextBtn.textContent = "完成！"; el.nextBtn.disabled = true; }
  else                          el.nextBtn.textContent = "次のステップへ →";
}

// ── Step 1 サブステップ ────────────────────────────────────────────

function getStep1Substep() {
  const { reality, ideal, proposal } = session.parts.core;
  if (!reality)  return "reality";
  if (!ideal)    return "ideal";
  if (!proposal) return "proposal";
  return "done";
}

function updateStep1SubstepIndicator() {
  if (!el.substepIndicator) return;
  const show = session.step === "step1_core";
  el.substepIndicator.hidden = !show;
  if (!show) return;

  const substep = getStep1Substep();
  const order = ["reality", "ideal", "proposal"];
  const currentIdx = substep === "done" ? order.length : order.indexOf(substep);

  el.substepIndicator.querySelectorAll(".substep-item").forEach((item, i) => {
    item.classList.remove("done", "active", "todo");
    if (i < currentIdx)        item.classList.add("done");
    else if (i === currentIdx) item.classList.add("active");
    else                       item.classList.add("todo");
  });

  el.substepIndicator.querySelectorAll(".substep-connector").forEach((c, i) => {
    c.style.background = i < currentIdx ? "var(--c-step-done)" : "var(--c-step-todo)";
  });
}

/** 現在のステップとサブステップに合わせてプレースホルダーを更新する */
function updateChatPlaceholder() {
  if (!el.chatInput) return;
  if (session.step === "step1_core") {
    const placeholders = {
      reality:  "【[1] 現実（今の課題）を入力】例：毎日大量のメールが届き、大事な連絡を見落としている",
      ideal:    "【[2] 理想（あるべき姿）を入力】例：重要メールだけを即座に把握し、確認時間を1日5分に短縮",
      proposal: "【[3] 提案（解決策の核）を入力】例：AIによる重要メール自動選別＆毎朝の要約通知システムの導入",
      done:     "[1][2][3] が揃いました！補足・修正があれば入力してください。「次へ」ボタンで Step 2 へ進めます。",
    };
    el.chatInput.placeholder = placeholders[getStep1Substep()] || "";
  } else {
    const meta = STEP_META[session.step];
    el.chatInput.placeholder = meta?.placeholder || "メッセージを入力… (Enter で送信、Shift+Enter で改行)";
  }
}

// ── 図パネル ──────────────────────────────────────────────────────

/** HTML/CSS 固定レイアウトで合体ロボ図を描画し、クリックハンドラを付与する */
function updateDiagramPanel() {
  // Mermaid ソースはエクスポート・コード表示用に内部的に生成しておく
  currentDiagramSource = buildRobotDiagram(session);
  renderHtmlDiagram(session.parts, { container: el.diagramContent, onNodeClick });
  applyDiagramScale();
}

/** 現在の表示倍率を図のルート要素に適用する */
function applyDiagramScale() {
  const root = el.diagramContent?.querySelector(".robot");
  if (root) root.style.transform = `scale(${diagramScale})`;
}

/** ズームコントローラー操作 */
function zoomDiagram(factor) {
  diagramScale = Math.min(2.5, Math.max(0.4, diagramScale * factor));
  applyDiagramScale();
}
function fitDiagram() {
  diagramScale = 1;
  applyDiagramScale();
}

/** チャット／図解ペインの境界スプリッターをドラッグ可能にする（マウス・タッチ対応） */
function initSplitter() {
  const splitter = el.paneSplitter, body = el.sessionBody, pane = el.diagramPane;
  if (!splitter || !body || !pane) return;
  let dragging = false;

  let rafId = null;
  // ドラッグ中は rAF で間引いて接続線を再描画し、古い座標に取り残されないようにする
  const scheduleRedraw = () => {
    if (rafId) return;
    rafId = requestAnimationFrame(() => { rafId = null; redrawConnectors(el.diagramContent); });
  };

  const applyWidth = (clientX) => {
    const rect = body.getBoundingClientRect();
    const min = 240;                       // 図解ペインの最小幅
    const max = rect.width - 320;          // チャットペインに最低 320px を確保
    let w = rect.right - clientX;          // 右端からのカーソル距離 = 図解ペイン幅
    w = Math.max(min, Math.min(Math.max(min, max), w));
    pane.style.flex = `0 0 ${w}px`;
  };

  splitter.addEventListener("pointerdown", (ev) => {
    // 縦積み（モバイル）時は display:none のため発火しない
    if (getComputedStyle(splitter).display === "none") return;
    dragging = true;
    splitter.classList.add("dragging");
    document.body.style.userSelect = "none";
    try { splitter.setPointerCapture(ev.pointerId); } catch (_e) { /* no-op */ }
    ev.preventDefault();
  });
  splitter.addEventListener("pointermove", (ev) => {
    if (!dragging) return;
    applyWidth(ev.clientX);
    scheduleRedraw();
  });
  const endDrag = (ev) => {
    if (!dragging) return;
    dragging = false;
    splitter.classList.remove("dragging");
    document.body.style.userSelect = "";
    try { splitter.releasePointerCapture(ev.pointerId); } catch (_e) { /* no-op */ }
    redrawConnectors(el.diagramContent);   // ドラッグ終了時に最終座標で再描画
  };
  splitter.addEventListener("pointerup", endDrag);
  splitter.addEventListener("pointercancel", endDrag);
}

/** ノードクリック時: チャット入力欄に番号付き修正テキストを挿入してフォーカス */
function onNodeClick(nodeId, label) {
  const insertText = `【[${nodeId}] ${label}の修正】 `;
  el.chatInput.value = insertText + el.chatInput.value;
  el.chatInput.focus();
  el.chatInput.setSelectionRange(insertText.length, insertText.length);
}

// ── Undo（1手戻し）─────────────────────────────────────────────────

function updateUndoBtn() {
  if (el.undoBtn) el.undoBtn.disabled = !undoSnapshot || isLoading;
}

/** 直前の送信を取り消し、入力欄に元のテキストを戻す */
function undoLastTurn() {
  if (!undoSnapshot || isLoading) return;
  session = undoSnapshot.session;
  const prevMessage = undoSnapshot.message;
  undoSnapshot = null;
  saveSession(session);
  el.chatInput.value = prevMessage;
  restoreHistory();
  renderAll();
  el.chatInput.focus();
  el.chatInput.setSelectionRange(prevMessage.length, prevMessage.length);
  updateUndoBtn();
}

// ── チャット ──────────────────────────────────────────────────────
function addMessage(role, content) {
  const div = document.createElement("div");
  div.className = `chat-message ${role}`;
  const bubble = document.createElement("div");
  bubble.className = "chat-bubble";
  bubble.innerHTML = formatMessage(content);
  div.appendChild(bubble);
  el.chatMessages.appendChild(div);
  el.chatMessages.scrollTop = el.chatMessages.scrollHeight;
  return div;
}

function formatMessage(text) {
  return String(text)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/^#{1,3} (.+)$/gm, (_, t) => `<strong>${t}</strong>`)
    .replace(/^\|(.+)\|$/gm, (row) => {
      if (/^[\s|:-]+$/.test(row)) return "";
      const cells = row.split("|").slice(1, -1);
      return "<div style='display:flex;gap:8px;font-size:.8rem;color:var(--c-text-sub);flex-wrap:wrap'>" +
        cells.map((c) => `<span style='white-space:nowrap'>${c.trim()}</span>`).join(" ") +
        "</div>";
    })
    .replace(/^✅ (.+)$/gm, '<span class="check-item">✅ $1</span>')
    .replace(/^⚠️ (.+)$/gm, '<span class="warn-item">⚠️ $1</span>')
    .replace(/━+/g, (m) => `<span style="color:var(--c-border)">${m}</span>`)
    .replace(/\n/g, "<br>");
}

function addTypingIndicator() {
  const div = document.createElement("div");
  div.className = "chat-message assistant typing";
  div.innerHTML = '<div class="chat-bubble"><span class="typing-dots"><span>.</span><span>.</span><span>.</span></span></div>';
  el.chatMessages.appendChild(div);
  el.chatMessages.scrollTop = el.chatMessages.scrollHeight;
  return div;
}

function escHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function sendChat() {
  const message = el.chatInput.value.trim();
  if (!message || isLoading) return;

  // 送信前スナップショット保存（Undo 用）
  undoSnapshot = { session: JSON.parse(JSON.stringify(session)), message };
  updateUndoBtn();

  el.chatInput.value = "";
  el.guardNotice.hidden = true;
  addMessage("user", message);
  setLoading(true);
  const typingEl = addTypingIndicator();

  try {
    const res = await apiChat(session, message);
    typingEl.remove();
    session = res.session;
    saveSession(session);
    addMessage("assistant", res.reply);

    // ファストトラック後: 最初の未完ステップへ自動遷移済み
    if (res.fast_track && res.first_incomplete_step) {
      addMessage("system", `⚡ ファストトラック: ${formatStep(res.first_incomplete_step)} から再開します`);
    }

    renderAll();
  } catch (e) {
    typingEl.remove();
    addMessage("assistant", `❌ エラーが発生しました: ${escHtml(e.message)}`);
  } finally {
    setLoading(false);
  }
}

// ── ステップ進行 ──────────────────────────────────────────────────
async function doAdvance(event) {
  setLoading(true);
  el.guardNotice.hidden = true;

  try {
    const res = await apiAdvance(session, event);

    if (res && !res.ok) {
      showGuardNotice(res.missing_fields ?? []);
      return;
    }

    const prevStep = session.step;
    session = res.session;
    saveSession(session);

    // complete 遷移時に完成バナーを表示
    if (session.step === "complete" && prevStep !== "complete") {
      addMessage("system", "🎉 合体ロボ図が完成しました！右パネルの図を確認してください。");
    }

    renderAll();
  } catch (e) {
    const data = e.data;
    if (data && !data.ok && data.error?.code === "guard_failed") {
      showGuardNotice(data.missing_fields ?? []);
    } else {
      addMessage("assistant", `❌ エラー: ${escHtml(e.message)}`);
    }
  } finally {
    setLoading(false);
  }
}

function showGuardNotice(missing) {
  el.guardNotice.hidden = false;
  el.guardMissingList.innerHTML = missing.map((f) => `<li>${escHtml(f)}</li>`).join("");
  el.chatMessages.scrollTop = el.chatMessages.scrollHeight;
}

function forceNextStep() {
  const idx = STEP_ORDER.indexOf(session.step);
  if (idx < 0 || idx >= STEP_ORDER.length - 1) return;
  if (!confirm("入力が不完全なまま次のステップへ進みますか？\n（後から戻って補完できます）")) return;
  session = { ...session, step: STEP_ORDER[idx + 1], updatedAt: new Date().toISOString() };
  saveSession(session);
  el.guardNotice.hidden = true;
  renderAll();
}

function formatStep(step) {
  return STEP_META[step]?.label ?? step;
}

// ── ズームモーダル ────────────────────────────────────────────────
function openZoom(initialMode = "svg") {
  openZoomModal(
    currentDiagramSource,
    el.zoomModal,
    el.modalDiagram,
    el.modalCode,
    el.zoomModalTitle,
    initialMode
  );
}

// ── ローディング ──────────────────────────────────────────────────
function setLoading(v) {
  isLoading = v;
  el.chatSendBtn.disabled = v;
  el.chatInput.disabled   = v;
  updateUndoBtn();
  if (!v) renderNavButtons();
  else    { el.nextBtn.disabled = true; el.backBtn.disabled = true; }
  document.body.classList.toggle("loading", v);
}

// ── イベントバインド ──────────────────────────────────────────────
function bindEvents() {
  // チャット送信
  el.chatForm.addEventListener("submit", (e) => { e.preventDefault(); sendChat(); });
  el.chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); }
  });

  // ナビゲーション
  el.nextBtn.addEventListener("click", () => doAdvance("NEXT"));
  el.backBtn.addEventListener("click", () => doAdvance("BACK"));
  el.forceNextBtn.addEventListener("click", forceNextStep);

  // Mermaid コード表示（モーダル）
  el.showCodeBtn.addEventListener("click", () => openZoom("code"));

  // 印刷・PDF 出力（別タブ）
  el.printDiagramBtn?.addEventListener("click", () => printDiagram(session));

  // 固定レイアウト図のズームコントローラー
  el.diagramFitBtn?.addEventListener("click", fitDiagram);
  el.diagramZoomInBtn?.addEventListener("click", () => zoomDiagram(1.15));
  el.diagramZoomOutBtn?.addEventListener("click", () => zoomDiagram(1 / 1.15));

  // モーダル閉じる
  el.zoomModalClose.addEventListener("click", () => { el.zoomModal.hidden = true; });
  el.zoomModal.addEventListener("click", (e) => { if (e.target === el.zoomModal) el.zoomModal.hidden = true; });

  // モーダル内タブ切り替え
  document.getElementById("modalTabs")?.addEventListener("click", (e) => {
    const tab = e.target.closest("[data-mode]");
    if (!tab) return;
    const mode = tab.dataset.mode;
    document.querySelectorAll(".modal-tab").forEach((t) => t.classList.toggle("active", t === tab));
    el.modalDiagram.hidden = mode !== "svg";
    el.modalCode.hidden    = mode !== "code";
  });

  // ペイン境界スプリッター
  initSplitter();

  // ウィンドウリサイズ時も接続線を再描画（デバウンス）
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => redrawConnectors(el.diagramContent), 150);
  });

  // Undo（1手戻し）
  el.undoBtn?.addEventListener("click", undoLastTurn);

  // エクスポート
  el.copyMdBtn.addEventListener("click", () => copyMarkdown(session));
  el.downloadMdBtn.addEventListener("click", () => downloadMarkdown(session));
  el.statusMdBtn?.addEventListener("click", () => downloadStatusMd(session));

  // キーボードショートカット
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !el.zoomModal.hidden) el.zoomModal.hidden = true;
  });
}

// ── Bootstrap ────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  init().catch((e) => {
    console.error("init error", e);
    el.title.textContent = "エラーが発生しました";
  });
});
