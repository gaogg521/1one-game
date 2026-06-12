import { grantReferralRewards } from "@/lib/commerce/referral-rewards";
import { prisma } from "@/lib/prisma";
import type { ShareChannel } from "@/lib/auth/types";

export async function recordShareEvent(opts: {
  shareCode: string;
  workType: "game" | "novel" | "comic";
  workId: string;
  channel?: ShareChannel;
  referrerUserId?: string | null;
  visitorOwnerKey?: string | null;
}) {
  try {
    await prisma.shareEvent.create({
      data: {
        shareCode: opts.shareCode,
        workType: opts.workType,
        workId: opts.workId,
        channel: opts.channel ?? "unknown",
        referrerUserId: opts.referrerUserId ?? undefined,
        visitorOwnerKey: opts.visitorOwnerKey ?? undefined,
      },
    });
  } catch {
    /* 归因失败不阻断跳转 */
  }
}

export async function bindReferralOnSignup(newUserId: string, referralCode: string | undefined) {
  const code = referralCode?.trim();
  if (!code) return;
  const referrer = await prisma.user.findUnique({ where: { referralCode: code } });
  if (!referrer || referrer.id === newUserId) return;
  await prisma.user.update({
    where: { id: newUserId },
    data: { referredById: referrer.id },
  });
  await grantReferralRewards(referrer.id, newUserId);
}
