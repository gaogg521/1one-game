import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/admin";
import { getSavedRuntimeProvider } from "@/lib/runtime-config";
import { discoverRuntimeProviderModels } from "@/lib/runtime-provider-models";
import type { RuntimeLlmProvider } from "@/lib/runtime-providers";

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
    // 已保存服务商只传 ID；API Key 仅在服务器端解密后用于 /models 请求。
    const provider = await getSavedRuntimeProvider(body.providerId);
    if (!provider) return NextResponse.json({ error: "provider not found" }, { status: 404 });
    const result = await discoverRuntimeProviderModels(provider);
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  }

  if (!body.provider?.id) return NextResponse.json({ error: "provider required" }, { status: 400 });
  const result = await discoverRuntimeProviderModels(body.provider);
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
