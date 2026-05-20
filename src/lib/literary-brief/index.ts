export type {
  NovelCreativeBrief,
  ExpandNovelBriefParams,
  ExpandNovelBriefResult,
  NovelBriefUserRevision,
} from "@/lib/literary-brief/novel-types";
export { NOVEL_CREATIVE_BRIEF_SCHEMA } from "@/lib/literary-brief/novel-types";
export { expandNovelCreativeBrief, parseNovelCreativeBrief } from "@/lib/literary-brief/expand-novel-brief";
export {
  formatNovelBriefForPipeline,
  formatNovelBriefOneLineSummary,
  buildNovelPipelinePrompt,
  mergeNovelBriefRevision,
} from "@/lib/literary-brief/format-novel-brief";
