import type { RunTraceRecorder } from "@/lib/orchestration/run-trace";
import { promptHasCreativeBriefBlock } from "@/lib/creative-brief/brief-markers";
import { formatCreativeBriefForComic } from "@/lib/creative-brief/format-comic";
import { formatCreativeBriefForNovel } from "@/lib/creative-brief/format-novel";
import {
  formatBriefOneLineSummary,
  formatCreativeBriefForGameSpec,
} from "@/lib/creative-brief/format-prompt";
import { GENRE_PACKS, selectGenrePack } from "@/lib/creative-brief/genre-packs";
import { llmExpandCreativeBrief } from "@/lib/creative-brief/llm-expand";
import { detectBriefInputLocale } from "@/lib/creative-brief/detect-input-locale";
import { parseCreativeIntent } from "@/lib/creative-brief/parse-intent";
import { formatRevisionBlock, mergeBriefRevision, type BriefUserRevision } from "@/lib/creative-brief/format-revision";
import type {
  BriefMedium,
  CreativeBrief,
  ExpandCreativeBriefParams,
  ExpandCreativeBriefResult,
} from "@/lib/creative-brief/types";
import { CREATIVE_BRIEF_SCHEMA } from "@/lib/creative-brief/types";
import type { GameSpec } from "@/lib/game-spec";

function briefFromPack(
  userPrompt: string,
  pack: ReturnType<typeof selectGenrePack>,
  intent: ReturnType<typeof parseCreativeIntent>,
  inputLocale: ReturnType<typeof detectBriefInputLocale>,
): CreativeBrief {
  return CREATIVE_BRIEF_SCHEMA.parse({
    version: 1,
    userPrompt: userPrompt.trim(),
    inputLocale,
    logline: pack.logline(userPrompt),
    packId: pack.id,
    packLabel: pack.label,
    intent,
    world: pack.world,
    scenes: pack.scenes,
    factions: pack.factions,
    units: pack.units,
    weapons: pack.weapons,
    vfx: pack.vfx,
    artStyle: pack.artStyle,
    mood: pack.mood,
    gameplayHints: pack.gameplayHints,
    themeHints: pack.themeHints,
    negatives: pack.negatives,
    expandSource: "pack",
  });
}

export type ExpandCreativeBriefOptions = ExpandCreativeBriefParams & {
  orchestration?: RunTraceRecorder;
  /** 用户在前端修订 Brief 后再次生成 */
  userRevision?: BriefUserRevision | null;
};

function formatBriefBlock(brief: CreativeBrief, medium: BriefMedium): string {
  switch (medium) {
    case "novel":
      return formatCreativeBriefForNovel(brief);
    case "comic":
      return formatCreativeBriefForComic(brief);
    default:
      return formatCreativeBriefForGameSpec(brief);
  }
}

/**
 * 极简一句话 → 结构化 Creative Brief + 注入生成管线的扩写 prompt。
 */
export async function expandCreativeBrief(
  params: ExpandCreativeBriefOptions,
): Promise<ExpandCreativeBriefResult> {
  const userPrompt = params.prompt.trim();
  const medium = params.medium ?? "game";
  const templateHint = (params.templateHint ?? "auto") as "auto" | GameSpec["templateId"];
  const inputLocale = detectBriefInputLocale(userPrompt);

  if (promptHasCreativeBriefBlock(userPrompt, medium)) {
    const head = userPrompt.split("\n")[0]?.trim() ?? userPrompt.slice(0, 120);
    const intent = parseCreativeIntent(head, templateHint);
    const pack = selectGenrePack(head, templateHint === "auto" ? intent.templateHint : templateHint);
    let brief = briefFromPack(head, pack, intent, detectBriefInputLocale(head));
    if (params.userRevision) brief = mergeBriefRevision(brief, params.userRevision);
    const revBlock = params.userRevision ? formatRevisionBlock(params.userRevision) : "";
    const augmentedPrompt = revBlock && !userPrompt.includes("【用户修订的创意理解】")
      ? `${userPrompt}\n\n${revBlock}`.slice(0, 4000)
      : userPrompt.slice(0, 4000);
    return {
      brief,
      augmentedPrompt,
      oneLineSummary: formatBriefOneLineSummary(brief),
    };
  }

  const intent = parseCreativeIntent(userPrompt, templateHint);
  let resolvedTemplateId = templateHint === "auto" ? intent.templateHint : templateHint;

  // 三层瀑布兜底：A 层（关键词，已在 parseCreativeIntent 走）未命中且 templateHint=auto 时，
  // 走 C 层（embedding）+ B 层（LLM 分类），避免描述性语言落到 general-arcade 兜底
  if (templateHint === "auto" && (!resolvedTemplateId || resolvedTemplateId === "avoider")) {
    try {
      const { resolveTemplateSemantic } = await import("@/lib/game-templates/template-embedding");
      const semantic = await resolveTemplateSemantic(userPrompt);
      if (semantic.templateId && semantic.source !== "keyword") {
        resolvedTemplateId = semantic.templateId;
        params.orchestration?.note("template_semantic_resolve", {
          source: semantic.source,
          templateId: semantic.templateId,
          confidence: semantic.confidence,
        });
      }
    } catch {
      // 语义匹配失败不阻塞，继续用原 resolvedTemplateId
    }
  }

  const pack = params.packId
    ? GENRE_PACKS.find((p) => p.id === params.packId) ?? selectGenrePack(userPrompt, resolvedTemplateId)
    : selectGenrePack(userPrompt, resolvedTemplateId);

  let brief = briefFromPack(userPrompt, pack, intent, inputLocale);
  if (params.userRevision) brief = mergeBriefRevision(brief, params.userRevision);

  const runLlm = !params.skipLlm;
  if (runLlm) {
    brief = await llmExpandCreativeBrief(brief, params.referenceSnippet, medium);
  }

  const briefBlock = formatBriefBlock(brief, medium);
  const revBlock = params.userRevision ? formatRevisionBlock(params.userRevision) : "";
  const augmentedPrompt = `${userPrompt}\n\n---\n${briefBlock}${revBlock ? `\n\n${revBlock}` : ""}`.slice(0, 4000);
  const oneLineSummary = formatBriefOneLineSummary(brief);

  params.orchestration?.note("creative_brief_expand", {
    medium,
    packId: brief.packId,
    templateHint: brief.intent.templateHint,
    tone: brief.intent.tone,
    expandSource: brief.expandSource,
    loglineChars: brief.logline.length,
    sceneCount: brief.scenes.length,
  });

  return { brief, augmentedPrompt, oneLineSummary };
}
