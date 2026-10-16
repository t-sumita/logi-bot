// マルチプロバイダ LLM ディスパッチャー

import type { LLMProvider } from "./types.js";
import type { ClaudeRequest, ClaudeResponse } from "./claude.js";
import { callClaudeApi } from "./claude.js";
import { callGeminiApi } from "./gemini.js";
import { callOpenAiApi } from "./openai.js";

/** プロバイダ・モデル・APIキーをまとめた設定 */
export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey: string;
}

/** デフォルトモデル（BYOK モードで省略されたとき使用） */
export const DEFAULT_MODELS: Record<LLMProvider, string> = {
  anthropic: "claude-sonnet-4-6",
  gemini:    "gemini-2.5-flash",
  openai:    "gpt-4o-mini",
};

/**
 * プロバイダに応じて対応 LLM API を呼び出し、
 * 共通の ClaudeResponse 形式で返す。
 */
export async function callLLM(
  config: LLMConfig,
  req: ClaudeRequest
): Promise<ClaudeResponse> {
  const model = config.model || DEFAULT_MODELS[config.provider];
  switch (config.provider) {
    case "anthropic":
      return callClaudeApi(config.apiKey, req);
    case "gemini":
      return callGeminiApi(config.apiKey, model, req);
    case "openai":
      return callOpenAiApi(config.apiKey, model, req);
    default:
      throw new Error(`未対応のプロバイダ: ${config.provider as string}`);
  }
}
