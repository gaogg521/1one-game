import { parseNovelChapters } from "@/lib/novel-chapters";
import { llmJson } from "@/lib/llm";
import type { CoverGenre } from "@/lib/cover-genre";
import { getComicPanelStyleLock } from "@/lib/cover-genre";
import { getComicStylePreset, type ComicStylePresetId } from "@/lib/comic-style-presets";
import { COMIC_MASTER_QUALITY_BLOCK } from "@/lib/comic-generate-config";
import { PRODUCT } from "@/lib/product-config";
import {
  buildComicDirectorJsonSchema,
  COMIC_DIRECTOR_VERSION,
  type ComicDirectorPack,
  parseComicDirectorPack,
} from "@/lib/comic-director-types";
import type { NovelGenerationMeta } from "@/lib/novel-long-pipeline-types";
import { formatNovelBibleForPrompt } from "@/lib/novel-long-bible";

const DIRECTOR_SYSTEM = `你是长篇漫画改编的「导演」。通读小说节选后输出 JSON 导演包（ComicDirectorPack），锁定全片视觉一致性。

${COMIC_MASTER_QUALITY_BLOCK}

要求：
- characters：每人固定 id（char_1…）、appearanceEn/outfitEn 英文可视描述，整本不得改脸型服装
- locations：场景 id（loc_1…）与 descriptionEn
- pageBeats：恰好覆盖全书每一页，keyEvents 写该页应发生的**原文情节**（禁止脑补）
- visualStyleEn：全片画风英文（必须与用户指定画风一致）
- taboos：禁止网红厚涂、夸张二次元浓妆、图内可读文字`;

function sampleNovelExcerpts(content: string, maxChars: number): string {
  const chapters = parseNovelChapters(content);
  if (chapters.length === 0) return content.slice(0, maxChars);

  const picks: string[] = [];
  const indices =
    chapters.length <= 5
      ? chapters.map((_, i) => i)
      : [0, Math.floor(chapters.length * 0.25), Math.floor(chapters.length * 0.5), Math.floor(chapters.length * 0.75), chapters.length - 1];

  for (const i of indices) {
    const ch = chapters[i]!;
    const block = `第${ch.num}章《${ch.title}》\n${ch.body.slice(0, 800)}`;
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
}): string {
  const preset = getComicStylePreset(opts.stylePreset);
  const styleHint = `${preset.label}: ${preset.promptEn}`;
  const metaBlock = opts.novelMeta
    ? `\n【小说设定圣经（须遵守）】\n${formatNovelBibleForPrompt(opts.novelMeta.bible)}\n【章规划要点】\n${opts.novelMeta.chapterPlan.chapters
        .slice(0, 20)
        .map((c) => `第${c.num}章 ${c.title}：${c.summary}`)
        .join("\n")}`
    : "";

  return `书名：${opts.novelTitle}
创意：${opts.novelPrompt.slice(0, 500)}
简介：${opts.novelSummary.slice(0, 400)}

全书漫画共 ${opts.pageCount} 页（每页 4 格）。题材画风参考：${styleHint}
${metaBlock}

【正文节选（多章采样）】
${opts.contentExcerpt}

请输出 director JSON，pageBeats 长度恰为 ${opts.pageCount} 页。`;
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
}): Promise<ComicDirectorPack> {
  const excerpt = sampleNovelExcerpts(
    params.novelContent,
    PRODUCT.comic.directorContentMaxChars,
  );
  const result = await llmJson({
    model: params.model,
    system: DIRECTOR_SYSTEM,
    user: buildComicDirectorUserMessage({
      novelTitle: params.novelTitle,
      novelPrompt: params.novelPrompt,
      novelSummary: params.novelSummary,
      contentExcerpt: excerpt,
      pageCount: params.pageCount,
      genre: params.genre,
      stylePreset: params.stylePreset,
      novelMeta: params.novelMeta,
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
