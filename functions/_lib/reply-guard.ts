// LLM 応答の空判定と履歴の空ターン除去（実行時 import なし。単体テストから直接読み込める）

import type { ConversationTurn } from "./types.js";

export type ReplyResolution =
  | { ok: true; reply: string; synthesized: boolean }
  | { ok: false; status: number; code: string; message: string };

/**
 * LLM の応答本文が空のときの扱いを決める。
 * 本文あり → そのまま返す。
 * 本文なし＋抽出あり → synthesized=true・reply="" を返す（フロントがシステム通知を表示する）。
 * 本文なし＋抽出なし → empty_reply エラー。
 * @param {string} reply LLM が返した本文
 * @param {unknown} extracted ツール呼び出しによる抽出結果
 * @param {string} [stopReason] 終了理由（MAX_TOKENS / SAFETY など。診断用）
 * @returns {ReplyResolution} 判定結果
 */
export function resolveReply(reply: string, extracted: unknown, stopReason?: string): ReplyResolution {
  const text = (reply ?? "").trim();
  if (text) return { ok: true, reply: text, synthesized: false };
  if (extracted && typeof extracted === "object" && Object.keys(extracted).length > 0) {
    return { ok: true, reply: "", synthesized: true };
  }
  const detail = stopReason ? `（終了理由: ${stopReason}）` : "";
  return {
    ok: false, status: 502, code: "empty_reply",
    message: `AI から空の応答が返りました${detail}。もう一度送信してください。`,
  };
}

/**
 * 履歴から本文が空のターンを除く。空の assistant ターンが残っていると
 * Claude / Gemini が次リクエストを 400 で拒否するため、過去の空ターンもここで除去する。
 * @param {ConversationTurn[]} history 会話履歴
 * @returns {ConversationTurn[]} 空ターンを除いた履歴
 */
export function dropEmptyTurns(history: ConversationTurn[]): ConversationTurn[] {
  return history.filter((turn) => typeof turn.content === "string" && turn.content.trim() !== "");
}
