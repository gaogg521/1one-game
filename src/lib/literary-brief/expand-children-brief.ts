import { ApiKeyedError } from "@/lib/api/api-keyed-error";
import { sanitizeChildrenBriefForTier } from "@/lib/children-brief-sanitize";
import { parseChildrenTargetAge } from "@/lib/children-age-length";
import {
  buildChildrenPipelinePrompt,
  formatChildrenBriefOneLineSummary,
  mergeChildrenBriefRevision,
} from "@/lib/literary-brief/format-children-brief";
import {
  CHILDREN_CREATIVE_BRIEF_SCHEMA,
  seedChildrenCreativeBrief,
  type ChildrenBriefUserRevision,
  type ExpandChildrenBriefResult,
} from "@/lib/literary-brief/children-brief-types";
import { llmExpandChildrenBriefFromSeed } from "@/lib/literary-brief/llm-expand-children-brief";
import { isChildrenGenreTag } from "@/lib/novel-genre-tags";

export type ExpandChildrenBriefOptions = {
  prompt: string;
  title?: string;
  childrenTargetAge?: number;
  skipLlm?: boolean;
  userRevision?: ChildrenBriefUserRevision | null;
};

export { parseChildrenCreativeBrief, isChildrenCreativeBrief } from "@/lib/literary-brief/parse-children-brief";

/** 儿童短篇专用构思扩写（不经过网文 pack / NovelCreativeBrief） */
export async function expandChildrenCreativeBrief(
  params: ExpandChildrenBriefOptions,
): Promise<ExpandChildrenBriefResult> {
  const userPrompt = params.prompt.trim();
  const age = parseChildrenTargetAge(params.childrenTargetAge);
  const title = params.title?.trim();

  let brief = seedChildrenCreativeBrief(userPrompt, title, age);
  if (params.userRevision) {
    brief = mergeChildrenBriefRevision(brief, params.userRevision);
  }

  if (!params.skipLlm) {
    brief = await llmExpandChildrenBriefFromSeed(brief);
  }

  brief = sanitizeChildrenBriefForTier(brief, age);
  const checked = CHILDREN_CREATIVE_BRIEF_SCHEMA.safeParse(brief);
  if (!checked.success) {
    throw new ApiKeyedError("expandChildrenInvalid");
  }
  brief = checked.data;

  return {
    brief,
    augmentedPrompt: buildChildrenPipelinePrompt(userPrompt, brief, params.userRevision),
    oneLineSummary: formatChildrenBriefOneLineSummary(brief),
  };
}

export function isChildrenBriefExpandRequest(genreId?: string): boolean {
  return isChildrenGenreTag(genreId);
}
