/**
 * OpenGame Browser Bench 开关：显式 env 优先；staging 默认开启。
 */
export function isOpenGameBrowserBenchEnabled(): boolean {
  const raw = process.env.OPENGAME_BROWSER_BENCH?.trim();
  if (raw === "1") return true;
  if (raw === "0") return false;
  if (process.env.STAGING === "1" || process.env.OPERONE_STAGING === "1") return true;
  return false;
}

export function isOpenGameBrowserBenchRepairEnabled(): boolean {
  const raw = process.env.OPENGAME_BROWSER_BENCH_REPAIR?.trim();
  if (raw === "1") return true;
  if (raw === "0") return false;
  return isOpenGameBrowserBenchEnabled();
}

export function isOpenGameBrowserBenchRequired(): boolean {
  return process.env.OPENGAME_BROWSER_BENCH_REQUIRED === "1";
}
