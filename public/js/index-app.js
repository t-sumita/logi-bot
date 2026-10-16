// index.html — スタート画面のアプリケーションロジック

import { APP_VERSION } from "../config.js";
import {
  listSessions, deleteSession, clearAllSessions,
  createNewSession, saveSession, savePendingMessage,
} from "./storage.js";

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

// ── DOM refs ────────────────────────────────────────────────────
const $id = (id) => document.getElementById(id);
const resumeSection = $id("resumeSection");
const sessionList   = $id("sessionList");
const clearAllBtn   = $id("clearAllBtn");
const titleInput    = $id("titleInput");
const startQuickBtn = $id("startQuickBtn");
const bulkTitle     = $id("bulkTitle");
const bulkInput     = $id("bulkInput");
const loadSampleBtn = $id("loadSampleBtn");
const startBulkBtn  = $id("startBulkBtn");
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
    idle: "準備中", onboarding: "オンボーディング",
    step1_core: "Step 1", step2_drilldown: "Step 2",
    step3_what_how: "Step 3", step4_verify: "Step 4",
    step5_combine: "Step 5", complete: "✅ 完成",
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

function startBulk() {
  const title = bulkTitle.value.trim();
  const text  = bulkInput.value.trim();
  if (!title) { bulkTitle.focus(); return; }
  if (text.length < 10) { bulkInput.focus(); return; }
  const session = createNewSession(title);
  saveSession(session);
  savePendingMessage(session.sessionId, text);
  location.href = `session.html?id=${encodeURIComponent(session.sessionId)}`;
}

// ── Events ──────────────────────────────────────────────────────
function bindEvents() {
  bindTabs();

  startQuickBtn.addEventListener("click", startQuick);
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
}

function escHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

document.addEventListener("DOMContentLoaded", init);
