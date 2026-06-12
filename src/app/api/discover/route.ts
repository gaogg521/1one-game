import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOwnerKey } from "@/lib/owner";
import { isSuperAdmin } from "@/lib/super-admin";

import { isGameTemplateId, listDiscoverTemplateIds } from "@/lib/game-templates/registry";

const VALID_TEMPLATES = listDiscoverTemplateIds();
type TemplateId = (typeof VALID_TEMPLATES)[number];

function extractTemplateId(specJson: string): TemplateId | null {
  try {
    const m = specJson.match(/"templateId"\s*:\s*"([^"]+)"/);
    const v = m?.[1] as TemplateId | undefined;
    return v && isGameTemplateId(v) ? v : null;
  } catch {
    return null;
  }
}

const VALID_SORTS = new Set(["playCount", "likeCount", "createdAt", "hot", "featured"]);

export async function GET(req: Request) {
  const ownerKey = await getOwnerKey();
  const superAdmin = isSuperAdmin(req, ownerKey);
  const { searchParams } = new URL(req.url);
  const templateFilter = searchParams.get("template");
  const sortParam = searchParams.get("sort") ?? "playCount";
  const limitRaw = parseInt(searchParams.get("limit") ?? "48", 10);
  const limitParam = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 48, 1), 96);
  const cursor = searchParams.get("cursor")?.trim();
  const featuredOnly = searchParams.get("featured") === "1";

  const sort = VALID_SORTS.has(sortParam) ? sortParam : "playCount";

  let projects;

  if (sort === "hot") {
    // 综合热度需要计算列，仍使用 $queryRaw，但 ORDER BY 和 LIMIT 均为硬编码/校验后的值
    projects = await prisma.$queryRaw<
      { id: string; title: string; prompt: string; coverPath: string | null; playCount: number; likeCount: number; shareCode: string | null; specJson: string; createdAt: Date; ownerKey: string | null }[]
    >`SELECT id, title, prompt, coverPath, playCount, likeCount, shareCode, specJson, createdAt, ownerKey FROM "Project" WHERE visibility = 'public' ORDER BY (playCount + likeCount * 3) DESC LIMIT ${limitParam}`;
  } else {
    const orderBy =
      sort === "featured"
        ? [{ featured: "desc" as const }, { playCount: "desc" as const }]
        : sort === "likeCount"
          ? [{ likeCount: "desc" as const }]
          : sort === "createdAt"
            ? [{ createdAt: "desc" as const }]
            : [{ playCount: "desc" as const }];

    const cursorDate = cursor ? new Date(cursor) : null;
    const cursorValid = cursorDate && !Number.isNaN(cursorDate.getTime());

    projects = await prisma.project.findMany({
      where: {
        visibility: "public",
        ...(featuredOnly ? { featured: true } : {}),
        ...(cursorValid ? { createdAt: { lt: cursorDate } } : {}),
      },
      orderBy,
      take: limitParam,
      select: {
        id: true,
        ownerKey: true,
        title: true,
        prompt: true,
        coverPath: true,
        playCount: true,
        likeCount: true,
        shareCode: true,
        specJson: true,
        createdAt: true,
        featured: true,
      },
    });
  }

  const items = projects
    .map((p) => {
      const owned = Boolean(ownerKey && p.ownerKey === ownerKey);
      return {
        id: p.id,
        title: p.title,
        prompt: p.prompt,
        coverPath: p.coverPath ?? null,
        playCount: p.playCount,
        likeCount: p.likeCount ?? 0,
        shareCode: p.shareCode ?? null,
        createdAt: p.createdAt,
        featured: "featured" in p ? Boolean((p as { featured?: boolean }).featured) : false,
        templateId: extractTemplateId(p.specJson),
        isOwner: owned,
        canDelete: owned || superAdmin,
      };
    })
    .filter((p) => !templateFilter || p.templateId === templateFilter);

  const last = items[items.length - 1];
  const nextCursor =
    items.length >= limitParam && last?.createdAt
      ? new Date(last.createdAt).toISOString()
      : null;

  return NextResponse.json({ projects: items, nextCursor });
}
