// API クライアント — /api/chat, /api/advance, /api/diagram（モードヘッダー付き）

import { getModeHeaders } from "./settings.js";

async function request(path, body, extraHeaders = {}) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getModeHeaders(), ...extraHeaders },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = Object.assign(new Error(data?.error?.message ?? `HTTP ${res.status}`), { data, status: res.status });
    throw err;
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
