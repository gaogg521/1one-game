import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** 负载均衡 / 容器探针：校验进程与数据库连通性。 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      db: "up",
      ts: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }
}
