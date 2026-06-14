import { formatCharacterRosterForPrompt, type ComicCharacterRoster } from "@/lib/comic-character-roster";
import type { NovelChapter } from "@/lib/novel-chapters";
import { llmJson } from "@/lib/llm";
import type { ComicPlotDigest } from "@/lib/comic-preread";
import { formatPlotDigestForPrompt } from "@/lib/comic-preread";

export type ComicChapterBeatPlan = {
  chapterNum: number;
  title: string;
  sceneAnchor: string;
  keyBeats: string[];
};

/** 全书改编蓝图：先锁定人设/场景，再按章提炼关键情节供分镜使用 */
export type ComicAdaptationBlueprint = {
  version: 1;
  consistencyLock: string;
  chapters: ComicChapterBeatPlan[];
};

const BLUEPRINT_SCHEMA = {
  name: "comic_adaptation_blueprint",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      consistencyLock: { type: "string" },
      chapters: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            chapterNum: { type: "integer" },
            title: { type: "string" },
            sceneAnchor: { type: "string" },
            keyBeats: { type: "array", items: { type: "string" } },
          },
          required: ["chapterNum", "title", "sceneAnchor", "keyBeats"],
        },
      },
    },
    required: ["consistencyLock", "chapters"],
  },
};

function chapterExcerpt(body: string, max = 1400): string {
  const t = body.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

export async function fetchComicAdaptationBlueprint(params: {
  model: string;
  novelTitle: string;
  chapters: NovelChapter[];
  plotDigest: ComicPlotDigest;
  characterRoster: ComicCharacterRoster;
}): Promise<ComicAdaptationBlueprint | null> {
  if (params.chapters.length === 0) return null;

  const chapterBlock = params.chapters
    .slice(0, 32)
    .map(
      (ch) =>
        `【第${ch.num}章 ${ch.title}】\n场景锚点请从正文推断。\n${chapterExcerpt(ch.body)}`,
    )
    .join("\n\n");

  const result = await llmJson({
    model: params.model,
    system: `你是漫画改编总策划。在已给出的全书精读与人设锁定前提下：
1. consistencyLock：用 2–4 句话写清全书人物外貌/称呼/主要场景的视觉一致性约束，禁止前后矛盾。
2. 对每一章输出 4–8 条 keyBeats：必须是该章最值得画成漫画格的关键情节瞬间（冲突、决定、反转、高潮），禁止泛泛概述或重复上一章。
3. sceneAnchor：该章主场景（1 句，供全章分镜统一背景）。
禁止编造精读包与章正文中没有的情节。`,
    user: `书名：${params.novelTitle}

${formatPlotDigestForPrompt(params.plotDigest)}

${formatCharacterRosterForPrompt(params.characterRoster)}

【分章正文节选】
${chapterBlock}

输出 JSON。`,
    jsonSchema: BLUEPRINT_SCHEMA,
    temperature: 0.35,
    mode: "json_schema",
    timeoutMs: 120_000,
  });

  if (!result.ok || !result.raw || typeof result.raw !== "object") return null;
  const raw = result.raw as {
    consistencyLock?: string;
    chapters?: Array<{
      chapterNum?: number;
      title?: string;
      sceneAnchor?: string;
      keyBeats?: string[];
    }>;
  };
  const chapters: ComicChapterBeatPlan[] = [];
  for (const row of raw.chapters ?? []) {
    const num = typeof row.chapterNum === "number" ? row.chapterNum : 0;
    const beats = Array.isArray(row.keyBeats)
      ? row.keyBeats.map((b) => String(b).trim()).filter(Boolean).slice(0, 8)
      : [];
    if (num < 1 || beats.length === 0) continue;
    chapters.push({
      chapterNum: num,
      title: String(row.title ?? "").trim() || `第${num}章`,
      sceneAnchor: String(row.sceneAnchor ?? "").trim().slice(0, 200),
      keyBeats: beats,
    });
  }
  if (chapters.length === 0) return null;
  return {
    version: 1,
    consistencyLock: String(raw.consistencyLock ?? "").trim().slice(0, 600),
    chapters,
  };
}

export function scopedChapterNums(chapters: NovelChapter[]): number[] {
  return chapters.map((c) => c.num);
}

/** 将改编范围内的章级关键情节，按页块比例切片供本批分镜使用 */
export function selectBlueprintBeatsForChunk(opts: {
  blueprint: ComicAdaptationBlueprint;
  scopedChapterNums: number[];
  chunkStart: number;
  chunkEnd: number;
  pageCount: number;
  panelsPerPage: number;
}): string[] {
  const scope = new Set(opts.scopedChapterNums);
  const allBeats: string[] = [];
  for (const ch of opts.blueprint.chapters) {
    if (scope.size > 0 && !scope.has(ch.chapterNum)) continue;
    for (const beat of ch.keyBeats) {
      allBeats.push(ch.sceneAnchor ? `[${ch.title}] ${beat}` : beat);
    }
  }
  if (allBeats.length === 0) return [];

  const target = Math.max(1, (opts.chunkEnd - opts.chunkStart + 1) * opts.panelsPerPage);
  const totalPanels = opts.pageCount * opts.panelsPerPage;
  const panelStart = (opts.chunkStart - 1) * opts.panelsPerPage;
  const panelEnd = opts.chunkEnd * opts.panelsPerPage;
  const startIdx = Math.floor((panelStart / totalPanels) * allBeats.length);
  const endIdx = Math.max(
    startIdx + 1,
    Math.ceil((panelEnd / totalPanels) * allBeats.length),
  );
  return allBeats.slice(startIdx, endIdx).slice(0, target);
}

export function formatAdaptationBlueprintForPrompt(
  blueprint: ComicAdaptationBlueprint,
  scopedChapterNums?: number[],
): string {
  const scope = scopedChapterNums?.length ? new Set(scopedChapterNums) : null;
  const lines = [`【全书一致性锁定】\n${blueprint.consistencyLock || "保持人物与场景前后一致。"}`];
  for (const ch of blueprint.chapters) {
    if (scope && !scope.has(ch.chapterNum)) continue;
    lines.push(
      `\n【第${ch.chapterNum}章 ${ch.title}】主场景：${ch.sceneAnchor || "见正文"}\n关键情节：\n${ch.keyBeats.map((b, i) => `${i + 1}. ${b}`).join("\n")}`,
    );
  }
  return lines.join("\n");
}

export function shouldBuildAdaptationBlueprint(
  contentLength: number,
  chapterCount: number,
  lengthTier?: import("@/lib/novel-length").NovelLengthTier | null,
): boolean {
  if (lengthTier === "short" || lengthTier === "children") {
    return contentLength >= 6000 && chapterCount >= 3;
  }
  if (lengthTier === "medium") {
    return contentLength >= 12_000 && chapterCount >= 4;
  }
  return contentLength >= 400 && chapterCount >= 1;
}
