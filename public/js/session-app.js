// session.html — セッション画面のメインアプリケーションロジック

import { loadSession, saveSession, createNewSession, consumePendingMessage } from "./storage.js";
import { chat as apiChat, advance as apiAdvance } from "./api.js";
import { renderDiagram, openZoomModal } from "./mermaid-renderer.js";
import { copyMarkdown, downloadMarkdown } from "./export.js";

// ── ステップ定義 ──────────────────────────────────────────────────
const STEP_META = {
  step1_core:      { label: "Step 1 / 5 — 🫀 胴体（コア）",        diagramKey: "step1", index: 1,
    placeholder: "" },
  step2_drilldown: { label: "Step 2 / 5 — 💪🛡️ 左腕・右腕",        diagramKey: "step2", index: 2,
    placeholder: "【現実の原因データ／理想の数値目標を入力】例：現実＝1日120通受信・月3件見落とし ／ 理想＝見落としゼロ・確認5分以内" },
  step3_what_how:  { label: "Step 3 / 5 — 🦿 両足（2本柱）",        diagramKey: "step3", index: 3,
    placeholder: "【What（何を）／How（体制・予算・時期）を入力】例：What＝自動フィルタと要約通知 ／ How＝開発2週間・予算0円・来月開始" },
  step4_verify:    { label: "Step 4 / 5 — 🔍 合体前の点検",          diagramKey: "step4", index: 4,
    placeholder: "【修正したい点や追加の補足があれば入力】（問題なければ「次のステップへ」をクリック）" },
  step5_combine:   { label: "Step 5 / 5 — 🧠🗂️ 頭・台座",           diagramKey: "step5", index: 5,
    placeholder: "【頭（イントロ）／台座（クロージング・次の行動）を入力】例：イントロ＝メール処理に追われていませんか？ ／ 締め＝今週テスト導入しましょう" },
  complete:        { label: "合体完了 🎉",                            diagramKey: "final", index: 6,
    placeholder: "" },
};

const STEP_ORDER = ["step1_core","step2_drilldown","step3_what_how","step4_verify","step5_combine","complete"];

const WELCOME_MESSAGE = (title) =>
`🤖 **logi-botへようこそ！**「${title}」を一緒に図解していきましょう。

これから合体ロボの **5ステップ** を組み立てていきます：

　🫀 **① 胴体（コア）** → 現実・理想・提案
　💪🛡️ **② 左腕・右腕** → 現実・理想の深掘り
　🦿 **③ 両足（2本柱）** → 何を？ / どうやって？
　🔍 **④ 合体前の点検** → 矛盾・ブレの検証
　🧠🗂️ **⑤ 頭・台座** → イントロ・クロージング

---

まず **Step 1: 胴体（コア）** から始めましょう。

まずはStep 1の **①現実（いま起きている課題）** を教えてください。`;

// ── アプリ状態 ────────────────────────────────────────────────────
let session = null;
let isLoading = false;
let currentDiagramTab = "current";
let currentDiagramSource = "";

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
  diagramTabs:      $("diagramTabs"),
  zoomDiagramBtn:   $("zoomDiagramBtn"),
  showCodeBtn:      $("showCodeBtn"),
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

  renderAll();

  // 会話履歴が空なら Welcome を表示
  if (session.history.length === 0) {
    addMessage("assistant", WELCOME_MESSAGE(session.title));
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
      reality:  "【① 現実（今の課題）を入力】例：毎日大量のメールが届き、大事な連絡を見落としている",
      ideal:    "【② 理想（あるべき姿）を入力】例：重要メールだけを即座に把握し、確認時間を1日5分に短縮できている状態",
      proposal: "【③ 提案（解決策の核）を入力】例：AIによる重要メール自動選別＆毎朝の要約通知システムの導入",
      done:     "3要素が揃いました！補足・修正があれば入力してください。「次へ」ボタンで Step 2 へ進めます。",
    };
    el.chatInput.placeholder = placeholders[getStep1Substep()] || "";
  } else {
    const meta = STEP_META[session.step];
    el.chatInput.placeholder = meta?.placeholder || "メッセージを入力… (Enter で送信、Shift+Enter で改行)";
  }
}

// ── 図パネル ──────────────────────────────────────────────────────
async function updateDiagramPanel() {
  const meta = STEP_META[session.step];
  let source = "";
  if (currentDiagramTab === "final") {
    source = session.diagrams.final || "";
  } else if (meta && meta.diagramKey) {
    source = session.diagrams[meta.diagramKey] || "";
  }
  currentDiagramSource = source;
  await renderDiagram(source, el.diagramContent);
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

  el.chatInput.value = "";
  el.guardNotice.hidden = true;
  addMessage("user", message);
  setLoading(true);
  const typingEl = addTypingIndicator();

  try {
    const res = await apiChat(session, message);
    typingEl.remove();
    session = res.session;

    // バルク抽出で diagrams が返ってきた場合はマージ
    if (res.diagrams) {
      session = { ...session, diagrams: { ...session.diagrams, ...res.diagrams } };
    }
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

    // advance で diagram が生成された場合
    if (res.diagram) {
      const key = stepToDiagramKey(prevStep);
      if (key) {
        session = { ...session, diagrams: { ...session.diagrams, [key]: res.diagram } };
      }
    }
    saveSession(session);

    // complete 遷移時に完成バナーを表示
    if (session.step === "complete" && prevStep !== "complete") {
      addMessage("system", "🎉 合体ロボ図が完成しました！右パネルで「合体ロボ全体図」タブを確認してください。");
      currentDiagramTab = "final";
      el.diagramTabs.querySelectorAll(".diagram-tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === "final"));
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

function stepToDiagramKey(step) {
  const map = {
    step1_core:      "step1",
    step2_drilldown: "step2",
    step3_what_how:  "step3",
    step4_verify:    "step4",
    step5_combine:   "step5",
  };
  return map[step] ?? null;
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

  // 図タブ切り替え
  el.diagramTabs.addEventListener("click", (e) => {
    const tab = e.target.closest("[data-tab]");
    if (!tab) return;
    currentDiagramTab = tab.dataset.tab;
    el.diagramTabs.querySelectorAll(".diagram-tab").forEach((t) => t.classList.toggle("active", t === tab));
    updateDiagramPanel();
  });

  // 図ズーム
  el.zoomDiagramBtn.addEventListener("click", () => openZoom("svg"));
  el.showCodeBtn.addEventListener("click", () => openZoom("code"));

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

  // エクスポート
  el.copyMdBtn.addEventListener("click", () => copyMarkdown(session));
  el.downloadMdBtn.addEventListener("click", () => downloadMarkdown(session));

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
