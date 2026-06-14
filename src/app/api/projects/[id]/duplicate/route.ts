import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOwnerKey } from "@/lib/owner";
import { parseGameSpec } from "@/lib/game-spec";
import { normalizeAstrocadePlaySpec } from "@/lib/astrocade-play-spec";
import { createProjectRecord } from "@/lib/project-create";
import { copyProjectCoverFile } from "@/lib/project-cover";
import { fetchCreativeBriefJson, saveCreativeBriefJson } from "@/lib/project-creative-brief-db";
import { rateLimit } from "@/lib/rate-limit";
import { getThrottleKey } from "@/lib/request-key";
import { localizedJsonError, apiErrorFromUnknown } from "@/lib/api/localized-error";
import { duplicateTitle } from "@/lib/cover-file-copy";
import { resolveRequestLocaleSync } from "@/lib/i18n/request-locale";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: RouteContext) {
  const ownerKey = await getOwnerKey();
  if (!ownerKey) {
    return localizedJsonError(req, "unauthorized", 401);
  }

  const key = await getThrottleKey("dup", ownerKey);
  if (!rateLimit(key, 20, 60_000)) {
    return localizedJsonError(req, "rateLimitedRetry", 429);
  }

  const { id } = await ctx.params;
  const source = await prisma.project.findUnique({ where: { id } });
  if (!source) {
    return localizedJsonError(req, "sourceNotFound", 404);
  }

  let sourceSpec: ReturnType<typeof parseGameSpec>;
  try {
    sourceSpec = parseGameSpec(JSON.parse(source.specJson));
  } catch {
    return localizedJsonError(req, "sourceCorrupt", 500);
  }

  const normalizedSpec = normalizeAstrocadePlaySpec(sourceSpec);

  const title = duplicateTitle(source.title, resolveRequestLocaleSync(req), 80);

  let clone;
  try {
    clone = await createProjectRecord({
      ownerKey,
      title,
      prompt: source.prompt,
      specJson: JSON.stringify(normalizedSpec),
      status: source.status,
    });
  } catch (e) {
    return NextResponse.json(
      { error: apiErrorFromUnknown(req, e, "shareCodeFailed") },
      { status: 503 },
    );
  }

  if (source.coverPath) {
    const rel = await copyProjectCoverFile(source.id, clone.id);
    if (rel) {
      await prisma.project.update({ where: { id: clone.id }, data: { coverPath: rel } });
    }
  }

  const briefJson = await fetchCreativeBriefJson(source.id);
  if (briefJson?.trim()) {
    await saveCreativeBriefJson(clone.id, briefJson);
  }

  return NextResponse.json({
    project: { id: clone.id, title: clone.title, shareCode: clone.shareCode },
  });
}
