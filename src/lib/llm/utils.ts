/**
 * LLM provider 共享工具。
 */

import { PRODUCT } from "@/lib/product-config";

/** 单个 LLM 请求在 Promise.race 上的上限（毫秒）。 */
function llmWithTimeoutBudgetMs(requested: number): number {
  const hardCap = PRODUCT.llm.withTimeoutMaxMs;
  return Math.max(1_000, Math.min(hardCap, Math.floor(requested)));
}

/**
 * 单次上游 HTTP：超时后通过 AbortSignal 取消 fetch（LiteLLM 侧常记为 context canceled）。
 * 每次调用使用独立 AbortController，避免 json_schema→json_object 回退共用已 abort 的 signal。
 */
export async function runWithAbortTimeout<T>(
  timeoutMs: number,
  label: string,
  fn: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const ms = llmWithTimeoutBudgetMs(timeoutMs);
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  try {
    return await fn(ac.signal);
  } catch (e) {
    if (ac.signal.aborted) {
      const base = e instanceof Error ? e.message : String(e);
      throw new Error(`${label} client-abort after ${ms}ms: ${base}`.slice(0, 800));
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
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
