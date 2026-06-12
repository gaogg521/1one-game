import { NextResponse } from "next/server";
import { fulfillPaidOrder } from "@/lib/commerce/payment";
import { localizedJsonError } from "@/lib/api/localized-error";

/** 开发环境模拟支付成功（PAYMENT_DEV_MODE=1） */
export async function POST(req: Request) {
  if (process.env.PAYMENT_DEV_MODE !== "1") {
    return localizedJsonError(req, "devOnly", 403);
  }
  const body = (await req.json().catch(() => ({}))) as { orderId?: string };
  const orderId = body.orderId?.trim();
  if (!orderId) return localizedJsonError(req, "missingOrderId", 400);
  const ok = await fulfillPaidOrder(orderId, { simulated: true });
  return NextResponse.json({ ok });
}
