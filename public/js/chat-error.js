// チャット応答の空判定と、API エラーの原因別メッセージ生成

/** AI の返答が空だったときにチャットへ表示する文言 */
export const EMPTY_REPLY_MESSAGE = "応答を取得できませんでした。再度お試しください。";

/** HTML エスケープ（XSS 対策） */
function escHtml(str) {
  return String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** 詳細として表示する元メッセージの最大文字数 */
const MAX_DETAIL_LENGTH = 300;

/**
 * AI の返答テキストを検査し、空なら代替文言を返す。
 * @param {unknown} reply API が返した reply
 * @returns {{ text: string, empty: boolean }} 表示するテキストと空だったかどうか
 */
export function normalizeReply(reply) {
  const text = typeof reply === "string" ? reply.trim() : "";
  return text ? { text, empty: false } : { text: EMPTY_REPLY_MESSAGE, empty: true };
}

/**
 * フォールバック（自動補完）バッジの HTML を生成する。
 * AI 本文が空でツール抽出だけ返った際に定型文で補完した場合に表示する。
 * @param {{ synthesized?: boolean, stopReason?: string, hasToolCall?: boolean }} opts
 * @returns {string} バッジ HTML（バッジ不要な場合は空文字）
 */
export function buildFallbackBadgeHtml({ synthesized, stopReason, hasToolCall } = {}) {
  if (!synthesized) return "";

  const debugParts = [];
  if (stopReason)           debugParts.push(`終了理由: ${escHtml(stopReason)}`);
  if (hasToolCall != null)  debugParts.push(`ツール呼出: ${hasToolCall ? "あり" : "なし"}`);
  const debugHtml = debugParts.length
    ? `<span class="chat-debug-info" title="${debugParts.join(" ／ ")}" aria-label="デバッグ情報">🔍 ${escHtml(stopReason || "")}</span>`
    : "";

  return `<div class="chat-fallback-badge">` +
    `<span class="cfb-header"><span class="cfb-icon">⚠️</span>` +
    `<span class="cfb-label">システム自動補完</span>${debugHtml}</span>` +
    `<p class="cfb-note">AIからのテキスト応答がなかったため、確認メッセージを自動生成しました。</p>` +
    `<p class="cfb-guide">次のアクション：` +
    `<span class="cfb-action">入力内容を変えて再送</span> ／ ` +
    `<span class="cfb-action">ノードを手動編集</span> ／ ` +
    `<span class="cfb-action">「次のステップへ」で進む</span>` +
    `</p></div>`;
}

/**
 * API 呼び出しの例外を、原因が分かる日本語メッセージに変換する。
 * @param {Error & { code?: string, status?: number }} e 例外（api.js が code / status を付与）
 * @returns {string} チャットに表示するメッセージ（「❌」は含まない）
 */
export function describeApiError(e) {
  const raw = String(e?.message ?? "不明なエラー");
  const detail = raw.length > MAX_DETAIL_LENGTH ? `${raw.slice(0, MAX_DETAIL_LENGTH)}…` : raw;
  const code = e?.code ?? "";
  const status = e?.status ?? 0;

  if (code === "network_error") {
    return `通信エラー: サーバーに接続できませんでした。ネットワーク状況を確認して再度お試しください。（${detail}）`;
  }
  if (code === "parse_error") {
    return `応答の解析に失敗しました: サーバーの応答が想定外の形式でした。再度お試しください。（${detail}）`;
  }
  if (code === "empty_reply") return detail;
  if (code === "auth_failed" || status === 401) {
    return `認証エラー: パスコードが正しくありません。設定を確認してください。（${detail}）`;
  }
  if (code === "server_misconfigured") return `サーバー設定エラー: ${detail}`;
  if (code === "invalid_input" || code === "invalid_provider" || code === "byok_missing_key") {
    return `入力・設定エラー: ${detail}`;
  }
  if (code === "upstream_error" || status === 502) {
    if (/\b429\b|RESOURCE_EXHAUSTED|rate.?limit|quota/i.test(raw)) {
      return `レートリミット: AI の利用上限に達しました。しばらく待ってから再度お試しください。（${detail}）`;
    }
    if (/\b(401|403)\b|UNAUTHENTICATED|PERMISSION_DENIED|api.?key/i.test(raw)) {
      return `APIキーエラー: キーが無効、または権限がありません。設定を確認してください。（${detail}）`;
    }
    if (/\b404\b|NOT_FOUND|model.*not found/i.test(raw)) {
      return `モデルエラー: 指定のモデルが見つかりません。モデル名の設定を確認してください。（${detail}）`;
    }
    return `AI API エラー: ${detail}`;
  }
  if (status >= 500) return `サーバーエラー (HTTP ${status}): 再度お試しください。（${detail}）`;
  return `エラーが発生しました: ${detail}`;
}
