import { PRODUCT } from "@/lib/product-config";
import { prisma } from "@/lib/prisma";

export type PlanId = "free" | "creator" | "pro";

export const SUBSCRIPTION_PLANS = [
  {
    id: "free" as const,
    name: "免费版",
    monthlyQuota: PRODUCT.commerce.freePlanMonthlyQuota,
    priceCents: 0,
    features: ["每月基础生成额度", "公开分享与发现"],
  },
  {
    id: "creator" as const,
    name: "创作者",
    monthlyQuota: 300,
    priceCents: 2900,
    features: ["每月 300 次生成额度", "优先队列", "邀请奖励加倍"],
  },
  {
    id: "pro" as const,
    name: "专业版",
    monthlyQuota: 1200,
    priceCents: 9900,
    features: ["每月 1200 次生成额度", "专属客服", "企业级审核加速"],
  },
];

export async function ensureSubscriptionPlansSeeded(): Promise<void> {
  for (const p of SUBSCRIPTION_PLANS) {
    await prisma.subscriptionPlan.upsert({
      where: { id: p.id },
      create: {
        id: p.id,
        name: p.name,
        monthlyQuota: p.monthlyQuota,
        priceCents: p.priceCents,
        featuresJson: JSON.stringify(p.features),
      },
      update: {
        name: p.name,
        monthlyQuota: p.monthlyQuota,
        priceCents: p.priceCents,
        featuresJson: JSON.stringify(p.features),
      },
    });
  }
}

export function getPlanById(id: string) {
  return SUBSCRIPTION_PLANS.find((p) => p.id === id) ?? SUBSCRIPTION_PLANS[0];
}
