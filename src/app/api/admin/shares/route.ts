import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const { searchParams } = new URL(req.url);
  const days = Math.min(Math.max(parseInt(searchParams.get("days") ?? "7", 10) || 7, 1), 90);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [byChannel, total, referralSignups, topReferrers] = await Promise.all([
    prisma.shareEvent.groupBy({
      by: ["channel"],
      where: { createdAt: { gte: since } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }),
    prisma.shareEvent.count({ where: { createdAt: { gte: since } } }),
    prisma.user.count({
      where: { referredById: { not: null }, createdAt: { gte: since } },
    }),
    prisma.user.groupBy({
      by: ["referredById"],
      where: { referredById: { not: null }, createdAt: { gte: since } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    }),
  ]);

  const referrerIds = topReferrers
    .map((r) => r.referredById)
    .filter((id): id is string => Boolean(id));
  const referrers =
    referrerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: referrerIds } },
          select: { id: true, displayName: true, referralCode: true },
        })
      : [];
  const referrerMap = new Map(referrers.map((u) => [u.id, u]));

  const workKeys = await prisma.shareEvent.groupBy({
    by: ["workType", "workId"],
    where: { createdAt: { gte: since } },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 12,
  });

  const topWorks = await Promise.all(
    workKeys.map(async (w) => {
      let title = w.workId;
      if (w.workType === "game") {
        const row = await prisma.project.findUnique({ where: { id: w.workId }, select: { title: true } });
        title = row?.title ?? title;
      } else if (w.workType === "novel") {
        const row = await prisma.novel.findUnique({ where: { id: w.workId }, select: { title: true } });
        title = row?.title ?? title;
      } else if (w.workType === "comic") {
        const row = await prisma.comic.findUnique({ where: { id: w.workId }, select: { title: true } });
        title = row?.title ?? title;
      }
      return {
        workType: w.workType,
        workId: w.workId,
        title,
        events: w._count.id,
      };
    }),
  );

  return NextResponse.json({
    days,
    total,
    referralSignups,
    channels: byChannel.map((c) => ({
      channel: c.channel,
      count: c._count.id,
    })),
    topReferrers: topReferrers
      .filter((r) => r.referredById)
      .map((r) => {
        const u = referrerMap.get(r.referredById!);
        return {
          userId: r.referredById,
          displayName: u?.displayName ?? null,
          referralCode: u?.referralCode ?? null,
          signups: r._count.id,
        };
      }),
    topWorks,
  });
}
