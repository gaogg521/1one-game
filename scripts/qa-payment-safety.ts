import { prisma } from "../src/lib/prisma";
import {
  createPaymentOrder,
  fulfillDevelopmentOrder,
  getPaymentCheckoutAvailability,
  PaymentOrderError,
} from "../src/lib/commerce/payment";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function main() {
  const previousMode = process.env.PAYMENT_DEV_MODE;
  const marker = `qa-payment-${Date.now()}`;
  let userId: string | null = null;
  let orderId: string | null = null;

  try {
    delete process.env.PAYMENT_DEV_MODE;
    assert(
      getPaymentCheckoutAvailability().mode === "unavailable",
      "production-like mode must expose no simulated checkout",
    );
    await createPaymentOrder({ userId: marker, planId: "creator", provider: "dev" })
      .then(() => {
        throw new Error("unavailable checkout must never create an order");
      })
      .catch((error) => {
        assert(
          error instanceof PaymentOrderError && error.errorKey === "paymentUnavailable",
          "unavailable checkout must fail with paymentUnavailable",
        );
      });

    process.env.PAYMENT_DEV_MODE = "1";
    assert(
      getPaymentCheckoutAvailability().mode === "development",
      "explicit development mode must expose only the dev checkout",
    );
    const user = await prisma.user.create({ data: { username: marker } });
    userId = user.id;
    const order = await createPaymentOrder({ userId, planId: "creator", provider: "dev" });
    orderId = order.orderId;
    const pending = await prisma.paymentEvent.findUniqueOrThrow({ where: { orderId } });
    assert(pending.provider === "dev" && pending.status === "pending", "dev checkout must create a dev pending order");
    assert(await fulfillDevelopmentOrder(orderId, { simulated: true }), "dev order must be fulfillable in explicit dev mode");
    const paid = await prisma.paymentEvent.findUniqueOrThrow({ where: { orderId } });
    assert(paid.status === "paid", "development fulfillment must mark the order paid");

    console.log("[OK] qa-payment-safety");
  } finally {
    if (previousMode === undefined) delete process.env.PAYMENT_DEV_MODE;
    else process.env.PAYMENT_DEV_MODE = previousMode;
    if (orderId) await prisma.paymentEvent.deleteMany({ where: { orderId } });
    if (userId) await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  }
}

void main();
