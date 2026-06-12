import { NextResponse } from "next/server";
import { getCurrentAuthUser } from "@/lib/auth/user";
import { createPaymentOrder, PaymentOrderError } from "@/lib/commerce/payment";
import { localizedApiErrorText, localizedJsonError } from "@/lib/api/localized-error";

export async function POST(req: Request) {
  const user = await getCurrentAuthUser();
  if (!user) return localizedJsonError(req, "pleaseLogin", 401);

  const body = (await req.json().catch(() => ({}))) as {
    planId?: string;
    provider?: string;
  };
  const planId = body.planId?.trim();
  if (!planId || planId === "free") {
    return localizedJsonError(req, "invalidPlan", 400);
  }
  const provider =
    body.provider === "alipay" ? "alipay" : body.provider === "dev" ? "dev" : "wechat";

  try {
    const order = await createPaymentOrder({ userId: user.id, planId, provider });
    const devPay =
      process.env.PAYMENT_DEV_MODE === "1"
        ? {
            hint: localizedApiErrorText(req, "commerceDevPayHint"),
            simulateUrl: "/api/payment/dev/simulate",
          }
        : undefined;
    return NextResponse.json({ order, devPay });
  } catch (e) {
    if (e instanceof PaymentOrderError) {
      return localizedJsonError(req, e.errorKey, 400);
    }
    return localizedJsonError(req, "createOrderFailed", 400);
  }
}
