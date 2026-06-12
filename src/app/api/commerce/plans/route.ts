import { NextResponse } from "next/server";
import { ensureSubscriptionPlansSeeded, SUBSCRIPTION_PLANS } from "@/lib/commerce/plans";

export async function GET() {
  await ensureSubscriptionPlansSeeded();
  return NextResponse.json({ plans: SUBSCRIPTION_PLANS });
}
