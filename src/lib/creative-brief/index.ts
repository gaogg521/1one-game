export type {
  BriefMedium,
  CreativeBrief,
  ExpandCreativeBriefParams,
  ExpandCreativeBriefResult,
  ParsedIntent,
} from "@/lib/creative-brief/types";
export { formatCreativeBriefForNovel } from "@/lib/creative-brief/format-novel";
export { formatCreativeBriefForComic } from "@/lib/creative-brief/format-comic";
export { resolveMediaCreativeBrief, extractComicCreativePitch } from "@/lib/creative-brief/resolve-media-brief";
export type { MediaBriefResult, ResolveMediaBriefOptions } from "@/lib/creative-brief/resolve-media-brief";
export { promptHasCreativeBriefBlock, BRIEF_MARKERS } from "@/lib/creative-brief/brief-markers";
export { fetchCreativeBriefPreview, type BriefPreviewResult } from "@/lib/creative-brief/preview-client";
export { expandCreativeBrief, type ExpandCreativeBriefOptions } from "@/lib/creative-brief/expand-brief";
export { parseCreativeIntent } from "@/lib/creative-brief/parse-intent";
export { selectGenrePack, GENRE_PACKS } from "@/lib/creative-brief/genre-packs";
export {
  buildStudioBriefBullets,
  formatBriefOneLineSummary,
  formatCreativeBriefForGameSpec,
} from "@/lib/creative-brief/format-prompt";
export {
  lintBriefThemeAlignment,
  alignSpecThemeFromBrief,
  applyBriefThemeHints,
} from "@/lib/creative-brief/lint-theme";
export {
  buildGameKeyArtPromptFromBrief,
  briefPackToCoverGenre,
} from "@/lib/creative-brief/cover-prompt";
export {
  type BriefUserRevision,
  buildPipelinePromptFromBrief,
  buildPromptWithBriefRevision,
  formatRevisionBlock,
  mergeBriefRevision,
} from "@/lib/creative-brief/format-revision";
export { detectBriefInputLocale, type BriefInputLocale } from "@/lib/creative-brief/detect-input-locale";
export { buildBriefLlmSystemPrompt } from "@/lib/creative-brief/locale-prompts";
