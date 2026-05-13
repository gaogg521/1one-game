import { NextResponse } from "next/server";
import { generateGameSpecWithMeta } from "@/lib/generate-spec";
import { getOwnerKey } from "@/lib/owner";
import { parseGeneratePayload } from "@/lib/parse-generate-request";
import { rateLimit } from "@/lib/rate-limit";
import { getThrottleKey } from "@/lib/request-key";

export async function POST(req: Request) {
  const ownerKey = (await getOwnerKey()) ?? "anon";
  const throttleKey = await getThrottleKey("gen", ownerKey);
  if (!rateLimit(throttleKey, 24, 60_000)) {
    return NextResponse.json({ error: "生成次数过多，请一分钟后再试" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "无效的 JSON" }, { status: 400 });
  }

  const parsed = parseGeneratePayload(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  try {
    const { spec, source, web, debug } = await generateGameSpecWithMeta(parsed.prompt, {
      searchEnhance: parsed.searchEnhance,
      templateHint: parsed.templateHint,
      enhancePass: parsed.enhancePass,
    });
    return NextResponse.json({ spec, source, web, debug });
  } catch {
    return NextResponse.json({ error: "生成失败，请稍后重试" }, { status: 500 });
  }
}
