import type { ComicStandaloneStepId } from "@/components/literary/ComicStandaloneChain";

export type ComicStandaloneChainInput = {
  id: string;
  status?: string;
  panelsTotal?: number;
  panelsWithImage?: number;
};

export function inferStandaloneComicChainStep(
  comic: ComicStandaloneChainInput,
  panelStats?: { total: number; withImage: number },
): ComicStandaloneStepId {
  const total = panelStats?.total ?? comic.panelsTotal ?? 0;
  const withImage = panelStats?.withImage ?? comic.panelsWithImage ?? 0;

  if (comic.status === "draft_storyboard" && total === 0) return "script";
  if (total === 0) return "storyboard";
  if (withImage >= total && total > 0) return "art";
  if (withImage > 0) return "art";
  return "storyboard";
}

export function buildStandaloneComicChainHrefs(
  comicId: string,
): Partial<Record<ComicStandaloneStepId, string>> {
  return {
    pitch: "/comic/create",
    script: `/comic/${comicId}#storyboard-outline`,
    storyboard: `/comic/${comicId}#storyboard-outline`,
    art: `/comic/${comicId}`,
  };
}
