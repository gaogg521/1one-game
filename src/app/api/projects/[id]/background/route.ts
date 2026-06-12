import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOwnerKey } from "@/lib/owner";
import type { GameSpec } from "@/lib/game-spec";
import { generateGameBackground } from "@/lib/game-background-gen";
import { generateGameSprites } from "@/lib/game-sprite-gen";
import { localizedJsonError } from "@/lib/api/localized-error";
import { resolveRequestLocaleSync } from "@/lib/i18n/request-locale";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ownerKey = await getOwnerKey();

  try {
    const project = await prisma.project.findUnique({
      where: { id },
      select: { specJson: true, ownerKey: true },
    });
    if (!project) {
      return localizedJsonError(req, "notFound", 404);
    }
    if (ownerKey && project.ownerKey !== ownerKey) {
      return localizedJsonError(req, "forbidden", 403);
    }

    const spec = JSON.parse(project.specJson) as GameSpec;
    // 并行生成背景图 + 实体精灵
    const uiLocale = resolveRequestLocaleSync(req);
    const [bgUrl, sprites] = await Promise.all([
      generateGameBackground(id, spec),
      generateGameSprites(id, spec, uiLocale),
    ]);

    return NextResponse.json({
      backgroundUrl: bgUrl,
      spriteUrls: sprites.filter((s) => s.url).map((s) => ({ kind: s.kind, url: s.url })),
    });
  } catch {
    return localizedJsonError(req, "backgroundGenFailed", 500);
  }
}