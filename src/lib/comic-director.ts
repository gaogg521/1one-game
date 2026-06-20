import {
  isChildrenFormattedNovelContent,
  parseChildrenComicSections,
} from "@/lib/children-comic-sections";
import { parseNovelChapters } from "@/lib/novel-chapters";
import { llmJson } from "@/lib/llm";
import type { CoverGenre } from "@/lib/cover-genre";
import { getComicStylePreset, type ComicStylePresetId } from "@/lib/comic-style-presets";
import type { BriefInputLocale } from "@/lib/creative-brief/detect-input-locale";
import { buildDirectorSystemPrompt } from "@/lib/comic-locale-prompts";
import { panelsPerPageForLayout, type ComicLayoutId } from "@/lib/comic-layout";
import { PRODUCT } from "@/lib/product-config";
import {
  buildComicDirectorJsonSchema,
  COMIC_DIRECTOR_VERSION,
  type ComicDirectorPack,
  parseComicDirectorPack,
} from "@/lib/comic-director-types";
import type { NovelGenerationMeta } from "@/lib/novel-long-pipeline-types";
import { formatNovelBibleForPrompt } from "@/lib/novel-long-bible";
import {
  migrateComicDirector,
  getDirectorMigrationSummary,
} from "@/lib/comic-director-migration";

function sampleNovelExcerpts(content: string, maxChars: number, outputLocale: BriefInputLocale = "zh"): string {
  if (isChildrenFormattedNovelContent(content)) {
    const sections = parseChildrenComicSections(content);
    if (sections.length === 0) return content.slice(0, maxChars);
    const picks = sections.map((s) => `【${s.title}】\n${s.body.slice(0, 800)}`);
    return picks.join("\n\n---\n\n").slice(0, maxChars);
  }

  const chapters = parseNovelChapters(content);
  if (chapters.length === 0) return content.slice(0, maxChars);

  const picks: string[] = [];
  const indices =
    chapters.length <= 5
      ? chapters.map((_, i) => i)
      : [0, Math.floor(chapters.length * 0.25), Math.floor(chapters.length * 0.5), Math.floor(chapters.length * 0.75), chapters.length - 1];

  for (const i of indices) {
    const ch = chapters[i]!;
    const block =
      outputLocale === "zh" || outputLocale === "zh-Hant"
        ? `第${ch.num}章《${ch.title}》\n${ch.body.slice(0, 800)}`
        : `Chapter ${ch.num}: ${ch.title}\n${ch.body.slice(0, 800)}`;
    picks.push(block);
  }
  return picks.join("\n\n---\n\n").slice(0, maxChars);
}

export function buildComicDirectorUserMessage(opts: {
  novelTitle: string;
  novelPrompt: string;
  novelSummary: string;
  contentExcerpt: string;
  pageCount: number;
  genre: CoverGenre;
  stylePreset: ComicStylePresetId;
  novelMeta: NovelGenerationMeta | null;
  layoutId?: ComicLayoutId;
  outputLocale?: BriefInputLocale;
}): string {
  const outputLocale = opts.outputLocale ?? "zh";
  const preset = getComicStylePreset(opts.stylePreset);
  const styleHint = `${preset.label}: ${preset.promptEn}`;
  const metaBlock = opts.novelMeta
    ? `\n【小说设定圣经（须遵守）】\n${formatNovelBibleForPrompt(opts.novelMeta.bible)}\n【章规划要点】\n${opts.novelMeta.chapterPlan.chapters
        .slice(0, 20)
        .map((c) =>
          outputLocale === "zh" || outputLocale === "zh-Hant"
            ? `第${c.num}章 ${c.title}：${c.summary}`
            : `Chapter ${c.num} ${c.title}: ${c.summary}`,
        )
        .join("\n")}`
    : "";

  const layoutId = opts.layoutId ?? "grid_8";
  const panelsPerPage = panelsPerPageForLayout(layoutId);
  if (outputLocale === "zh" || outputLocale === "zh-Hant") {
    return `书名：${opts.novelTitle}
创意：${opts.novelPrompt.slice(0, 500)}
简介：${opts.novelSummary.slice(0, 400)}

全书漫画共 ${opts.pageCount} 页（每页 ${panelsPerPage} 格，优先抽取关键情节，不做平均切段）。题材画风参考：${styleHint}
${metaBlock}

【正文节选（多章采样）】
${opts.contentExcerpt}

请输出 director JSON，pageBeats 长度恰为 ${opts.pageCount} 页。`;
  }

  return `Title: ${opts.novelTitle}
Brief: ${opts.novelPrompt.slice(0, 500)}
Summary: ${opts.novelSummary.slice(0, 400)}

Comic length: ${opts.pageCount} pages (${panelsPerPage} panels each; key beats, not linear chunking). Style: ${styleHint}
${metaBlock}

[Novel excerpt — multi-chapter sample]
${opts.contentExcerpt}

Output director JSON with exactly ${opts.pageCount} pageBeats entries.`;
}

export function fallbackComicDirectorPack(opts: {
  novelTitle: string;
  pageCount: number;
  genre: CoverGenre;
  stylePreset: ComicStylePresetId;
  novelMeta: NovelGenerationMeta | null;
}): ComicDirectorPack {
  const style = getComicStylePreset(opts.stylePreset).promptEn;
  const bible = opts.novelMeta?.bible;
  const chars =
    bible?.characters.slice(0, 4).map((c, i) => ({
      id: `char_${i + 1}`,
      name: c.name,
      appearanceEn: `${c.traits}, consistent face and body type throughout the series`,
      outfitEn: "story-appropriate outfit, same design in every panel",
      hairEn: "consistent hairstyle",
    })) ?? [
      {
        id: "char_1",
        name: "主角",
        appearanceEn: "young protagonist, distinctive face, consistent design",
        outfitEn: "main costume, never changes without story reason",
      },
      {
        id: "char_2",
        name: "配角",
        appearanceEn: "supporting character, consistent look",
        outfitEn: "secondary outfit, fixed colors",
      },
    ];

  const pageBeats = Array.from({ length: opts.pageCount }, (_, i) => {
    const page = i + 1;
    const pct = Math.round((page / opts.pageCount) * 100);
    return {
      page,
      progressPercent: Math.min(100, pct),
      mood: page === 1 ? "opening" : page === opts.pageCount ? "resolution" : "rising",
      keyEvents: bible
        ? `推进：${bible.coreConflict.slice(0, 60)}…（约 ${pct}% 进度）`
        : `故事推进至约 ${pct}%`,
    };
  });

  return {
    version: COMIC_DIRECTOR_VERSION,
    title: opts.novelTitle,
    visualStyleEn: style,
    characters: chars,
    locations: [
      {
        id: "loc_1",
        name: "主场景",
        descriptionEn: bible?.worldSetting.slice(0, 120) ?? "primary story environment, consistent lighting",
      },
    ],
    pageBeats,
    taboos: bible?.taboos ?? ["no readable text in image", "no character redesign"],
  };
}

export async function fetchComicDirectorPack(params: {
  model: string;
  novelTitle: string;
  novelPrompt: string;
  novelSummary: string;
  novelContent: string;
  pageCount: number;
  genre: CoverGenre;
  stylePreset: ComicStylePresetId;
  novelMeta: NovelGenerationMeta | null;
  layoutId?: ComicLayoutId;
  outputLocale?: BriefInputLocale;
  storedDirector?: ComicDirectorPack | null;
}): Promise<ComicDirectorPack> {
  const outputLocale = params.outputLocale ?? "zh";

  // ★ 尝试迁移旧版本导演数据（向后兼容）
  if (params.storedDirector) {
    const migrated = migrateComicDirector(params.storedDirector, COMIC_DIRECTOR_VERSION);
    if (migrated) {
      console.info(
        `[comic-director] ${getDirectorMigrationSummary(params.storedDirector.version, COMIC_DIRECTOR_VERSION)}，复用已有数据`,
      );
      return migrated;
    }
    console.warn("[comic-director] 旧版本数据迁移失败，重新生成导演包");
  }

  const excerpt = sampleNovelExcerpts(
    params.novelContent,
    PRODUCT.comic.directorContentMaxChars,
    outputLocale,
  );
  const result = await llmJson({
    model: params.model,
    system: buildDirectorSystemPrompt(outputLocale),
    user: buildComicDirectorUserMessage({
      novelTitle: params.novelTitle,
      novelPrompt: params.novelPrompt,
      novelSummary: params.novelSummary,
      contentExcerpt: excerpt,
      pageCount: params.pageCount,
      genre: params.genre,
      stylePreset: params.stylePreset,
      novelMeta: params.novelMeta,
      layoutId: params.layoutId,
      outputLocale,
    }),
    jsonSchema: buildComicDirectorJsonSchema(params.pageCount),
    temperature: 0.55,
    mode: "json_schema",
    timeoutMs: PRODUCT.comic.directorTimeoutMs,
  });

  if (result.ok) {
    const parsed = parseComicDirectorPack(result.raw);
    if (parsed && parsed.pageBeats.length >= Math.min(params.pageCount, 3)) {
      if (parsed.pageBeats.length > params.pageCount) {
        parsed.pageBeats = parsed.pageBeats.slice(0, params.pageCount);
      }
      while (parsed.pageBeats.length < params.pageCount) {
        const page = parsed.pageBeats.length + 1;
        parsed.pageBeats.push({
          page,
          progressPercent: Math.round((page / params.pageCount) * 100),
          mood: "rising",
          keyEvents: "continue main plot",
        });
      }
      return parsed;
    }
  }

  return fallbackComicDirectorPack({
    novelTitle: params.novelTitle,
    pageCount: params.pageCount,
    genre: params.genre,
    stylePreset: params.stylePreset,
    novelMeta: params.novelMeta,
  });
}

export function formatComicDirectorForPrompt(director: ComicDirectorPack, pageRange?: { from: number; to: number }): string {
  const chars = director.characters
    .map((c) => `${c.id} ${c.name}: ${c.appearanceEn}; outfit: ${c.outfitEn}`)
    .join("\n");
  const locs = director.locations.map((l) => `${l.id} ${l.name}: ${l.descriptionEn}`).join("\n");
  const beats = director.pageBeats
    .filter((b) => !pageRange || (b.page >= pageRange.from && b.page <= pageRange.to))
    .map((b) => `p${b.page} (${b.progressPercent}%): ${b.mood} — ${b.keyEvents}`)
    .join("\n");
  return `【全片画风】${director.visualStyleEn}
【角色卡】
${chars}
【场景】
${locs}
【页节拍】
${beats}
【禁忌】${(director.taboos ?? []).join("；")}`;
}
