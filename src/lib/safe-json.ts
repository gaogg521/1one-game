const DEFAULT_MAX_DEPTH = 64;

function clonePlain(value: unknown, seen: WeakSet<object>, depth: number, maxDepth: number): unknown {
  if (depth > maxDepth) return undefined;
  if (value === null || typeof value !== "object") return value;

  if (seen.has(value)) return undefined;
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => clonePlain(item, seen, depth + 1, maxDepth));
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = clonePlain(v, seen, depth + 1, maxDepth);
  }
  return out;
}

/** 去掉循环引用并限制深度，避免 JSON.stringify 触发 Maximum call stack size exceeded */
export function safeJsonStringify(value: unknown, maxDepth = DEFAULT_MAX_DEPTH): string {
  const plain = clonePlain(value, new WeakSet(), 0, maxDepth);
  return JSON.stringify(plain);
}

export function toPlainJson<T>(value: T, maxDepth = DEFAULT_MAX_DEPTH): T {
  return JSON.parse(safeJsonStringify(value, maxDepth)) as T;
}
