import { createHash, randomBytes } from "crypto";
import { grantQuota } from "@/lib/commerce/quota";
import { ensureSubscriptionPlansSeeded, getPlanById } from "@/lib/commerce/plans";
import { prisma } from "@/lib/prisma";

export class PaymentOrderError extends Error {
  constructor(public readonly errorKey: "invalidPlan") {
    super(errorKey);
    this.name = "PaymentOrderError";
  }
}

export function newOrderId(): string {
  return `1one_${Date.now()}_${randomBytes(4).toString("hex")}`;
}

export async function createPaymentOrder(opts: {
  userId: string;
  planId: string;
  provider: "wechat" | "alipay" | "dev";
}): Promise<{ orderId: string; amountCents: number; planId: string }> {
  await ensureSubscriptionPlansSeeded();
  const plan = getPlanById(opts.planId);
  if (!plan || plan.id === "free") {
    throw new PaymentOrderError("invalidPlan");
  }
  const orderId = newOrderId();
  await prisma.paymentEvent.create({
    data: {
      userId: opts.userId,
      provider: opts.provider,
      orderId,
      amountCents: plan.priceCents,
      planId: plan.id,
      status: "pending",
    },
  });
  return { orderId, amountCents: plan.priceCents, planId: plan.id };
}

function verifyDevWebhookSecret(req: Request): boolean {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET?.trim();
  if (!secret) return process.env.PAYMENT_DEV_MODE === "1";
  return req.headers.get("x-payment-webhook-secret") === secret;
}

/** 支付成功：幂等激活订阅并赠送额度 */
export async function fulfillPaidOrder(orderId: string, payload?: unknown): Promise<boolean> {
  const order = await prisma.paymentEvent.findUnique({ where: { orderId } });
  if (!order) return false;
  if (order.status === "paid") return true;
  if (!order.userId || !order.planId) return false;

  await ensureSubscriptionPlansSeeded();
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: order.planId } });
  if (!plan) return false;

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  await prisma.$transaction(async (tx) => {
    await tx.paymentEvent.update({
      where: { orderId },
      data: {
        status: "paid",
        paidAt: now,
        payloadJson: payload ? JSON.stringify(payload) : undefined,
      },
    });
    await tx.userSubscription.updateMany({
      where: { userId: order.userId!, status: "active" },
      data: { status: "cancelled" },
    });
    await tx.userSubscription.create({
      data: {
        userId: order.userId!,
        planId: plan.id,
        status: "active",
        periodStart: now,
        periodEnd,
        externalSubId: orderId,
      },
    });
  });

  await grantQuota({
    userId: order.userId,
    delta: plan.monthlyQuota,
    reason: "subscription_grant",
    refType: "payment",
    refId: orderId,
  });

  return true;
}

export async function handleWechatPayNotify(req: Request): Promise<{ code: string; message: string }> {
  if (!verifyDevWebhookSecret(req)) {
    return { code: "FAIL", message: "unauthorized" };
  }
  const body = (await req.json().catch(() => ({}))) as { orderId?: string; out_trade_no?: string };
  const orderId = body.orderId ?? body.out_trade_no;
  if (!orderId) return { code: "FAIL", message: "missing orderId" };
  const ok = await fulfillPaidOrder(orderId, body);
  return ok ? { code: "SUCCESS", message: "ok" } : { code: "FAIL", message: "order not found" };
}

export async function handleAlipayNotify(req: Request): Promise<string> {
  if (!verifyDevWebhookSecret(req)) return "fail";
  const form = await req.formData().catch(() => null);
  const orderId =
    (form?.get("out_trade_no") as string | null) ??
    ((await req.json().catch(() => ({}))) as { out_trade_no?: string }).out_trade_no;
  if (!orderId) return "fail";
  const ok = await fulfillPaidOrder(orderId, form ? Object.fromEntries(form.entries()) : undefined);
  return ok ? "success" : "fail";
}

/** 微信 V2 MD5 签名校验；开发模式可跳过 */
export function verifyWechatSign(payload: Record<string, string>, apiKey: string): boolean {
  if (process.env.PAYMENT_DEV_MODE === "1") return true;
  const sign = payload.sign?.trim();
  if (!sign || !apiKey) return false;
  const expected = md5Sign(payload, apiKey);
  return sign.toUpperCase() === expected;
}

export function md5Sign(params: Record<string, string>, apiKey: string): string {
  const sorted = Object.keys(params)
    .filter((k) => params[k] !== "" && k !== "sign")
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("md5").update(`${sorted}&key=${apiKey}`).digest("hex").toUpperCase();
}
