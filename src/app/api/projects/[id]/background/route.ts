import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOwnerKey } from "@/lib/owner";
import type { GameSpec } from "@/lib/game-spec";
import { generateGameBackground } from "@/lib/game-background-gen";
import { generateGameSprites } from "@/lib/game-sprite-gen";

export async function POST(
  _req: Request,
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
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }
    if (ownerKey && project.ownerKey !== ownerKey) {
      return NextResponse.json({ error: "无权操作" }, { status: 403 });
    }

    const spec = JSON.parse(project.specJson) as GameSpec;
    // 并行生成背景图 + 实体精灵
    const [bgUrl, sprites] = await Promise.all([
      generateGameBackground(id, spec),
      generateGameSprites(id, spec),
    ]);

    return NextResponse.json({
      backgroundUrl: bgUrl,
      spriteUrls: sprites.filter((s) => s.url).map((s) => ({ kind: s.kind, url: s.url })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "背景/精灵生成失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}