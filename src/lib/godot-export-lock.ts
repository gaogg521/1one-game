/** 按 exportId + 阶段串行化，避免 prepare / web 导出共用同一把锁导致 Promise 类型串台 */
const locks = new Map<string, Promise<unknown>>();

function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = locks.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const job = fn().finally(() => {
    if (locks.get(key) === job) locks.delete(key);
  });
  locks.set(key, job);
  return job;
}

export function withGodotPrepareLock<T>(exportId: string, fn: () => Promise<T>): Promise<T> {
  return withLock(`prepare:${exportId}`, fn);
}

export function withGodotWebExportLock<T>(exportId: string, fn: () => Promise<T>): Promise<T> {
  return withLock(`web:${exportId}`, fn);
}
