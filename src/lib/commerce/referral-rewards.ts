import { PRODUCT } from "@/lib/product-config";
import { grantQuota } from "@/lib/commerce/quota";
import { prisma } from "@/lib/prisma";

/** 新用户通过 ?ref= 注册后，双向发放邀请奖励（幂等） */
export async function grantReferralRewards(referrerId: string, inviteeId: string): Promise<void> {
  if (referrerId === inviteeId) return;

  const existing = await prisma.referralReward.findUnique({ where: { inviteeId } });
  if (existing) return;

  const referrerCredits = PRODUCT.commerce.referralReferrerCredits;
  const inviteeCredits = PRODUCT.commerce.referralInviteeCredits;
  const total = referrerCredits + inviteeCredits;
  if (total <= 0) return;

  await prisma.$transaction(async (tx) => {
    await tx.referralReward.create({
      data: {
        referrerId,
        inviteeId,
        credits: total,
      },
    });
  });

  if (referrerCredits > 0) {
    await grantQuota({
      userId: referrerId,
      delta: referrerCredits,
      reason: "referral_referrer",
      refType: "user",
      refId: inviteeId,
    });
  }
  if (inviteeCredits > 0) {
    await grantQuota({
      userId: inviteeId,
      delta: inviteeCredits,
      reason: "referral_invitee",
      refType: "user",
      refId: referrerId,
    });
  }
}
