import { countReferralPaidOrders } from "@/lib/admin/referral-funnel";

const count = countReferralPaidOrders([
  { user: { referredById: "referrer-a" } },
  { user: { referredById: null } },
  { user: null },
  { user: { referredById: "referrer-b" } },
]);

if (count !== 2) {
  throw new Error(`Expected 2 referral-paid orders, got ${count}`);
}

console.log("[OK] qa-referral-funnel");
