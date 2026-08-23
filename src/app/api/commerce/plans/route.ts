import { NextResponse } from "next/server";
import { ensureSubscriptionPlansSeeded, SUBSCRIPTION_PLANS } from "@/lib/commerce/plans";
import { getPaymentCheckoutAvailability } from "@/lib/commerce/payment";

export async function GET() {
  await ensureSubscriptionPlansSeeded();
  return NextResponse.json({ plans: SUBSCRIPTION_PLANS, checkout: getPaymentCheckoutAvailability() });
}
