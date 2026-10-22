// デバッグパネル用：API 送受信を1行テキストのログ行に整形する（サーバーログ風の時系列表示）

/** ログとして保持する最大件数（超えた古い行は捨てる） */
export const DEBUG_LOG_MAX = 20;
/** REQ 行に出す送信メッセージのプレビュー文字数 */
export const DEBUG_REQ_PREVIEW_CHARS = 30;
/** RES 行に出す応答本文のプレビュー文字数 */
export const DEBUG_RES_PREVIEW_CHARS = 20;
/** ツール呼び出しの関数名（ログ表示用） */
const TOOL_NAME = "update_session_parts";

/**
 * 時刻を HH:MM:SS の 24 時間表記にする。
 * @param {Date} [at] 対象時刻（既定は現在）
 * @returns {string} HH:MM:SS
 */
export function formatClock(at = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}`;
}

/**
 * ステップ名を "Step4" のような短縮表記にする。
 * @param {string} step ステップ名（例: step4_verify）
 * @returns {string} 短縮表記
 */
export function shortStep(step) {
  const matched = /^step(\d)_/.exec(String(step ?? ""));
  if (matched) return `Step${matched[1]}`;
  if (step === "complete") return "Complete";
  return step ? String(step) : "—";
}

/**
 * 文字列を指定文字数で切り詰める（超過時は省略記号を付ける）。
 * @param {string} text 対象文字列
 * @param {number} max 最大文字数
 * @returns {string} 切り詰めた文字列
 */
function truncate(text, max) {
  const str = String(text ?? "");
  return str.length > max ? `${str.slice(0, max)}…` : str;
}

/** 改行・タブを可視記号に潰して1行に収める */
function toSingleLine(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

/**
 * リクエスト送信時のログ行を作る。
 * 例: [19:00:15] REQ Step4 -> "ユーザーの送信メッセージ…" (11文字)
 * @param {{step: string, message: string, at?: Date}} params 送信内容
 * @returns {{text: string, cls: string}} ログ行
 */
export function formatReqLog({ step, message, at }) {
  const body = toSingleLine(message);
  const text = `[${formatClock(at)}] REQ ${shortStep(step)} -> ` +
    `"${truncate(body, DEBUG_REQ_PREVIEW_CHARS)}" (${body.length}文字)`;
  return { text, cls: "log-req" };
}

/**
 * 正常レスポンス受信時のログ行を作る。
 * 例: [19:00:18] RES Step4 <- 200 STOP [ツールのみ: update_session_parts]
 * @param {{step: string, stopReason?: string, hasToolCall?: boolean, reply?: string, at?: Date}} params 応答内容
 * @returns {{text: string, cls: string}} ログ行
 */
export function formatResLog({ step, stopReason, hasToolCall, reply, at }) {
  const body = toSingleLine(reply);
  const parts = [`[${formatClock(at)}] RES ${shortStep(step)} <- 200`, stopReason || "—"];

  if (body) {
    parts.push(`"${truncate(body, DEBUG_RES_PREVIEW_CHARS)}"`);
    if (hasToolCall) parts.push(`[+ツール: ${TOOL_NAME}]`);
  } else if (hasToolCall) {
    parts.push(`[ツールのみ: ${TOOL_NAME}]`);
  } else {
    parts.push("[本文・ツールなし]");
  }
  return { text: parts.join(" "), cls: "log-res" };
}

/**
 * エラー発生時のログ行を作る。
 * 例: [19:00:20] ERR Step4 <- 502 upstream_error (Gemini API 524)
 * @param {{step: string, status?: number, code?: string, message?: string, at?: Date}} params エラー内容
 * @returns {{text: string, cls: string}} ログ行
 */
export function formatErrLog({ step, status, code, message, at }) {
  const detail = toSingleLine(message);
  const text = `[${formatClock(at)}] ERR ${shortStep(step)} <- ${status || "—"} ` +
    `${code || "unknown"}` + (detail ? ` (${truncate(detail, DEBUG_REQ_PREVIEW_CHARS)})` : "");
  return { text, cls: "log-err" };
}

/**
 * ログ配列に1行追記し、保持上限を超えた古い行を捨てた新しい配列を返す。
 * @param {Array<{text: string, cls: string}>} log 既存のログ
 * @param {{text: string, cls: string}} entry 追記する行
 * @returns {Array<{text: string, cls: string}>} 上限内に収めたログ
 */
export function appendLog(log, entry) {
  const next = [...(log ?? []), entry];
  return next.length > DEBUG_LOG_MAX ? next.slice(next.length - DEBUG_LOG_MAX) : next;
}
