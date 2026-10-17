// localStorage セッション管理 — 保存・読み込み・一覧・削除

const PREFIX = "logiSession_";
const LIST_KEY = "logiSessionList";
const PENDING_PREFIX = "logiPending_";

export function saveSession(session) {
  const s = { ...session, updatedAt: new Date().toISOString() };
  localStorage.setItem(PREFIX + s.sessionId, JSON.stringify(s));
  _updateList(s);
}

export function loadSession(sessionId) {
  const raw = localStorage.getItem(PREFIX + sessionId);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function listSessions() {
  const raw = localStorage.getItem(LIST_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export function deleteSession(sessionId) {
  localStorage.removeItem(PREFIX + sessionId);
  localStorage.removeItem(PENDING_PREFIX + sessionId);
  const list = listSessions().filter((x) => x.id !== sessionId);
  localStorage.setItem(LIST_KEY, JSON.stringify(list));
}

export function clearAllSessions() {
  const list = listSessions();
  list.forEach((x) => {
    localStorage.removeItem(PREFIX + x.id);
    localStorage.removeItem(PENDING_PREFIX + x.id);
  });
  localStorage.removeItem(LIST_KEY);
}

export function savePendingMessage(sessionId, message) {
  localStorage.setItem(PENDING_PREFIX + sessionId, message);
}

export function consumePendingMessage(sessionId) {
  const msg = localStorage.getItem(PENDING_PREFIX + sessionId);
  if (msg !== null) localStorage.removeItem(PENDING_PREFIX + sessionId);
  return msg;
}

export function generateSessionId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function createNewSession(title) {
  const now = new Date().toISOString();
  return {
    sessionId: generateSessionId(),
    title: title.trim() || "無題のセッション",
    step: "step1_core",
    status: "in_progress",
    fast_track: false,
    createdAt: now,
    updatedAt: now,
    parts: {
      core:         { reality: "", ideal: "", proposal: "" },
      drilldown:    { reality_factors: [], ideal_goals: [], gap_summary: "" },
      what_how:     { what_items: [], how_items: [], who_when: [] },
      verification: { contradictions: [], is_consistent: false },
      frame: {
        intro:   { audience: "", hook: "" },
        closing: { cta: "" },
        title:   "",
      },
    },
    diagrams: {},
    history:  [],
  };
}

function _updateList(session) {
  const list = listSessions();
  const idx = list.findIndex((x) => x.id === session.sessionId);
  const entry = { id: session.sessionId, title: session.title, updatedAt: session.updatedAt, step: session.step };
  if (idx >= 0) {
    list[idx] = entry;
  } else {
    list.unshift(entry);
  }
  localStorage.setItem(LIST_KEY, JSON.stringify(list));
}
