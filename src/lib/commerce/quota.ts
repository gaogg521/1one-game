import { PRODUCT } from "@/lib/product-config";
import { prisma } from "@/lib/prisma";

export type QuotaReason =
  | "signup_bonus"
  | "referral_referrer"
  | "referral_invitee"
  | "purchase"
  | "generation_game"
  | "generation_novel"
  | "generation_novel_long"
  | "generation_comic"
  | "admin_grant"
  | "subscription_grant";

export type GenerationKind =
  | "game"
  | "novel"
  | "comic"
  | "novelContinue"
  | "comicPanels"
  | "refine"
  | "variants"
  | "cover";

export function generationQuotaCost(kind: GenerationKind, opts?: { long?: boolean }): number {
  const c = PRODUCT.commerce.generationCost;
  switch (kind) {
    case "game":
      return c.game;
    case "comic":
      return c.comic;
    case "comicPanels":
      return c.comicPanels;
    case "novelContinue":
      return c.novelContinue;
    case "refine":
      return c.refine;
    case "variants":
      return c.variants;
    case "cover":
      return c.cover;
    default:
      return opts?.long ? c.novelLong : c.novel;
  }
}

function reasonForGeneration(kind: GenerationKind, long?: boolean): QuotaReason {
  switch (kind) {
    case "game":
      return "generation_game";
    case "comic":
      return "generation_comic";
    case "comicPanels":
      return "generation_comic";
    case "novelContinue":
      return "generation_novel";
    case "refine":
      return "generation_game";
    case "variants":
      return "generation_game";
    case "cover":
      return "generation_game";
    default:
      return long ? "generation_novel_long" : "generation_novel";
  }
}

export async function getUserQuotaBalance(userId: string): Promise<number> {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { quotaBalance: true } });
  return row?.quotaBalance ?? 0;
}

export async function getActiveSubscription(userId: string) {
  const now = new Date();
  return prisma.userSubscription.findFirst({
    where: { userId, status: "active", periodEnd: { gt: now } },
    orderBy: { periodEnd: "desc" },
    include: { plan: true },
  });
}

export async function getQuotaSummary(userId: string) {
  const [balance, sub] = await Promise.all([getUserQuotaBalance(userId), getActiveSubscription(userId)]);
  return {
    balance,
    plan: sub
      ? {
          id: sub.planId,
          name: sub.plan.name,
          periodEnd: sub.periodEnd.toISOString(),
          monthlyQuota: sub.plan.monthlyQuota,
        }
      : { id: "free", name: "免费版", periodEnd: null, monthlyQuota: PRODUCT.commerce.freePlanMonthlyQuota },
    totalAvailable: balance,
  };
}

export async function grantQuota(opts: {
  userId: string;
  delta: number;
  reason: QuotaReason;
  refType?: string;
  refId?: string;
}): Promise<number> {
  if (opts.delta === 0) return getUserQuotaBalance(opts.userId);
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: opts.userId },
      data: { quotaBalance: { increment: opts.delta } },
      select: { quotaBalance: true },
    });
    await tx.quotaLedger.create({
      data: {
        userId: opts.userId,
        delta: opts.delta,
        balanceAfter: user.quotaBalance,
        reason: opts.reason,
        refType: opts.refType,
        refId: opts.refId,
      },
    });
    return user.quotaBalance;
  });
}

export async function consumeGenerationQuota(
  userId: string,
  kind: GenerationKind,
  opts?: { long?: boolean; refId?: string },
): Promise<{ ok: true; balance: number } | { ok: false; error: string; needed: number; available: number }> {
  const cost = generationQuotaCost(kind, opts);
  if (cost <= 0) return { ok: true, balance: await getUserQuotaBalance(userId) };

  try {
    const newBalance = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { quotaBalance: true } });
      const balance = user?.quotaBalance ?? 0;
      if (balance < cost) {
        throw new QuotaInsufficientError(cost, balance);
      }
      const updated = await tx.user.update({
        where: { id: userId },
        data: { quotaBalance: { decrement: cost } },
        select: { quotaBalance: true },
      });
      await tx.quotaLedger.create({
        data: {
          userId,
          delta: -cost,
          balanceAfter: updated.quotaBalance,
          reason: reasonForGeneration(kind, opts?.long),
          refType: "generation",
          refId: opts?.refId,
        },
      });
      return updated.quotaBalance;
    });
    return { ok: true, balance: newBalance };
  } catch (e) {
    if (e instanceof QuotaInsufficientError) {
      return {
        ok: false,
        error: "quotaInsufficient",
        needed: e.needed,
        available: e.available,
      };
    }
    throw e;
  }
}

class QuotaInsufficientError extends Error {
  constructor(
    public needed: number,
    public available: number,
  ) {
    super("quota insufficient");
  }
}

export async function grantSignupBonus(userId: string): Promise<void> {
  const bonus = PRODUCT.commerce.signupBonusQuota;
  if (bonus <= 0) return;
  const existing = await prisma.quotaLedger.findFirst({
    where: { userId, reason: "signup_bonus" },
  });
  if (existing) return;
  await grantQuota({ userId, delta: bonus, reason: "signup_bonus", refType: "user", refId: userId });
}
