// index.html — スタート画面のアプリケーションロジック

import { APP_VERSION } from "../config.js";
import {
  listSessions, deleteSession, clearAllSessions,
  createNewSession, saveSession, savePendingMessage,
} from "./storage.js";
import { parseImportText } from "./import-parser.js";

const SAMPLE_BULK = `現在の課題：
・社内の情報共有ツールが古く、部門間の連携が非効率なため、プロジェクトの進捗が遅れがちです
・週に平均5時間が無駄な調整会議や確認作業に費やされています

理想的な状態：
・リアルタイムで情報が共有され、担当者が即座に状況を把握できる
・意思決定のリードタイムが現在の3日から1日以内に短縮される

提案：
・Slack と Notion を統合した新しいワークフローを導入し、情報の一元管理を実現する
・IT部門2名が1ヶ月で初期設定、3ヶ月後に全社展開

期待効果：
・調整コスト50%削減
・チームの生産性向上でプロジェクト遅延をゼロに`;

// サンプル業務データ（「📝 サンプルで試す」用の plotData 直接セット版）
const SAMPLE_PLOT = {
  title: "社内情報共有ツール刷新",
  core: {
    reality:  "社内の情報共有ツールが古く、部門間の連携が非効率なため、プロジェクトの進捗が遅れがち。週に平均5時間が無駄な調整会議や確認作業に費やされている。",
    ideal:    "リアルタイムで情報が共有され、担当者が即座に状況を把握できる。意思決定のリードタイムが現在の3日から1日以内に短縮される。",
    proposal: "SlackとNotionを統合した新しいワークフローを導入し、情報の一元管理を実現する。IT部門2名が1ヶ月で初期設定、3ヶ月後に全社展開。",
  },
  // 期待効果（イントロ=頭 / 台座=クロージングの両方に反映）
  frame: {
    hook: "調整コスト50%削減。チームの生産性向上でプロジェクト遅延をゼロに。",
    cta:  "調整コスト50%削減。チームの生産性向上でプロジェクト遅延をゼロに。",
  },
};

// ── DOM refs ────────────────────────────────────────────────────
const $id = (id) => document.getElementById(id);
const resumeSection  = $id("resumeSection");
const sessionList    = $id("sessionList");
const clearAllBtn    = $id("clearAllBtn");
const titleInput     = $id("titleInput");
const startQuickBtn  = $id("startQuickBtn");
const sampleTryBtn   = $id("sampleTryBtn");
const bulkTitle      = $id("bulkTitle");
const bulkInput      = $id("bulkInput");
const loadSampleBtn  = $id("loadSampleBtn");
const startBulkBtn   = $id("startBulkBtn");
const importFileBtn  = $id("importFileBtn");
const importFileInput = $id("importFileInput");
const versionDisplay = $id("versionDisplay");

// ── Init ────────────────────────────────────────────────────────
function init() {
  if (versionDisplay) versionDisplay.textContent = `v${APP_VERSION}`;
  renderResumeSection();
  bindEvents();
}

// ── Resume section ──────────────────────────────────────────────
function renderResumeSection() {
  const sessions = listSessions();
  if (!sessions.length) { resumeSection.hidden = true; return; }

  resumeSection.hidden = false;
  sessionList.innerHTML = "";
  sessions.slice(0, 5).forEach((s) => {
    const card = document.createElement("div");
    card.className = "session-card";
    card.innerHTML = `
      <div class="session-card-icon">🤖</div>
      <div class="session-card-body">
        <div class="session-card-title">${escHtml(s.title)}</div>
        <div class="session-card-meta">${formatStep(s.step)} · ${formatDate(s.updatedAt)}</div>
      </div>
      <button class="session-card-del btn-icon" data-del="${s.id}" title="削除">✕</button>`;

    // カード本体クリック → セッション再開
    card.addEventListener("click", (e) => {
      if (e.target.dataset.del) return;
      location.href = `session.html?id=${encodeURIComponent(s.id)}`;
    });

    // 削除ボタン
    card.querySelector("[data-del]").addEventListener("click", (e) => {
      e.stopPropagation();
      deleteSession(s.id);
      renderResumeSection();
    });

    sessionList.appendChild(card);
  });
}

function formatStep(step) {
  const map = {
    step1_core:      "Step 1: 胴体（コア）",
    step2_drilldown: "Step 2: 左腕・右腕",
    step3_what_how:  "Step 3: 両足（2本柱）",
    step4_verify:    "Step 4: 合体前の点検",
    step5_combine:   "Step 5: 頭・台座",
    complete:        "✅ 完成",
  };
  return map[step] ?? step;
}

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

// ── Tab switching ───────────────────────────────────────────────
function bindTabs() {
  document.querySelectorAll(".start-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".start-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const panelId = tab.dataset.tab === "bulk" ? "panelBulk" : "panelQuick";
      $id("panelQuick").hidden = panelId !== "panelQuick";
      $id("panelBulk").hidden  = panelId !== "panelBulk";
    });
  });
}

// ── Start handlers ──────────────────────────────────────────────
function startQuick() {
  const title = titleInput.value.trim();
  if (!title) { titleInput.focus(); titleInput.classList.add("shake"); setTimeout(() => titleInput.classList.remove("shake"), 600); return; }
  const session = createNewSession(title);
  saveSession(session);
  location.href = `session.html?id=${encodeURIComponent(session.sessionId)}`;
}

/**
 * サンプル業務データを plotData に一括セットし、即座にセッション画面へ遷移する。
 */
function startSample() {
  const session = createNewSession(SAMPLE_PLOT.title);
  session.parts.core.reality     = SAMPLE_PLOT.core.reality;
  session.parts.core.ideal       = SAMPLE_PLOT.core.ideal;
  session.parts.core.proposal    = SAMPLE_PLOT.core.proposal;
  session.parts.frame.intro.hook = SAMPLE_PLOT.frame.hook;
  session.parts.frame.closing.cta = SAMPLE_PLOT.frame.cta;
  session.step = inferStep(session.parts);
  saveSession(session);
  location.href = `session.html?id=${encodeURIComponent(session.sessionId)}`;
}

/**
 * parts の充填度からステップを推定する（サーバーの firstIncompleteStep 相当）
 * @param {object} parts
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

function startBulk() {
  const titleRaw = bulkTitle.value.trim();
  const text     = bulkInput.value.trim();
  if (!text || text.length < 10) { bulkInput.focus(); return; }

  // STATUS.md / Markdown エクスポート形式はローカルパースで即時遷移（API 不要）
  const imported = parseImportText(text);
  if (imported) {
    const title = titleRaw || imported.title;
    const session = createNewSession(title);
    session.parts = imported.parts;
    session.step  = inferStep(imported.parts);
    saveSession(session);
    location.href = `session.html?id=${encodeURIComponent(session.sessionId)}`;
    return;
  }

  // 通常メモ → API バルク抽出フロー（タイトル必須）
  if (!titleRaw) { bulkTitle.focus(); return; }
  const session = createNewSession(titleRaw);
  saveSession(session);
  savePendingMessage(session.sessionId, text);
  location.href = `session.html?id=${encodeURIComponent(session.sessionId)}`;
}

// ── Events ──────────────────────────────────────────────────────
function bindEvents() {
  bindTabs();

  startQuickBtn.addEventListener("click", startQuick);
  sampleTryBtn?.addEventListener("click", startSample);
  titleInput.addEventListener("keydown", (e) => { if (e.key === "Enter") startQuick(); });

  startBulkBtn.addEventListener("click", startBulk);
  loadSampleBtn.addEventListener("click", () => {
    if (!bulkTitle.value.trim()) bulkTitle.value = "社内情報共有ツール刷新計画";
    bulkInput.value = SAMPLE_BULK;
    bulkInput.focus();
  });

  clearAllBtn?.addEventListener("click", () => {
    if (confirm("すべてのセッションを削除しますか？この操作は取り消せません。")) {
      clearAllSessions();
      renderResumeSection();
    }
  });

  // ファイルインポート
  importFileBtn?.addEventListener("click", () => importFileInput?.click());
  importFileInput?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = String(ev.target.result);
      bulkInput.value = text;
      if (!bulkTitle.value.trim()) {
        bulkTitle.value = file.name.replace(/\.(md|txt)$/i, "").slice(0, 100);
      }
      // bulk タブに切り替え
      document.querySelector('.start-tab[data-tab="bulk"]')?.click();
      bulkInput.focus();
    };
    reader.readAsText(file, "utf-8");
    e.target.value = ""; // 同じファイルを再選択可能にする
  });
}

function escHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

document.addEventListener("DOMContentLoaded", init);
