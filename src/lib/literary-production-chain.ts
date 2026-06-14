import type { LiteraryChainStepId } from "@/components/literary/LiteraryProductionChain";

export type NovelChainInput = {
  id: string;
  content: string;
  status?: string;
  canContinue?: boolean;
  comics?: { id: string; status?: string }[];
  draftStoryboardComics?: { id: string }[];
};

export type ComicChainInput = {
  id: string;
  novelId?: string | null;
  status?: string;
  panelsWithImage?: number;
  panelsTotal?: number;
};

export function inferNovelChainStep(
  novel: NovelChainInput,
  chapterCount: number,
): LiteraryChainStepId {
  if (novel.status === "draft_generating") return "outline";

  const comics = novel.comics ?? [];
  const hasComics = comics.length > 0;
  const hasDraftStoryboard = (novel.draftStoryboardComics?.length ?? 0) > 0;

  if (hasComics) {
    const latest = comics[comics.length - 1]!;
    if (
      latest.status === "ready" ||
      latest.status === "pending_images" ||
      latest.status === "draft_storyboard"
    ) {
      return latest.status === "ready" ? "comic" : "storyboard";
    }
    return "comic";
  }

  if (hasDraftStoryboard) return "storyboard";
  if (novel.canContinue) return "chapters";

  const contentLen = novel.content?.trim().length ?? 0;
  if (chapterCount >= 2 || contentLen > 4000) return "characters";
  if (contentLen > 800 || chapterCount >= 1) return "chapters";

  return "outline";
}

export function inferComicChainStep(
  comic: ComicChainInput,
  panelStats?: { total: number; withImage: number },
): LiteraryChainStepId {
  const total = panelStats?.total ?? comic.panelsTotal ?? 0;
  const withImage = panelStats?.withImage ?? comic.panelsWithImage ?? 0;

  if (comic.status === "draft_storyboard") return "storyboard";

  if (comic.status === "pending_images") {
    return withImage > 0 ? "comic" : "storyboard";
  }

  if (total > 0 && withImage >= total) return "comic";
  if (total > 0 && withImage > 0) return "comic";
  if (total > 0) return "storyboard";

  return "storyboard";
}

export function buildNovelChainHrefs(
  novelId: string,
  opts?: { latestComicId?: string | null },
): Partial<Record<LiteraryChainStepId, string>> {
  const comicId = opts?.latestComicId ?? null;
  return {
    outline: `/novel/${novelId}`,
    chapters: `/novel/${novelId}`,
    characters: `/novel/${novelId}#character-roster`,
    storyboard: `/comic/create?novelId=${encodeURIComponent(novelId)}`,
    comic: comicId ? `/comic/${comicId}` : `/novel/${novelId}?adaptComic=1`,
  };
}

export function buildComicChainHrefs(
  comicId: string,
  novelId?: string | null,
): Partial<Record<LiteraryChainStepId, string>> {
  if (novelId) {
    return {
      ...buildNovelChainHrefs(novelId, { latestComicId: comicId }),
      storyboard: `/comic/${comicId}#storyboard-outline`,
      comic: `/comic/${comicId}`,
    };
  }
  return {
    outline: `/comic/create`,
    chapters: `/comic/create`,
    characters: `/comic/create`,
    storyboard: `/comic/${comicId}#storyboard-outline`,
    comic: `/comic/${comicId}`,
  };
}
