import { prisma } from "@/lib/prisma";
import {
  parseComicCharacterRoster,
  serializeComicCharacterRoster,
  type ComicCharacterRoster,
} from "@/lib/comic-character-roster";

async function loadCharacterRosterJsonRaw(novelId: string): Promise<string | null> {
  const rows = await prisma.$queryRaw<Array<{ characterRosterJson: string | null }>>`
    SELECT "characterRosterJson" FROM "Novel" WHERE id = ${novelId} LIMIT 1
  `;
  return rows[0]?.characterRosterJson ?? null;
}

async function saveCharacterRosterJsonRaw(novelId: string, json: string | null): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "Novel" SET "characterRosterJson" = ${json} WHERE id = ${novelId}
  `;
}

export async function loadNovelCharacterRoster(novelId: string): Promise<ComicCharacterRoster | null> {
  let raw: string | null | undefined;
  try {
    raw = await loadCharacterRosterJsonRaw(novelId);
  } catch {
    try {
      const row = await prisma.novel.findUnique({
        where: { id: novelId },
        select: { characterRosterJson: true },
      });
      raw = row?.characterRosterJson;
    } catch {
      return null;
    }
  }
  if (!raw?.trim()) return null;
  try {
    return parseComicCharacterRoster(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function saveNovelCharacterRoster(
  novelId: string,
  roster: ComicCharacterRoster | null,
): Promise<void> {
  const json = roster?.characters.length ? serializeComicCharacterRoster(roster) : null;
  try {
    await saveCharacterRosterJsonRaw(novelId, json);
  } catch {
    try {
      await prisma.novel.update({
        where: { id: novelId },
        data: { characterRosterJson: json },
      });
    } catch {
      /* ignore */
    }
  }
}
