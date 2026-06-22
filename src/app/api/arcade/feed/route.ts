import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { GameSpec } from "@/lib/game-spec";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "10", 10), 30);
  const cursor = url.searchParams.get("cursor");

  try {
    const rows = await prisma.project.findMany({
      where: {
        visibility: "public",
        status: "ready",
        ...(cursor ? { createdAt: { lt: (await prisma.project.findUnique({ where: { id: cursor }, select: { createdAt: true } }))?.createdAt } } : {}),
      },
      orderBy: [
        { featured: "desc" },
        { playCount: "desc" },
        { createdAt: "desc" },
      ],
      take: limit + 1,
      select: {
        id: true,
        title: true,
        prompt: true,
        specJson: true,
        coverPath: true,
        playCount: true,
        likeCount: true,
      },
    });

    const sampleFirst = !cursor;
    let page = rows;
    if (sampleFirst) {
      const samples = await prisma.project.findMany({
        where: { visibility: "public", status: "ready", id: { startsWith: "sample-" } },
        orderBy: [{ featured: "desc" }, { playCount: "desc" }],
        select: {
          id: true,
          title: true,
          prompt: true,
          specJson: true,
          coverPath: true,
          playCount: true,
          likeCount: true,
          createdAt: true,
        },
      });
      const sampleIds = new Set(samples.map((s) => s.id));
      const rest = rows.filter((r) => !sampleIds.has(r.id));
      page = [...samples, ...rest].slice(0, limit + 1);
    }

    const hasMore = page.length > limit;
    const items = hasMore ? page.slice(0, limit) : page;

    return NextResponse.json({
      items: items.map((p) => ({
        id: p.id,
        title: p.title,
        prompt: p.prompt.length > 120 ? p.prompt.slice(0, 117) + "…" : p.prompt,
        spec: JSON.parse(p.specJson) as GameSpec,
        coverPath: p.coverPath,
        playCount: p.playCount,
        likeCount: p.likeCount,
      })),
      nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
    });
  } catch (err) {
    console.error("[arcade/feed]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
