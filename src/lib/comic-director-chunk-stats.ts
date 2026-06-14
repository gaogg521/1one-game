/** 导演分镜 chunk 单次结果（batch 成功 vs 逐页降级） */
export type DirectorStoryboardChunkStat = {
  chunkStart: number;
  chunkEnd: number;
  pagesInChunk: number;
  strategy: "batch" | "per_page" | "fallback_page" | "per_page_fallback";
};

export type DirectorStoryboardRunStats = {
  chunksTotal: number;
  chunksBatch: number;
  chunksPerPage: number;
  /** 0–1，batch 一次成功的 chunk 占比 */
  batchSuccessRate: number;
};

export function accumulateDirectorStoryboardStats(
  chunks: DirectorStoryboardChunkStat[],
): DirectorStoryboardRunStats {
  const chunksTotal = chunks.length;
  const chunksBatch = chunks.filter((c) => c.strategy === "batch").length;
  const chunksPerPage = chunks.filter(
    (c) => c.strategy === "per_page" || c.strategy === "per_page_fallback" || c.strategy === "fallback_page",
  ).length;
  return {
    chunksTotal,
    chunksBatch,
    chunksPerPage,
    batchSuccessRate: chunksTotal > 0 ? chunksBatch / chunksTotal : 1,
  };
}

export function formatDirectorStoryboardStatsLine(
  stats: DirectorStoryboardRunStats,
  locale: "zh" | "en" = "zh",
): string {
  if (stats.chunksTotal === 0) {
    return locale === "en" ? "No director storyboard chunks" : "无导演分镜 chunk";
  }
  const pct = Math.round(stats.batchSuccessRate * 100);
  if (stats.chunksPerPage === 0) {
    return locale === "en"
      ? `Director chunks ${stats.chunksBatch}/${stats.chunksTotal} batch OK (${pct}%)`
      : `导演分镜 ${stats.chunksBatch}/${stats.chunksTotal} 批成功（${pct}%）`;
  }
  return locale === "en"
    ? `Director chunks ${stats.chunksBatch}/${stats.chunksTotal} batch OK; ${stats.chunksPerPage} degraded to per-page`
    : `导演分镜 ${stats.chunksBatch}/${stats.chunksTotal} 批成功，${stats.chunksPerPage} 批已逐页降级`;
}
