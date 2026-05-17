import { NextResponse } from "next/server";
import { patchGameSpecWithLlm } from "@/lib/spec-patch";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "请求体必须是对象" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const instruction = typeof b.prompt === "string" ? b.prompt : "";
  const currentPrompt = typeof b.currentPrompt === "string" ? b.currentPrompt.trim() : "";

  const result = await patchGameSpecWithLlm({
    instruction,
    currentSpec: b.currentSpec,
    currentPrompt,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    spec: result.spec,
    prompt: result.mergedPrompt,
  });
}
