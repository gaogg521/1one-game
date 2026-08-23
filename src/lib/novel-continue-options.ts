import { LONG_NOVEL_PRODUCT } from "@/lib/novel-long-config";

export type NovelContinueOptions = {
  /** null = 本次写完所有待写章（仍受篇幅上限约束） */
  maxChapters: number | null;
  polish: boolean;
  /** Use the recoverable worker instead of holding the HTTP connection open. */
  durable: boolean;
};

export const NOVEL_CONTINUE_CHAPTER_PRESETS = LONG_NOVEL_PRODUCT.continueChapterPresets;

export function parseNovelContinueOptions(body: unknown): NovelContinueOptions {
  const defaults: NovelContinueOptions = {
    maxChapters: LONG_NOVEL_PRODUCT.continueDefaultMaxChapters,
    polish: LONG_NOVEL_PRODUCT.polishAfterSegment,
    durable: false,
  };
  if (!body || typeof body !== "object") return defaults;

  const o = body as Record<string, unknown>;
  const polish = o.polish === false || o.polish === "false" ? false : defaults.polish;

  if (o.maxChapters === 0 || o.maxChapters === "all" || o.maxChapters === null) {
    return { maxChapters: null, polish, durable: o.durable === true };
  }
  if (typeof o.maxChapters === "number" && Number.isFinite(o.maxChapters)) {
    const n = Math.floor(o.maxChapters);
    if (n <= 0) return { maxChapters: null, polish, durable: o.durable === true };
    return { maxChapters: Math.min(24, n), polish, durable: o.durable === true };
  }
  if (typeof o.maxChapters === "string" && /^\d+$/.test(o.maxChapters)) {
    return { maxChapters: Math.min(24, parseInt(o.maxChapters, 10)), polish, durable: o.durable === true };
  }

  return { ...defaults, polish, durable: o.durable === true };
}

export function clampContinueChapterCount(
  requested: number | null | undefined,
  remainingCount: number,
): number | null {
  if (requested == null || requested <= 0) {
    return remainingCount > 0 ? remainingCount : null;
  }
  return Math.min(requested, remainingCount > 0 ? remainingCount : requested);
}
