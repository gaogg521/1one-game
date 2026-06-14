/** 单格配图默认耗时（2～8 分钟区间中值，用于 ETA 展示） */
export const DEFAULT_COMIC_PANEL_MS = 3 * 60 * 1000;
export const MIN_COMIC_PANEL_MS = 2 * 60 * 1000;
export const MAX_COMIC_PANEL_MS = 8 * 60 * 1000;

export function clampPanelDurationMs(ms: number): number {
  if (!Number.isFinite(ms) || ms <= 0) return DEFAULT_COMIC_PANEL_MS;
  return Math.min(MAX_COMIC_PANEL_MS, Math.max(MIN_COMIC_PANEL_MS, ms));
}

/** 根据剩余格数估算总耗时（毫秒） */
export function estimateComicPanelEtaMs(
  remainingPanels: number,
  avgMsPerPanel?: number,
): number {
  const n = Math.max(0, Math.floor(remainingPanels));
  if (n === 0) return 0;
  const per = clampPanelDurationMs(avgMsPerPanel ?? DEFAULT_COMIC_PANEL_MS);
  return n * per;
}

/** 流式配图过程中用已完成格数推算单格均值 */
export function avgPanelMsFromSession(opts: {
  panelsCompletedThisSession: number;
  elapsedMs: number;
}): number | undefined {
  if (opts.panelsCompletedThisSession <= 0 || opts.elapsedMs <= 0) return undefined;
  return opts.elapsedMs / opts.panelsCompletedThisSession;
}
