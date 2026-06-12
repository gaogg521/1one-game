import { NextResponse } from "next/server";
import { grantQuota } from "@/lib/commerce/quota";
import { prisma } from "@/lib/prisma";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("x-cron-secret") === secret;
}

/**
 * 订阅到期续期：将 periodEnd 已过期的 active 订阅标记 expired；
 * 对即将到期（7 天内）且已付费的订阅延长周期并发放月度额度（幂等按周期 refId）。
 */
export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 403 });

  const now = new Date();
  const expired = await prisma.userSubscription.updateMany({
    where: { status: "active", periodEnd: { lt: now } },
    data: { status: "expired" },
  });

  const soon = new Date(now);
  soon.setDate(soon.getDate() + 7);

  const renewing = await prisma.userSubscription.findMany({
    where: { status: "active", periodEnd: { lte: soon, gt: now } },
    include: { plan: true },
  });

  let renewed = 0;
  for (const sub of renewing) {
    const refId = `renew_${sub.id}_${sub.periodEnd.toISOString().slice(0, 10)}`;
    const existing = await prisma.quotaLedger.findFirst({
      where: { userId: sub.userId, reason: "subscription_grant", refId },
    });
    if (existing) continue;

    const nextEnd = new Date(sub.periodEnd);
    nextEnd.setMonth(nextEnd.getMonth() + 1);
    await prisma.userSubscription.update({
      where: { id: sub.id },
      data: { periodStart: sub.periodEnd, periodEnd: nextEnd },
    });
    await grantQuota({
      userId: sub.userId,
      delta: sub.plan.monthlyQuota,
      reason: "subscription_grant",
      refType: "subscription",
      refId,
    });
    renewed++;
  }

  return NextResponse.json({ ok: true, expired: expired.count, renewed });
}
