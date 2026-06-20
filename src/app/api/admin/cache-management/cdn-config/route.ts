import { requireSuperAdmin } from "@/lib/auth/admin";
import { readCdnConfigFromDb, saveCdnConfigToDb, type CdnConfigStored } from "@/lib/runtime-config";
import { NextResponse } from "next/server";

export type CdnConfigPayload = CdnConfigStored;

/**
 * 获取 CDN 配置
 * GET /api/admin/cache-management/cdn-config
 */
export async function GET(req: Request) {
  const gate = await requireSuperAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const stored = await readCdnConfigFromDb();
    if (!stored) {
      return NextResponse.json({
        provider: process.env.CDN_PROVIDER || "custom",
        endpoint: process.env.CDN_ENDPOINT || "",
        bucket: process.env.CDN_BUCKET || "",
        ttlSeconds: parseInt(process.env.CDN_TTL_SECONDS || "2592000", 10),
      });
    }
    // Never expose raw secrets — mask them
    return NextResponse.json({
      ...stored,
      accessKey: stored.accessKey ? "***" : undefined,
      secretKey: stored.secretKey ? "***" : undefined,
    });
  } catch (e) {
    console.error("[cdn-config] 获取 CDN 配置失败:", e);
    return NextResponse.json({ error: "Failed to get CDN config" }, { status: 500 });
  }
}

/**
 * 更新 CDN 配置
 * PATCH /api/admin/cache-management/cdn-config
 */
export async function PATCH(req: Request) {
  const gate = await requireSuperAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const body = (await req.json()) as Partial<CdnConfigPayload> | undefined;

    if (!body || !body.provider || !body.endpoint) {
      return NextResponse.json({ error: "Missing required fields: provider, endpoint" }, { status: 400 });
    }

    if (!body.endpoint.startsWith("http")) {
      return NextResponse.json(
        { error: "Invalid endpoint: must start with http:// or https://" },
        { status: 400 },
      );
    }

    const ttl = body.ttlSeconds ?? 2592000;
    if (ttl < 3600 || ttl > 31536000) {
      return NextResponse.json(
        { error: "Invalid TTL: must be between 1 hour and 1 year (3600-31536000 seconds)" },
        { status: 400 },
      );
    }

    // Merge with existing so partial updates preserve secrets
    const existing = await readCdnConfigFromDb();
    const config: CdnConfigStored = {
      provider: body.provider,
      endpoint: body.endpoint,
      // If caller passes "***" sentinel (masked read-back), keep existing secret
      accessKey: body.accessKey === "***" ? existing?.accessKey : body.accessKey,
      secretKey: body.secretKey === "***" ? existing?.secretKey : body.secretKey,
      bucket: body.bucket,
      ttlSeconds: ttl,
    };

    await saveCdnConfigToDb(config);

    console.info(`[cdn-config] CDN 配置已更新：provider=${config.provider} endpoint=${config.endpoint}`);

    return NextResponse.json({
      ok: true,
      message: "CDN config updated successfully",
      config: {
        ...config,
        accessKey: config.accessKey ? "***" : undefined,
        secretKey: config.secretKey ? "***" : undefined,
      },
    });
  } catch (e) {
    console.error("[cdn-config] 更新 CDN 配置失败:", e);
    return NextResponse.json(
      { error: "Failed to update CDN config", details: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

/**
 * 验证 CDN 配置连通性
 * POST /api/admin/cache-management/cdn-config
 */
export async function POST(req: Request) {
  const gate = await requireSuperAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const body = (await req.json()) as Partial<CdnConfigPayload> | undefined;

    if (!body || !body.endpoint) {
      return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(body.endpoint, { method: "HEAD", signal: controller.signal });
      clearTimeout(timeout);
      const success = response.ok || response.status === 403;
      return NextResponse.json({
        valid: success,
        status: response.status,
        message: success ? "CDN endpoint is reachable" : `CDN endpoint returned ${response.status}`,
      });
    } catch (e) {
      clearTimeout(timeout);
      return NextResponse.json({
        valid: false,
        message: `CDN endpoint verification failed: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  } catch (e) {
    console.error("[cdn-config] 验证 CDN 配置失败:", e);
    return NextResponse.json(
      { error: "Failed to verify CDN config", details: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
