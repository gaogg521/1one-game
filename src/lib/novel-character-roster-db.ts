import { prisma } from "@/lib/prisma";
import {
  parseComicCharacterRoster,
  serializeComicCharacterRoster,
  type ComicCharacterRoster,
} from "@/lib/comic-character-roster";

export async function loadNovelCharacterRoster(novelId: string): Promise<ComicCharacterRoster | null> {
  const row = await prisma.novel.findUnique({
    where: { id: novelId },
    select: { characterRosterJson: true },
  });
  const raw = row?.characterRosterJson;
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
  await prisma.novel.update({
    where: { id: novelId },
    data: { characterRosterJson: json },
  });
}
