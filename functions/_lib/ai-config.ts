// オーナーモードの AI プロバイダ・モデル・APIキーを環境変数から解決する（実行時 import なし。単体テストから直接読み込める）

import type { LLMProvider } from "./types.js";

/** プロバイダ別の推奨デフォルトモデル（AI_MODEL / BYOK のモデル指定が空のとき使用） */
export const DEFAULT_MODELS: Record<LLMProvider, string> = {
  anthropic: "claude-sonnet-4-6",
  gemini:    "gemini-3.8-flash",
  openai:    "gpt-4o-mini",
};

/** AI_PROVIDER 未指定時のプロバイダ */
export const DEFAULT_PROVIDER: LLMProvider = "gemini";

/** 対応プロバイダ一覧 */
export const SUPPORTED_PROVIDERS: readonly LLMProvider[] = ["gemini", "anthropic", "openai"];

/** AI_API_KEY 未設定時にフォールバックするプロバイダ別の環境変数名（後方互換） */
export const PROVIDER_KEY_ENV: Record<LLMProvider, string> = {
  gemini:    "GEMINI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  openai:    "OPENAI_API_KEY",
};

/** 解決に使う環境変数の最小構造 */
export interface AiEnv {
  AI_PROVIDER?: string;
  AI_MODEL?: string;
  AI_API_KEY?: string;
  GEMINI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
}

export type OwnerLlmResult =
  | { ok: true; provider: LLMProvider; model: string; apiKey: string }
  | { ok: false; status: number; code: string; message: string };

/**
 * オーナーモードで使う LLM 設定を環境変数から解決する。
 * プロバイダ: AI_PROVIDER（既定 gemini）／モデル: AI_MODEL（既定はプロバイダ別推奨値）／
 * キー: AI_API_KEY を優先し、なければプロバイダ別の従来変数。
 * @param {AiEnv} env Cloudflare の環境変数
 * @returns {OwnerLlmResult} 解決結果またはエラー情報
 */
export function resolveOwnerLlm(env: AiEnv): OwnerLlmResult {
  const rawProvider = (env.AI_PROVIDER ?? "").trim().toLowerCase();
  const provider = (rawProvider || DEFAULT_PROVIDER) as LLMProvider;
  if (!SUPPORTED_PROVIDERS.includes(provider)) {
    return {
      ok: false, status: 500, code: "server_misconfigured",
      message: `AI_PROVIDER が不正です: ${rawProvider}（${SUPPORTED_PROVIDERS.join(" / ")} のいずれかを指定してください）`,
    };
  }

  const keyEnv = PROVIDER_KEY_ENV[provider];
  const apiKey = (env.AI_API_KEY ?? "").trim() || ((env as Record<string, string | undefined>)[keyEnv] ?? "").trim();
  if (!apiKey) {
    return {
      ok: false, status: 500, code: "server_misconfigured",
      message: `サーバーに ${keyEnv} が設定されていません`,
    };
  }

  const model = (env.AI_MODEL ?? "").trim() || DEFAULT_MODELS[provider];
  return { ok: true, provider, model, apiKey };
}
