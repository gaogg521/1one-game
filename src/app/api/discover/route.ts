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

type ProjectRow = {
  id: string;
  title: string;
  prompt: string;
  coverPath: string | null;
  playCount: number;
  likeCount: number;
  shareCode: string | null;
  specJson: string;
  createdAt: Date;
};

const VALID_SORTS = new Set(["playCount", "likeCount", "createdAt", "hot"]);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const templateFilter = searchParams.get("template");
  const sortParam = searchParams.get("sort") ?? "playCount";
  const limitRaw = parseInt(searchParams.get("limit") ?? "48", 10);
  const limitParam = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 48, 1), 96);

  const sort = VALID_SORTS.has(sortParam) ? sortParam : "playCount";

  let projects: ProjectRow[];

  if (sort === "likeCount") {
    projects = await prisma.$queryRaw<ProjectRow[]>`
      SELECT id, title, prompt, coverPath, playCount, likeCount, shareCode, specJson, createdAt
      FROM "Project" ORDER BY likeCount DESC LIMIT ${limitParam}
    `;
  } else if (sort === "createdAt") {
    projects = await prisma.$queryRaw<ProjectRow[]>`
      SELECT id, title, prompt, coverPath, playCount, likeCount, shareCode, specJson, createdAt
      FROM "Project" ORDER BY createdAt DESC LIMIT ${limitParam}
    `;
  } else if (sort === "hot") {
    projects = await prisma.$queryRaw<ProjectRow[]>`
      SELECT id, title, prompt, coverPath, playCount, likeCount, shareCode, specJson, createdAt
      FROM "Project" ORDER BY (playCount + likeCount * 3) DESC LIMIT ${limitParam}
    `;
  } else {
    projects = await prisma.$queryRaw<ProjectRow[]>`
      SELECT id, title, prompt, coverPath, playCount, likeCount, shareCode, specJson, createdAt
      FROM "Project" ORDER BY playCount DESC LIMIT ${limitParam}
    `;
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
