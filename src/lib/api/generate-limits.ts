/** 单机内存限流阈值（毫秒窗口）；多实例部署需换 Redis/KV（见 README）。 */

function clampInt(n: unknown, lo: number, hi: number, def: number): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return def;
  return Math.max(lo, Math.min(hi, Math.floor(x)));
}

export function generateRateLimits() {
  const windowMsRaw = Number(process.env.GENERATE_RL_WINDOW_MS ?? "60000");
  const windowMs = clampInt(windowMsRaw, 5_000, 300_000, 60_000);

  return {
    windowMs,
    postMax: clampInt(process.env.GENERATE_RL_POST_MAX, 1, 500, 24),
    streamMax: clampInt(process.env.GENERATE_RL_STREAM_MAX, 1, 500, 20),
    variantsMax: clampInt(process.env.GENERATE_RL_VARIANTS_MAX, 1, 300, 10),
  } as const;
}
