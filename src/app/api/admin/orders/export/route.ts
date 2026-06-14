import { clampDays } from "@/lib/admin/analytics";
import { requireAdmin, writeAdminAudit } from "@/lib/auth/admin";
import { prisma } from "@/lib/prisma";

function csvCell(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

/** GET ?days=30 — 导出支付订单 CSV（运营对账） */
export async function GET(req: Request) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return new Response(JSON.stringify({ error: gate.error }), { status: gate.status });

  const { searchParams } = new URL(req.url);
  const days = clampDays(searchParams.get("days"), 30);
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));

  const orders = await prisma.paymentEvent.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 5000,
    select: {
      orderId: true,
      provider: true,
      amountCents: true,
      currency: true,
      status: true,
      planId: true,
      userId: true,
      createdAt: true,
      paidAt: true,
    },
  });

  const header = [
    "orderId",
    "provider",
    "status",
    "amountCents",
    "currency",
    "planId",
    "userId",
    "createdAt",
    "paidAt",
  ];
  const body: string[][] = orders.map((o) => [
    o.orderId,
    o.provider,
    o.status,
    String(o.amountCents),
    o.currency,
    o.planId ?? "",
    o.userId ?? "",
    o.createdAt.toISOString(),
    o.paidAt?.toISOString() ?? "",
  ]);

  await writeAdminAudit({
    req,
    actorUserId: gate.user?.id,
    actorOwnerKey: gate.ownerKey,
    action: "orders_export",
    targetType: "payment_export",
    detail: { days, rowCount: orders.length, since: since.toISOString() },
  });

  const csv = `\uFEFF${toCsv([header, ...body])}`;
  const filename = `orders-${days}d-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
