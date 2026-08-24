import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/admin";
import { getSavedRuntimeProvider } from "@/lib/runtime-config";
import type { RuntimeLlmProvider } from "@/lib/runtime-providers";
import { testRuntimeProvider } from "@/lib/runtime-provider-test";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const gate = await requireSuperAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  let body: { providerId?: string; provider?: RuntimeLlmProvider };
  try {
    body = (await req.json()) as { providerId?: string; provider?: RuntimeLlmProvider };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.providerId?.trim()) {
    // 已保存服务商只传 ID，密钥始终留在服务端的加密运行时配置中。
    const provider = await getSavedRuntimeProvider(body.providerId);
    if (!provider) {
      return NextResponse.json({ error: "provider not found" }, { status: 404 });
    }
    const startedAt = Date.now();
    const result = await testRuntimeProvider(provider);
    await prisma.runtimeProviderProbe.create({
      data: {
        providerId: provider.id,
        ok: result.ok,
        statusCode: result.status,
        outcome: result.message.slice(0, 96),
        latencyMs: Date.now() - startedAt,
      },
    }).catch(() => undefined);
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  }

  if (!body.provider?.id) {
    return NextResponse.json({ error: "provider required" }, { status: 400 });
  }

  const result = await testRuntimeProvider(body.provider);
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
