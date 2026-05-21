import { llmJson } from "@/lib/llm";
import type { ComicDirectorPack } from "@/lib/comic-director-types";
import type { NovelGenerationMeta } from "@/lib/novel-long-pipeline-types";
import { PRODUCT } from "@/lib/product-config";

export type ComicCharacterRosterEntry = {
  id: string;
  name: string;
  appearanceZh: string;
  outfitZh: string;
  notes?: string;
};

export type ComicCharacterRoster = {
  version: 1;
  locked: boolean;
  characters: ComicCharacterRosterEntry[];
};

export function emptyComicCharacterRoster(): ComicCharacterRoster {
  return { version: 1, locked: true, characters: [] };
}

export function formatCharacterRosterForPrompt(roster: ComicCharacterRoster): string {
  if (!roster.characters.length) return "";
  return roster.characters
    .map(
      (c) =>
        `${c.id} ${c.name}：外貌「${c.appearanceZh}」；服饰「${c.outfitZh}」${c.notes ? `；${c.notes}` : ""}`,
    )
    .join("\n");
}

export function rosterFromDirectorPack(director: ComicDirectorPack): ComicCharacterRoster {
  return {
    version: 1,
    locked: true,
    characters: director.characters.map((c) => ({
      id: c.id,
      name: c.name,
      appearanceZh: c.appearanceEn.slice(0, 120),
      outfitZh: c.outfitEn.slice(0, 80),
      notes: c.hairEn,
    })),
  };
}

export function rosterFromNovelMeta(meta: NovelGenerationMeta | null): ComicCharacterRoster | null {
  const bible = meta?.bible;
  if (!bible?.characters?.length) return null;
  return {
    version: 1,
    locked: true,
    characters: bible.characters.slice(0, 8).map((c, i) => ({
      id: `char_${i + 1}`,
      name: c.name,
      appearanceZh: c.traits.slice(0, 120),
      outfitZh: "与正文一致，全片不换造型",
      notes: c.role,
    })),
  };
}

const ROSTER_JSON_SCHEMA = {
  name: "comic_character_roster",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      characters: {
        type: "array",
        minItems: 1,
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            appearanceZh: { type: "string" },
            outfitZh: { type: "string" },
            notes: { type: "string" },
          },
          required: ["id", "name", "appearanceZh", "outfitZh"],
        },
      },
    },
    required: ["characters"],
  },
};

/** 轻量路径：通读节选后锁定人设（全书精读或轻量均可触发） */
export async function fetchComicCharacterRoster(params: {
  model: string;
  novelTitle: string;
  novelSummary: string;
  contentExcerpt: string;
}): Promise<ComicCharacterRoster | null> {
  const result = await llmJson({
    model: params.model,
    system: `你是漫画人设总监。通读小说节选后输出主要角色人设卡（2～6 人），整本漫画脸型服饰必须一致。
只输出 JSON。appearanceZh/outfitZh 用中文，写清五官、发型、身高感、标志性配饰。`,
    user: `书名：${params.novelTitle}
简介：${params.novelSummary.slice(0, 600)}

【正文节选】
${params.contentExcerpt.slice(0, 14000)}

输出 characters 数组，id 用 char_1、char_2…`,
    jsonSchema: ROSTER_JSON_SCHEMA,
    temperature: 0.4,
    mode: "json_schema",
    timeoutMs: 60_000,
  });

  if (!result.ok || !result.raw || typeof result.raw !== "object") return null;
  const raw = result.raw as { characters?: ComicCharacterRosterEntry[] };
  if (!Array.isArray(raw.characters) || raw.characters.length < 1) return null;
  return {
    version: 1,
    locked: true,
    characters: raw.characters.map((c, i) => ({
      id: c.id?.trim() || `char_${i + 1}`,
      name: c.name?.trim() || `角色${i + 1}`,
      appearanceZh: c.appearanceZh?.trim().slice(0, 120) || "与上文一致",
      outfitZh: c.outfitZh?.trim().slice(0, 80) || "固定服装",
      ...(c.notes?.trim() ? { notes: c.notes.trim().slice(0, 80) } : {}),
    })),
  };
}

export function buildPrereadExcerpt(content: string, maxChars = 28_000): string {
  const trimmed = content.trim();
  if (trimmed.length <= maxChars) return trimmed;
  const head = trimmed.slice(0, Math.floor(maxChars * 0.45));
  const tail = trimmed.slice(-Math.floor(maxChars * 0.45));
  return `${head}\n\n…（中段省略）…\n\n${tail}`;
}
