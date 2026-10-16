// API クライアント — /api/chat, /api/advance, /api/diagram

async function request(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = Object.assign(new Error(data?.error?.message ?? `HTTP ${res.status}`), { data, status: res.status });
    throw err;
  }
  return data;
}

/** POST /api/chat — チャットメッセージ送信 */
export async function chat(session, message) {
  return request("api/chat", { session, message, step: session.step });
}

/** POST /api/advance — ステップ進行（NEXT / BACK / RESET） */
export async function advance(session, event) {
  return request("api/advance", { session, event });
}

/** POST /api/diagram — オンデマンド図再生成 */
export async function diagram(session, step) {
  return request("api/diagram", { session, step });
}
