/**
 * LLM provider 共享工具。
 */

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  const ms = Math.max(1_000, Math.min(90_000, Math.floor(timeoutMs)));
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
