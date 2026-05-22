export type {
  NovelCreativeBrief,
  ExpandNovelBriefParams,
  ExpandNovelBriefResult,
  NovelBriefUserRevision,
} from "@/lib/literary-brief/novel-types";
export { NOVEL_CREATIVE_BRIEF_SCHEMA } from "@/lib/literary-brief/novel-types";

export type {
  ChildrenCreativeBrief,
  ChildrenBriefUserRevision,
  ExpandChildrenBriefParams,
  ExpandChildrenBriefResult,
} from "@/lib/literary-brief/children-brief-types";

export { CHILDREN_CREATIVE_BRIEF_SCHEMA } from "@/lib/literary-brief/children-brief-types";

export { expandNovelCreativeBrief, parseNovelCreativeBrief } from "@/lib/literary-brief/expand-novel-brief";
export {
  expandChildrenCreativeBrief,
  parseChildrenCreativeBrief,
  isChildrenCreativeBrief,
  isChildrenBriefExpandRequest,
} from "@/lib/literary-brief/expand-children-brief";

export {
  formatNovelBriefForPipeline,
  formatNovelBriefOneLineSummary,
  buildNovelPipelinePrompt,
  mergeNovelBriefRevision,
} from "@/lib/literary-brief/format-novel-brief";

export {
  formatChildrenBriefForPipeline,
  formatChildrenBriefOneLineSummary,
  buildChildrenPipelinePrompt,
  mergeChildrenBriefRevision,
} from "@/lib/literary-brief/format-children-brief";

export { buildChildrenBriefSeed } from "@/lib/literary-brief/children-brief-types";
