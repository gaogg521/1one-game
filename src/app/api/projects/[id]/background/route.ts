import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOwnerKey } from "@/lib/owner";
import type { GameSpec } from "@/lib/game-spec";
import { runProjectAssetPipeline } from "@/lib/game-asset-pipeline";
import { loadProjectCreativeBrief } from "@/lib/project-creative-brief-db";
import { localizedJsonError } from "@/lib/api/localized-error";
import { resolveRequestLocaleSync } from "@/lib/i18n/request-locale";
import { mirrorGameToCreatorCore } from "@/lib/creator-core/game-bridge";
import { enqueueGenerationJob } from "@/lib/creator-core/jobs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ownerKey = await getOwnerKey();
  let body: { durable?: boolean } = {};
  try { body = await req.json() as { durable?: boolean }; } catch { /* legacy empty POST */ }

  try {
    const project = await prisma.project.findUnique({
      where: { id },
      select: {
        id: true, ownerKey: true, title: true, prompt: true, specJson: true, status: true,
        visibility: true, coverPath: true, creativeBriefJson: true,
      },
    });
    if (!project) {
      return localizedJsonError(req, "notFound", 404);
    }
    if (!ownerKey || project.ownerKey !== ownerKey) {
      return localizedJsonError(req, "forbidden", 403);
    }

    const spec = JSON.parse(project.specJson) as GameSpec;
    const uiLocale = resolveRequestLocaleSync(req);
    const brief = await loadProjectCreativeBrief(id);

    if (body.durable) {
      const core = await mirrorGameToCreatorCore({ project, cause: "refine" });
      const job = await enqueueGenerationJob({
        creativeProjectId: core.creativeProjectId,
        creativeRevisionId: core.creativeRevisionId,
        type: "game_asset",
        idempotencyKey: `game-asset:${project.id}:${core.creativeRevisionId}`,
        payload: { projectId: project.id, ownerKey, spec, brief, uiLocale },
      });
      return NextResponse.json({ job: { id: job.id, status: job.status } }, { status: 202 });
    }

    const result = await runProjectAssetPipeline({
      projectId: id,
      spec,
      brief,
      uiLocale,
      existingCoverPath: project.coverPath,
    });

    const spritePayload = result.sprites.filter((s) => s.url).map((s) => ({ kind: s.kind, url: s.url! }));

    return NextResponse.json({
      backgroundUrl: result.backgroundUrl,
      spriteUrls: spritePayload,
      assetManifest: result.assetManifest,
      coverPath: result.coverPath,
      coverSource: result.coverSource,
    });
  } catch {
    return localizedJsonError(req, "backgroundGenFailed", 500);
  }
}
