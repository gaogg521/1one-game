import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadEmailConfig } from "@/lib/email-config";
import { isEmailDeliveryConfigured } from "@/lib/auth/email-sender";

/** 负载均衡 / 容器探针：校验进程与数据库连通性。 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await loadEmailConfig();
    return NextResponse.json({
      ok: true,
      db: "up",
      email: isEmailDeliveryConfigured() ? "configured" : "missing",
      ts: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }
}
