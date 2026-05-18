export type NovelCoverFallbackInput = {
  id: string;
  title: string;
  summary?: string | null;
  prompt?: string | null;
};

/**
 * 列表/广场：不再用漫画首格顶替小说封面（避免玄幻配图污染小说封面文件与展示）。
 */
export async function resolveNovelCoverFallbackUrls(
  novels: NovelCoverFallbackInput[],
): Promise<Map<string, string>> {
  void novels;
  return new Map();
}

/** @deprecated 不再落盘漫画首格为小说封面 */
export async function resolveNovelCoverFallbacks(
  novels: NovelCoverFallbackInput[],
): Promise<Map<string, string>> {
  void novels;
  return new Map();
}
