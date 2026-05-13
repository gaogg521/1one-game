import { NextResponse } from "next/server";
import { generateGameSpecVariantBatch } from "@/lib/generate-spec";
import { getOwnerKey } from "@/lib/owner";
import { parseGeneratePayload } from "@/lib/parse-generate-request";
import { rateLimit } from "@/lib/rate-limit";
import { getThrottleKey } from "@/lib/request-key";

/** 并行生成 2～3 套不同风味的小游戏规格，供用户挑选预览。 */
export async function POST(req: Request) {
  const ownerKey = (await getOwnerKey()) ?? "anon";
  const throttleKey = await getThrottleKey("gen_variants", ownerKey);
  if (!rateLimit(throttleKey, 10, 60_000)) {
    return NextResponse.json({ error: "多套生成次数过多，请稍后再试" }, { status: 429 });
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

  let count = 3;
  if (typeof body === "object" && body !== null && "count" in body) {
    const c = Number((body as { count?: unknown }).count);
    if (c === 2 || c === 3) count = c;
  }

  try {
    const variants = await generateGameSpecVariantBatch(parsed.prompt, count === 2 ? 2 : 3, {
      searchEnhance: parsed.searchEnhance,
      templateHint: parsed.templateHint,
      enhancePass: parsed.enhancePass,
    });
    return NextResponse.json({ variants });
  } catch {
    return NextResponse.json({ error: "多套生成失败" }, { status: 500 });
  }
}
