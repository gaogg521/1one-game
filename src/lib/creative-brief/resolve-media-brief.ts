import { promptHasCreativeBriefBlock } from "@/lib/creative-brief/brief-markers";
import type { BriefMedium } from "@/lib/creative-brief/types";
import { PRODUCT } from "@/lib/product-config";
import {
  expandChildrenCreativeBrief,
  parseChildrenCreativeBrief,
  buildChildrenPipelinePrompt,
  formatChildrenBriefOneLineSummary,
  type ChildrenBriefUserRevision,
  type ChildrenCreativeBrief,
} from "@/lib/literary-brief";
import {
  expandNovelCreativeBrief,
  parseNovelCreativeBrief,
  buildNovelPipelinePrompt,
  formatNovelBriefOneLineSummary,
  type NovelBriefUserRevision,
  type NovelCreativeBrief,
} from "@/lib/literary-brief";
import { isChildrenGenreTag } from "@/lib/novel-genre-tags";

export type ResolveMediaBriefOptions = {
  skipLlm?: boolean;
  referenceSnippet?: string;
  userRevision?: NovelBriefUserRevision | ChildrenBriefUserRevision | null;
  preExpanded?: NovelCreativeBrief | ChildrenCreativeBrief | null;
  novelGenreId?: string;
  title?: string;
  childrenTargetAge?: number;
  /** 用户原话语言，避免从 brief seed 误判 */
  inputLocale?: import("@/lib/creative-brief/detect-input-locale").BriefInputLocale;
};

export type MediaBriefResult =
  | {
      kind: "novel";
      brief: NovelCreativeBrief;
      augmentedPrompt: string;
      oneLineSummary: string;
    }
  | {
      kind: "children";
      brief: ChildrenCreativeBrief;
      augmentedPrompt: string;
      oneLineSummary: string;
    };

function briefExpandEnabled(medium: BriefMedium): boolean {
  if (medium === "novel") return PRODUCT.novel.creativeBriefExpand;
  if (medium === "comic") return PRODUCT.comic.creativeBriefExpand;
  return false;
}

/** 小说 / 漫画：文学创意构思扩写 */
export async function resolveMediaCreativeBrief(
  prompt: string,
  medium: BriefMedium,
  options?: ResolveMediaBriefOptions,
): Promise<MediaBriefResult | null> {
  if (medium === "game") return null;

  const trimmed = prompt.trim();
  if (trimmed.length < 2) return null;
  if (!briefExpandEnabled(medium)) return null;

  const isChildren = isChildrenGenreTag(options?.novelGenreId);

  if (isChildren) {
    const pre =
      options?.preExpanded != null
        ? parseChildrenCreativeBrief(options.preExpanded) ?? undefined
        : undefined;
    if (pre) {
      const rev = options?.userRevision as ChildrenBriefUserRevision | null | undefined;
      return {
        kind: "children",
        brief: pre,
        augmentedPrompt: buildChildrenPipelinePrompt(trimmed, pre, rev),
        oneLineSummary: formatChildrenBriefOneLineSummary(pre),
      };
    }
    if (promptHasCreativeBriefBlock(trimmed, medium)) return null;

    const result = await expandChildrenCreativeBrief({
      prompt: trimmed,
      title: options?.title,
      childrenTargetAge: options?.childrenTargetAge,
      skipLlm: options?.skipLlm,
      userRevision: options?.userRevision as ChildrenBriefUserRevision | null | undefined,
    });
    return {
      kind: "children",
      brief: result.brief,
      augmentedPrompt: result.augmentedPrompt,
      oneLineSummary: result.oneLineSummary,
    };
  }

  const preNovel =
    options?.preExpanded != null
      ? parseNovelCreativeBrief(options.preExpanded) ??
        (parseChildrenCreativeBrief(options.preExpanded)
          ? null
          : (options.preExpanded as NovelCreativeBrief))
      : undefined;

  if (preNovel) {
    const rev = options?.userRevision as NovelBriefUserRevision | null | undefined;
    return {
      kind: "novel",
      brief: preNovel,
      augmentedPrompt: buildNovelPipelinePrompt(trimmed, preNovel, rev),
      oneLineSummary: formatNovelBriefOneLineSummary(preNovel),
    };
  }

  if (promptHasCreativeBriefBlock(trimmed, medium)) return null;

  const result = await expandNovelCreativeBrief({
    prompt: trimmed,
    title: options?.title,
    genreId: options?.novelGenreId,
    inputLocale: options?.inputLocale,
    skipLlm: options?.skipLlm,
    userRevision: options?.userRevision as NovelBriefUserRevision | null | undefined,
  });

  return {
    kind: "novel",
    brief: result.brief,
    augmentedPrompt: result.augmentedPrompt,
    oneLineSummary: result.oneLineSummary,
  };
}

export function extractComicCreativePitch(content: string, creativePrompt?: string): string {
  const explicit = creativePrompt?.trim();
  if (explicit && explicit.length >= 2) return explicit.slice(0, 2000);
  const body = content.trim();
  if (body.length <= 700) return body.slice(0, 2000);
  const firstLine = body.split(/\n/).find((l) => l.trim().length >= 4)?.trim();
  return (firstLine ?? body.slice(0, 280)).slice(0, 2000);
}
