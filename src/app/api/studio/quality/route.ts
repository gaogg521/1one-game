import { NextResponse } from "next/server";
import { assessComicCreatorQuality, assessGameCreatorQuality, assessNovelCreatorQuality } from "@/lib/creator-quality";
import { buildCreatorQualityReport, resolveCreatorWorkStage } from "@/lib/creator-workflow";
import { parseGameSpec } from "@/lib/game-spec";
import { getOwnerKey } from "@/lib/owner";
import { prisma } from "@/lib/prisma";
import { localizedJsonError } from "@/lib/api/localized-error";

type StudioQualityItem = {
  id: string;
  type: "project" | "novel" | "comic";
  workflow: { stage: ReturnType<typeof resolveCreatorWorkStage> };
  quality: ReturnType<typeof buildCreatorQualityReport>;
};

/**
 * Owner-only quality summaries for the creator workspace.  The list endpoints
 * deliberately omit novel bodies; this route evaluates them server-side and
 * sends only the small report that is needed to decide what to repair next.
 */
export async function GET(req: Request) {
  const ownerKey = await getOwnerKey();
  if (!ownerKey) return localizedJsonError(req, "unauthorized", 401);

  const [projects, novels, comics] = await Promise.all([
    prisma.project.findMany({
      where: { ownerKey },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: { id: true, status: true, visibility: true, specJson: true },
    }),
    prisma.novel.findMany({
      where: { ownerKey },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: { id: true, status: true, visibility: true, content: true, prompt: true, lengthTier: true },
    }),
    prisma.comic.findMany({
      where: { ownerKey },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: { id: true, status: true, visibility: true, imageUrls: true },
    }),
  ]);

  const works: StudioQualityItem[] = [];
  for (const project of projects) {
    let quality: StudioQualityItem["quality"];
    try {
      quality = assessGameCreatorQuality(parseGameSpec(JSON.parse(project.specJson))).report;
    } catch {
      quality = buildCreatorQualityReport({ kind: "game", evidence: ["game_spec_needs_review"] });
    }
    works.push({
      id: project.id,
      type: "project",
      quality,
      workflow: { stage: resolveCreatorWorkStage({ status: project.status, visibility: project.visibility, quality }) },
    });
  }

  for (const novel of novels) {
    const quality = assessNovelCreatorQuality({
      content: novel.content,
      prompt: novel.prompt,
      lengthTier: novel.lengthTier,
    }).report;
    works.push({
      id: novel.id,
      type: "novel",
      quality,
      workflow: { stage: resolveCreatorWorkStage({ status: novel.status, visibility: novel.visibility, quality }) },
    });
  }

  for (const comic of comics) {
    let quality: StudioQualityItem["quality"];
    try {
      quality = assessComicCreatorQuality(comic.imageUrls).report;
    } catch {
      quality = buildCreatorQualityReport({ kind: "comic", evidence: ["comic_document_needs_review"] });
    }
    works.push({
      id: comic.id,
      type: "comic",
      quality,
      workflow: { stage: resolveCreatorWorkStage({ status: comic.status, visibility: comic.visibility, quality }) },
    });
  }

  return NextResponse.json({ works });
}
