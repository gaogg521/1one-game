import type { AppLocale } from "@/i18n/routing";
import { tMessage } from "@/lib/i18n/messages";

const PLAN_IDS = ["free", "creator", "pro"] as const;
type CommercePlanId = (typeof PLAN_IDS)[number];

function isCommercePlanId(id: string): id is CommercePlanId {
  return (PLAN_IDS as readonly string[]).includes(id);
}

/** 套餐展示名：优先 messages.commercePlans，回退 API/DB 字段。 */
export function localizedPlanName(locale: AppLocale, planId: string, fallbackName?: string): string {
  if (isCommercePlanId(planId)) {
    const fromMessages = tMessage(locale, `commercePlans.${planId}.name`);
    if (fromMessages !== `commercePlans.${planId}.name`) return fromMessages;
  }
  return fallbackName ?? planId;
}
