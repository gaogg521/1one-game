import { requireSuperAdmin } from "@/lib/auth/admin";
import { NextResponse } from "next/server";

export type CacheManagementConfig = {
  storageMode: "session" | "home-dir" | "cdn";
  cdnEndpoint?: string;
  ttlDays: number;
  validateIntervalDays: number;
  maxLocalFiles: number;
};

// 内存存储（实际应写入数据库）
let cachedConfig: CacheManagementConfig = {
  storageMode: "home-dir",
  ttlDays: 30,
  validateIntervalDays: 7,
  maxLocalFiles: 1000,
};

export async function GET(req: Request) {
  const gate = await requireSuperAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  return NextResponse.json(cachedConfig);
}

export async function PATCH(req: Request) {
  const gate = await requireSuperAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const body = (await req.json()) as Partial<CacheManagementConfig>;
    cachedConfig = {
      ...cachedConfig,
      ...body,
    };

    console.info("[cache-management] 配置已更新:", {
      storageMode: cachedConfig.storageMode,
      ttlDays: cachedConfig.ttlDays,
      validateIntervalDays: cachedConfig.validateIntervalDays,
      maxLocalFiles: cachedConfig.maxLocalFiles,
    });

    return NextResponse.json(cachedConfig);
  } catch (e) {
    console.error("[cache-management] 更新配置失败:", e);
    return NextResponse.json(
      { error: "Failed to update config" },
      { status: 500 }
    );
  }
}
