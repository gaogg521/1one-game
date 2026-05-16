import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const VALID_TEMPLATES = ["avoider", "collector", "survivor", "platformer", "towerDefense", "shooter"] as const;
type TemplateId = (typeof VALID_TEMPLATES)[number];

function extractTemplateId(specJson: string): TemplateId | null {
  try {
    const m = specJson.match(/"templateId"\s*:\s*"([^"]+)"/);
    const v = m?.[1] as TemplateId | undefined;
    return v && VALID_TEMPLATES.includes(v) ? v : null;
  } catch {
    return null;
  }
}

const VALID_SORTS = new Set(["playCount", "likeCount", "createdAt", "hot"]);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const templateFilter = searchParams.get("template");
  const sortParam = searchParams.get("sort") ?? "playCount";
  const limitRaw = parseInt(searchParams.get("limit") ?? "48", 10);
  const limitParam = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 48, 1), 96);

  const sort = VALID_SORTS.has(sortParam) ? sortParam : "playCount";

  let projects;

  if (sort === "hot") {
    // 综合热度需要计算列，仍使用 $queryRaw，但 ORDER BY 和 LIMIT 均为硬编码/校验后的值
    projects = await prisma.$queryRaw<
      { id: string; title: string; prompt: string; coverPath: string | null; playCount: number; likeCount: number; shareCode: string | null; specJson: string; createdAt: Date }[]
    >`SELECT id, title, prompt, coverPath, playCount, likeCount, shareCode, specJson, createdAt FROM "Project" ORDER BY (playCount + likeCount * 3) DESC LIMIT ${limitParam}`;
  } else {
    // 使用 Prisma 类型安全查询
    const orderBy =
      sort === "likeCount"
        ? { likeCount: "desc" as const }
        : sort === "createdAt"
          ? { createdAt: "desc" as const }
          : { playCount: "desc" as const };
    projects = await prisma.project.findMany({
      orderBy,
      take: limitParam,
      select: {
        id: true,
        title: true,
        prompt: true,
        coverPath: true,
        playCount: true,
        likeCount: true,
        shareCode: true,
        specJson: true,
        createdAt: true,
      },
    });
  }

  const items = projects
    .map((p) => ({
      id: p.id,
      title: p.title,
      prompt: p.prompt,
      coverPath: p.coverPath ?? null,
      playCount: p.playCount,
      likeCount: p.likeCount ?? 0,
      shareCode: p.shareCode ?? null,
      createdAt: p.createdAt,
      templateId: extractTemplateId(p.specJson),
    }))
    .filter((p) => !templateFilter || p.templateId === templateFilter);

  return NextResponse.json({ projects: items });
}
