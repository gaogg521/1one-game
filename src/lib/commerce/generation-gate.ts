import { getSessionAuthUser, isQuotaEligibleUser } from "@/lib/auth/user";
import { consumeGenerationQuota, type GenerationKind } from "@/lib/commerce/quota";
import type { AppLocale } from "@/i18n/routing";
import { apiErrorMessage } from "@/lib/i18n/progress-message";

export type QuotaGateOpts = { long?: boolean; refId?: string; uiLocale?: AppLocale };

/**
 * OAuth 已登录用户消耗生成额度；匿名与 lazy User 仍走 rateLimit，不扣额度。
 * 返回 null 表示通过；否则返回 402 JSON Response。
 */
export async function gateGenerationQuota(
  kind: GenerationKind,
  opts?: QuotaGateOpts,
): Promise<Response | null> {
  const user = await getSessionAuthUser();
  if (!isQuotaEligibleUser(user)) return null;

  const result = await consumeGenerationQuota(user.id, kind, opts);
  if (result.ok) return null;

  return quotaExceededResponse(
    apiErrorMessage(opts?.uiLocale ?? "zh-Hans", "quotaInsufficient"),
    result.needed,
    result.available,
  );
}

export function quotaExceededResponse(
  error: string,
  needed: number,
  available: number,
): Response {
  return new Response(
    JSON.stringify({
      error,
      code: "QUOTA_EXCEEDED",
      needed,
      available,
    }),
    { status: 402, headers: { "Content-Type": "application/json; charset=utf-8" } },
  );
}
