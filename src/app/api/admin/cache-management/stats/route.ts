import { getCacheStats } from "@/lib/comic-character-sheet-cache-ttl";
import { requireSuperAdmin } from "@/lib/auth/admin";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const gate = await requireSuperAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const stats = getCacheStats();
    return Response.json(stats);
  } catch (e) {
    console.error("[cache-management] 获取统计信息失败:", e);
    return Response.json(
      { error: "Failed to get cache stats" },
      { status: 500 }
    );
  }
}
