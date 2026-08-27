import { llmJson } from "@/lib/llm";
import type { RuntimeLocaleGroup } from "@/lib/runtime-providers";
import type { ComicCharacterRoster, ComicCharacterRosterEntry } from "@/lib/comic-character-roster";

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

/** Server-only: read a novel excerpt and create the locked comic character roster. */
export async function fetchComicCharacterRoster(params: {
  model: string;
  novelTitle: string;
  novelSummary: string;
  contentExcerpt: string;
  localeGroup?: RuntimeLocaleGroup;
}): Promise<ComicCharacterRoster | null> {
  const result = await llmJson({
    model: params.model,
    scene: "comic_storyboard",
    localeGroup: params.localeGroup,
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
    characters: raw.characters.map((character, index) => ({
      id: character.id?.trim() || `char_${index + 1}`,
      name: character.name?.trim() || `角色${index + 1}`,
      appearanceZh: character.appearanceZh?.trim().slice(0, 120) || "与上文一致",
      outfitZh: character.outfitZh?.trim().slice(0, 80) || "固定服装",
      ...(character.notes?.trim() ? { notes: character.notes.trim().slice(0, 80) } : {}),
    })),
  };
}
