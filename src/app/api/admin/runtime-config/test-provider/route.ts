import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/admin";
import type { RuntimeLlmProvider } from "@/lib/runtime-providers";
import { testRuntimeProvider } from "@/lib/runtime-provider-test";

export async function POST(req: Request) {
  const gate = await requireSuperAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  let body: { provider?: RuntimeLlmProvider };
  try {
    body = (await req.json()) as { provider?: RuntimeLlmProvider };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.provider?.id) {
    return NextResponse.json({ error: "provider required" }, { status: 400 });
  }

  const result = await testRuntimeProvider(body.provider);
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
