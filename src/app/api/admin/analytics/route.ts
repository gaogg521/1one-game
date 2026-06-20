import { NextResponse } from "next/server";
import { buildDayRange, clampDays, countByDay, toDayKey } from "@/lib/admin/analytics";
import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const { searchParams } = new URL(req.url);
  const days = clampDays(searchParams.get("days"), 14);
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));

  const dayKeys = buildDayRange(days);

  const [
    shareRows,
    userRows,
    referralRows,
    gameRows,
    novelRows,
    comicRows,
    byChannel,
    shareTotal,
    referralSignups,
    paidOrders,
    activeSubs,
    quotaByReason,
    plans,
    visibilityG,
    visibilityN,
    visibilityC,
    featuredG,
    featuredN,
    featuredC,
  ] = await Promise.all([
    prisma.shareEvent.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.user.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.user.findMany({
      where: { referredById: { not: null }, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prisma.project.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.novel.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.comic.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
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
    prisma.paymentEvent.findMany({
      where: { status: "paid", paidAt: { gte: since } },
      select: { amountCents: true, planId: true, provider: true, paidAt: true },
    }),
    prisma.userSubscription.groupBy({
      by: ["planId", "status"],
      _count: { id: true },
    }),
    prisma.quotaLedger.groupBy({
      by: ["reason"],
      where: { createdAt: { gte: since } },
      _count: { id: true },
      _sum: { delta: true },
    }),
    prisma.subscriptionPlan.findMany({ select: { id: true, name: true } }),
    prisma.project.groupBy({ by: ["visibility"], _count: { id: true } }),
    prisma.novel.groupBy({ by: ["visibility"], _count: { id: true } }),
    prisma.comic.groupBy({ by: ["visibility"], _count: { id: true } }),
    prisma.project.count({ where: { featured: true } }),
    prisma.novel.count({ where: { featured: true } }),
    prisma.comic.count({ where: { featured: true } }),
  ]);

  const planName = new Map(plans.map((p) => [p.id, p.name]));

  const visibilityTotals = new Map<string, number>();
  for (const row of [...visibilityG, ...visibilityN, ...visibilityC]) {
    visibilityTotals.set(row.visibility, (visibilityTotals.get(row.visibility) ?? 0) + row._count.id);
  }

  const [gameTotal, novelTotal, comicTotal] = await Promise.all([
    prisma.project.count(),
    prisma.novel.count(),
    prisma.comic.count(),
  ]);

  const activeSubscriptionCount = activeSubs
    .filter((s) => s.status === "active")
    .reduce((sum, s) => sum + s._count.id, 0);

  const planBreakdown = activeSubs
    .filter((s) => s.status === "active")
    .map((s) => ({
      planId: s.planId,
      label: planName.get(s.planId) ?? s.planId,
      count: s._count.id,
    }))
    .sort((a, b) => b.count - a.count);

  const revenueCents = paidOrders.reduce((sum, o) => sum + o.amountCents, 0);

  const conversionRate =
    shareTotal > 0 ? Math.round((referralSignups / shareTotal) * 1000) / 10 : 0;

  return NextResponse.json({
    days,
    since: toDayKey(since),
    series: {
      shareEvents: countByDay(
        shareRows.map((r) => r.createdAt),
        dayKeys,
      ),
      userSignups: countByDay(
        userRows.map((r) => r.createdAt),
        dayKeys,
      ),
      referralSignups: countByDay(
        referralRows.map((r) => r.createdAt),
        dayKeys,
      ),
      worksCreated: {
        game: countByDay(
          gameRows.map((r) => r.createdAt),
          dayKeys,
        ),
        novel: countByDay(
          novelRows.map((r) => r.createdAt),
          dayKeys,
        ),
        comic: countByDay(
          comicRows.map((r) => r.createdAt),
          dayKeys,
        ),
      },
    },
    product: {
      worksByType: { game: gameTotal, novel: novelTotal, comic: comicTotal },
      visibility: Object.fromEntries(visibilityTotals),
      featured: featuredG + featuredN + featuredC,
    },
    social: {
      shareTotal,
      referralSignups,
      conversionRate,
      channels: byChannel.map((c) => ({
        channel: c.channel,
        count: c._count.id,
      })),
      funnel: [
        { stage: "shareEvents", value: shareTotal },
        { stage: "referralSignups", value: referralSignups },
        { stage: "allPaidOrders", value: paidOrders.length },
      ],
    },
    commerce: {
      paidOrders: paidOrders.length,
      revenueCents,
      activeSubscriptions: activeSubscriptionCount,
      planBreakdown,
      quotaByReason: quotaByReason
        .map((q) => ({
          reason: q.reason,
          events: q._count.id,
          deltaSum: q._sum.delta ?? 0,
        }))
        .sort((a, b) => Math.abs(b.deltaSum) - Math.abs(a.deltaSum)),
      paymentsByDay: countByDay(
        paidOrders.filter((o) => o.paidAt).map((o) => o.paidAt!),
        dayKeys,
      ),
    },
  });
}
