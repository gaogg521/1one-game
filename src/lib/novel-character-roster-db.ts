import { prisma } from "@/lib/prisma";
import {
  parseComicCharacterRoster,
  serializeComicCharacterRoster,
  type ComicCharacterRoster,
} from "@/lib/comic-character-roster";

/** Client 未 generate 或 schema 漂移时，Prisma 会报 Unknown field / argument */
function isPrismaSchemaDriftError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const msg = e.message;
  return (
    msg.includes("Unknown field") ||
    msg.includes("Unknown argument") ||
    msg.includes("Invalid `prisma.")
  );
}

let rosterAccessProbed = false;
/** true = 列在库中但 Client 无字段，全程走 raw */
let useRawRosterOnly = false;

async function probeRosterFieldAccess(): Promise<void> {
  if (rosterAccessProbed) return;
  rosterAccessProbed = true;
  try {
    await prisma.novel.findFirst({ select: { characterRosterJson: true } });
    useRawRosterOnly = false;
  } catch (e) {
    if (isPrismaSchemaDriftError(e)) {
      useRawRosterOnly = true;
      return;
    }
    throw e;
  }
}

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
  await probeRosterFieldAccess();
  const raw = useRawRosterOnly
    ? await loadCharacterRosterJsonRaw(novelId)
    : (
        await prisma.novel.findUnique({
          where: { id: novelId },
          select: { characterRosterJson: true },
        })
      )?.characterRosterJson;

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
  await probeRosterFieldAccess();
  const json = roster?.characters.length ? serializeComicCharacterRoster(roster) : null;
  if (useRawRosterOnly) {
    await saveCharacterRosterJsonRaw(novelId, json);
    return;
  }
  await prisma.novel.update({
    where: { id: novelId },
    data: { characterRosterJson: json },
  });
}

/** QA / 诊断：当前是否因 Client 漂移走 raw */
export function novelCharacterRosterUsesRawFallback(): boolean {
  return useRawRosterOnly;
}

/** 测试用：重置探测缓存 */
export function resetNovelCharacterRosterAccessProbeForTests(): void {
  rosterAccessProbed = false;
  useRawRosterOnly = false;
}
