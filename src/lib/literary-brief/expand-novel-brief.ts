import { detectBriefInputLocale } from "@/lib/creative-brief/detect-input-locale";
import {
  buildNovelPipelinePrompt,
  formatNovelBriefForPipeline,
  formatNovelBriefOneLineSummary,
  mergeNovelBriefRevision,
} from "@/lib/literary-brief/format-novel-brief";
import { llmExpandNovelBrief } from "@/lib/literary-brief/llm-expand-novel";
import { getNovelBriefPack } from "@/lib/literary-brief/novel-packs";
import {
  NOVEL_CREATIVE_BRIEF_SCHEMA,
  type ExpandNovelBriefParams,
  type ExpandNovelBriefResult,
  type NovelBriefUserRevision,
  type NovelCreativeBrief,
} from "@/lib/literary-brief/novel-types";
import { getNovelGenreTag } from "@/lib/novel-genre-tags";

const NOVEL_BRIEF_MARKER = "【AI 深度扩写 · 小说创意构思】";

function briefFromNovelPack(
  userPrompt: string,
  pack: ReturnType<typeof getNovelBriefPack>,
  title?: string,
  genreId?: string,
): NovelCreativeBrief {
  const t = title?.trim() || userPrompt.trim().slice(0, 40);
  const ctx = { title: t, userLine: userPrompt };
  return NOVEL_CREATIVE_BRIEF_SCHEMA.parse({
    version: 1,
    userPrompt: userPrompt.trim(),
    title: title?.trim() || undefined,
    genreId: genreId ?? pack.id,
    genreLabel: pack.label,
    inputLocale: detectBriefInputLocale(userPrompt),
    logline: pack.logline(ctx),
    setting: pack.setting,
    world: pack.world,
    protagonist: pack.protagonist,
    characters: pack.characters,
    antagonists: pack.antagonists,
    coreConflict: pack.coreConflict,
    protagonistGoal: pack.protagonistGoal,
    plotBeats: pack.plotBeats,
    keyScenes: pack.keyScenes,
    tone: pack.tone,
    writingStyle: pack.writingStyle,
    narrativeHints: pack.narrativeHints,
    negatives: pack.negatives,
    expandSource: "pack",
  });
}

export type ExpandNovelBriefOptions = ExpandNovelBriefParams & {
  userRevision?: NovelBriefUserRevision | null;
};

/** 小说专用：一句话 / 书名+类型 → 网文创意构思（不走游戏题材包） */
export async function expandNovelCreativeBrief(
  params: ExpandNovelBriefOptions,
): Promise<ExpandNovelBriefResult> {
  const userPrompt = params.prompt.trim();
  const genreTag = getNovelGenreTag(params.genreId);
  const pack = getNovelBriefPack(genreTag?.id ?? params.genreId);

  if (userPrompt.includes(NOVEL_BRIEF_MARKER)) {
    let brief = briefFromNovelPack(userPrompt.split("\n")[0] ?? userPrompt, pack, params.title, pack.id);
    if (params.userRevision) brief = mergeNovelBriefRevision(brief, params.userRevision);
    return {
      brief,
      augmentedPrompt: buildNovelPipelinePrompt(userPrompt, brief, params.userRevision),
      oneLineSummary: formatNovelBriefOneLineSummary(brief),
    };
  }

  let brief = briefFromNovelPack(userPrompt, pack, params.title, pack.id);
  if (params.userRevision) brief = mergeNovelBriefRevision(brief, params.userRevision);

  if (!params.skipLlm) {
    brief = await llmExpandNovelBrief(brief);
  }

  const augmentedPrompt = buildNovelPipelinePrompt(userPrompt, brief, params.userRevision);

  return {
    brief,
    augmentedPrompt,
    oneLineSummary: formatNovelBriefOneLineSummary(brief),
  };
}

export function parseNovelCreativeBrief(raw: unknown): NovelCreativeBrief | null {
  const parsed = NOVEL_CREATIVE_BRIEF_SCHEMA.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
