import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const { searchParams } = new URL(req.url);
  const days = Math.min(Math.max(parseInt(searchParams.get("days") ?? "30", 10) || 30, 1), 180);
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 1), 200);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [rewards, totalRewards, creditSum, uniqueReferrers] = await Promise.all([
    prisma.referralReward.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        credits: true,
        createdAt: true,
        referrer: { select: { id: true, displayName: true, referralCode: true, email: true } },
        invitee: { select: { id: true, displayName: true, email: true } },
      },
    }),
    prisma.referralReward.count({ where: { createdAt: { gte: since } } }),
    prisma.referralReward.aggregate({
      where: { createdAt: { gte: since } },
      _sum: { credits: true },
    }),
    prisma.referralReward.groupBy({
      by: ["referrerId"],
      where: { createdAt: { gte: since } },
      _count: { id: true },
    }),
  ]);

  return NextResponse.json({
    days,
    summary: {
      totalRewards,
      totalCredits: creditSum._sum.credits ?? 0,
      uniqueReferrers: uniqueReferrers.length,
    },
    rewards: rewards.map((r) => ({
      id: r.id,
      referrerId: r.referrer.id,
      referrerName: r.referrer.displayName ?? r.referrer.email ?? r.referrer.id,
      referrerCode: r.referrer.referralCode,
      inviteeId: r.invitee.id,
      inviteeName: r.invitee.displayName ?? r.invitee.email ?? r.invitee.id,
      credits: r.credits,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
