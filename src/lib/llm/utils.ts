/**
 * LLM provider 共享工具。
 */

import { envIntPositive } from "@/lib/llm/openai-token-param";

/** 单个 LLM 请求在 Promise.race 上的上限（毫秒）；可通过环境变量拉大以支撑长篇小说等长耗时调用。 */
function llmWithTimeoutBudgetMs(requested: number): number {
  const hardCap = envIntPositive("LLM_WITH_TIMEOUT_MAX_MS", 600_000);
  return Math.max(1_000, Math.min(hardCap, Math.floor(requested)));
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  const ms = llmWithTimeoutBudgetMs(timeoutMs);
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const timer = setTimeout(() => {
        clearTimeout(timer);
        reject(new Error(`${label} timeout after ${ms}ms`));
      }, ms);
    }),
  ]);
}
