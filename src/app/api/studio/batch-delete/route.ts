import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOwnerKey } from "@/lib/owner";
import { canDeleteOwnedResource, isSuperAdmin } from "@/lib/super-admin";
import { deleteProjectCoverFile } from "@/lib/project-cover";
import { deleteNovelCoverFile } from "@/lib/novel-cover-persist";
import { deleteComicAssetFiles } from "@/lib/comic-assets-gc";
import { localizedApiErrorPayload, localizedJsonError, studioErrorText } from "@/lib/api/localized-error";

type StudioDeleteType = "project" | "novel" | "comic";

type BatchDeleteItem = {
  id?: unknown;
  type?: unknown;
};

function isStudioDeleteType(type: unknown): type is StudioDeleteType {
  return type === "project" || type === "novel" || type === "comic";
}

function parseItems(
  body: unknown,
): { ok: true; items: { id: string; type: StudioDeleteType }[] } | { ok: false; key: string } {
  if (!body || typeof body !== "object" || !("items" in body) || !Array.isArray((body as { items?: unknown }).items)) {
    return { ok: false, key: "missingItems" };
  }

  const parsed: { id: string; type: StudioDeleteType }[] = [];
  for (const raw of (body as { items: BatchDeleteItem[] }).items) {
    const id = typeof raw?.id === "string" ? raw.id.trim() : "";
    const type = raw?.type;
    if (!id || !isStudioDeleteType(type)) {
      return { ok: false, key: "invalidItems" };
    }
    parsed.push({ id, type });
  }
  return { ok: true, items: parsed };
}

export async function DELETE(req: Request) {
  const ownerKey = await getOwnerKey();
  const superAdmin = isSuperAdmin(req, ownerKey);
  if (!ownerKey && !superAdmin) {
    return localizedJsonError(req, "unauthorized", 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return localizedJsonError(req, "badJson", 400);
  }

  const parsed = parseItems(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: localizedApiErrorPayload(req, parsed.key).error }, { status: 400 });
  }

  if (parsed.items.length === 0) {
    return NextResponse.json({ ok: true, deletedCount: 0, errors: [] });
  }

  const errors: string[] = [];
  let deletedCount = 0;

  for (const item of parsed.items) {
    try {
      if (item.type === "project") {
        const row = await prisma.project.findUnique({ where: { id: item.id }, select: { id: true, ownerKey: true } });
        if (!row) {
          errors.push(studioErrorText(req, "deleteProjectNotFound", { id: item.id }));
          continue;
        }
        if (!canDeleteOwnedResource(row.ownerKey, ownerKey, req)) {
          errors.push(studioErrorText(req, "deleteProjectForbidden", { id: item.id }));
          continue;
        }
        await deleteProjectCoverFile(item.id);
        await prisma.project.delete({ where: { id: item.id } });
        deletedCount += 1;
        continue;
      }

      if (item.type === "novel") {
        const row = await prisma.novel.findUnique({ where: { id: item.id }, select: { id: true, ownerKey: true } });
        if (!row) {
          errors.push(studioErrorText(req, "deleteNovelNotFound", { id: item.id }));
          continue;
        }
        if (!canDeleteOwnedResource(row.ownerKey, ownerKey, req)) {
          errors.push(studioErrorText(req, "deleteNovelForbidden", { id: item.id }));
          continue;
        }
        const linkedComics = await prisma.comic.findMany({
          where: { novelId: item.id },
          select: { id: true, imageUrls: true },
        });
        for (const comic of linkedComics) {
          await deleteComicAssetFiles(comic.id, comic.imageUrls);
        }
        await prisma.novel.delete({ where: { id: item.id } });
        await deleteNovelCoverFile(item.id);
        deletedCount += 1;
        continue;
      }

      const row = await prisma.comic.findUnique({
        where: { id: item.id },
        select: { id: true, ownerKey: true, imageUrls: true },
      });
      if (!row) {
        errors.push(studioErrorText(req, "deleteComicNotFound", { id: item.id }));
        continue;
      }
      if (!canDeleteOwnedResource(row.ownerKey, ownerKey, req)) {
        errors.push(studioErrorText(req, "deleteComicForbidden", { id: item.id }));
        continue;
      }
      await deleteComicAssetFiles(row.id, row.imageUrls);
      await prisma.comic.delete({ where: { id: item.id } });
      deletedCount += 1;
    } catch (error) {
      const msg = error instanceof Error ? error.message : studioErrorText(req, "unknownError");
      errors.push(
        studioErrorText(req, "deleteFailed", {
          type: item.type,
          id: item.id,
          reason: msg,
        }),
      );
    }
  }

  return NextResponse.json({
    ok: true,
    deletedCount,
    errors,
  });
}
