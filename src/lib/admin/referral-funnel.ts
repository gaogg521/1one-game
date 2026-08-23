/**
 * Keep social attribution separate from platform-wide revenue: a paid order is
 * referral-attributed only when the payer account carries a referrer.
 */
export function countReferralPaidOrders(
  orders: ReadonlyArray<{ user: { referredById: string | null } | null }>,
): number {
  return orders.filter((order) => Boolean(order.user?.referredById)).length;
}
