// API クライアント — /api/chat, /api/advance, /api/diagram（モードヘッダー付き）

import { getModeHeaders } from "./settings.js";

async function request(path, body, extraHeaders = {}) {
  let res;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getModeHeaders(), ...extraHeaders },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.error(`[logi-bot] ${path} 通信失敗`, e);
    throw Object.assign(new Error(e?.message ?? "fetch failed"), { code: "network_error" });
  }
  let parseFailed = false;
  const data = await res.json().catch(() => { parseFailed = true; return {}; });
  if (!res.ok) {
    console.error(`[logi-bot] ${path} HTTP ${res.status}`, data);
    throw Object.assign(new Error(data?.error?.message ?? `HTTP ${res.status}`), {
      data, status: res.status, code: data?.error?.code ?? "http_error",
    });
  }
  if (parseFailed) {
    console.error(`[logi-bot] ${path} 応答が JSON ではありません (HTTP ${res.status})`);
    throw Object.assign(new Error("応答が JSON ではありません"), { status: res.status, code: "parse_error" });
  }
  return data;
}

/** POST /api/chat */
export async function chat(session, message) {
  return request("api/chat", { session, message, step: session.step });
}

/** POST /api/advance */
export async function advance(session, event) {
  return request("api/advance", { session, event });
}

/** POST /api/diagram */
export async function diagram(session, step) {
  return request("api/diagram", { session, step });
}
