import { promptHasCreativeBriefBlock } from "@/lib/creative-brief/brief-markers";
import type { BriefMedium } from "@/lib/creative-brief/types";
import { PRODUCT } from "@/lib/product-config";
import {
  expandNovelCreativeBrief,
  parseNovelCreativeBrief,
  buildNovelPipelinePrompt,
  formatNovelBriefOneLineSummary,
  type NovelBriefUserRevision,
  type NovelCreativeBrief,
} from "@/lib/literary-brief";

export type ResolveMediaBriefOptions = {
  skipLlm?: boolean;
  referenceSnippet?: string;
  userRevision?: NovelBriefUserRevision | null;
  preExpanded?: NovelCreativeBrief | null;
  /** 小说类型标签 id（transmigration / wuxia …） */
  novelGenreId?: string;
  title?: string;
};

export type MediaBriefResult = {
  brief: NovelCreativeBrief;
  augmentedPrompt: string;
  oneLineSummary: string;
};

function briefExpandEnabled(medium: BriefMedium): boolean {
  if (medium === "novel") return PRODUCT.novel.creativeBriefExpand;
  if (medium === "comic") return PRODUCT.comic.creativeBriefExpand;
  return false;
}

/** 小说 / 漫画：文学创意构思扩写（不使用游戏题材包） */
export async function resolveMediaCreativeBrief(
  prompt: string,
  medium: BriefMedium,
  options?: ResolveMediaBriefOptions,
): Promise<MediaBriefResult | null> {
  if (medium === "game") return null;

  const trimmed = prompt.trim();
  if (trimmed.length < 2) return null;
  if (!briefExpandEnabled(medium)) return null;

  const pre = options?.preExpanded;
  if (pre) {
    const brief = parseNovelCreativeBrief(pre) ?? pre;
    return {
      brief,
      augmentedPrompt: buildNovelPipelinePrompt(trimmed, brief, options?.userRevision),
      oneLineSummary: formatNovelBriefOneLineSummary(brief),
    };
  }

  if (promptHasCreativeBriefBlock(trimmed, medium)) return null;

  const result = await expandNovelCreativeBrief({
    prompt: trimmed,
    title: options?.title,
    genreId: options?.novelGenreId,
    skipLlm: options?.skipLlm,
    userRevision: options?.userRevision,
  });

  return {
    brief: result.brief,
    augmentedPrompt: result.augmentedPrompt,
    oneLineSummary: result.oneLineSummary,
  };
}

/** 漫画：从全文或独立创意字段提取用于扩写的一句话 */
export function extractComicCreativePitch(content: string, creativePrompt?: string): string {
  const explicit = creativePrompt?.trim();
  if (explicit && explicit.length >= 2) return explicit.slice(0, 2000);
  const body = content.trim();
  if (body.length <= 700) return body.slice(0, 2000);
  const firstLine = body.split(/\n/).find((l) => l.trim().length >= 4)?.trim();
  return (firstLine ?? body.slice(0, 280)).slice(0, 2000);
}
