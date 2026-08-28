import { prisma } from "@/lib/prisma";
import { deleteComicAssetFiles } from "@/lib/comic-assets-gc";
import { deleteGameAssetFiles } from "@/lib/game-assets-gc";
import { deleteNovelCoverFile } from "@/lib/novel-cover-persist";
import { deleteProjectCoverFile } from "@/lib/project-cover";

export const ADMIN_WORK_TYPES = ["game", "novel", "comic"] as const;
export type AdminWorkType = (typeof ADMIN_WORK_TYPES)[number];

export function isAdminWorkType(value: string): value is AdminWorkType {
  return (ADMIN_WORK_TYPES as readonly string[]).includes(value);
}

function legacyTypeFor(type: AdminWorkType): string {
  return type === "game" ? "project" : type;
}

async function detachLegacyCore(type: AdminWorkType, id: string): Promise<void> {
  await prisma.comment.deleteMany({ where: { workType: type, workId: id } });
  await prisma.shareEvent.deleteMany({ where: { workType: type, workId: id } });
  await prisma.literaryEngagementEvent.deleteMany({ where: { workType: type, workId: id } });
  if (type === "game") {
    await prisma.gameplayEvent.deleteMany({ where: { projectId: id } });
  }
  await prisma.creativeProject.deleteMany({
    where: { legacyType: legacyTypeFor(type), legacyId: id },
  });
}

async function deleteComicById(id: string): Promise<boolean> {
  const row = await prisma.comic.findUnique({
    where: { id },
    select: { id: true, imageUrls: true },
  });
  if (!row) return false;
  await deleteComicAssetFiles(row.id, row.imageUrls);
  await detachLegacyCore("comic", id);
  await prisma.comic.delete({ where: { id } });
  return true;
}

async function deleteNovelById(id: string): Promise<boolean> {
  const row = await prisma.novel.findUnique({ where: { id }, select: { id: true } });
  if (!row) return false;
  const linkedComics = await prisma.comic.findMany({
    where: { novelId: id },
    select: { id: true },
  });
  for (const comic of linkedComics) {
    await deleteComicById(comic.id);
  }
  await detachLegacyCore("novel", id);
  await prisma.novel.delete({ where: { id } });
  await deleteNovelCoverFile(id);
  return true;
}

async function deleteGameById(id: string): Promise<boolean> {
  const row = await prisma.project.findUnique({ where: { id }, select: { id: true } });
  if (!row) return false;
  await deleteProjectCoverFile(id);
  await deleteGameAssetFiles(id);
  await detachLegacyCore("game", id);
  await prisma.project.delete({ where: { id } });
  return true;
}

/** Permanently remove a platform work and its files / comments / legacy Core project. */
export async function deleteAdminWork(type: AdminWorkType, id: string): Promise<boolean> {
  if (type === "novel") return deleteNovelById(id);
  if (type === "comic") return deleteComicById(id);
  return deleteGameById(id);
}
