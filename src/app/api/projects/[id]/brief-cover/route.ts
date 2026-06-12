import { NextResponse } from "next/server";
import { CREATIVE_BRIEF_SCHEMA } from "@/lib/creative-brief/types";
import { generateGameCoverFromBrief } from "@/lib/game-brief-comfy-cover";
import { parseGameSpec } from "@/lib/game-spec";
import { getOwnerKey } from "@/lib/owner";
import { prisma } from "@/lib/prisma";
import { loadProjectCreativeBrief } from "@/lib/project-creative-brief-db";
import { gateGenerationQuota } from "@/lib/commerce/generation-gate";
import { rateLimit } from "@/lib/rate-limit";
import { getThrottleKey } from "@/lib/request-key";
import { localizedJsonError } from "@/lib/api/localized-error";

type RouteContext = { params: Promise<{ id: string }> };

/** 用已保存的 Creative Brief + spec 经 Comfy/文生图生成封面 */
export async function POST(req: Request, ctx: RouteContext) {
  const ownerKey = await getOwnerKey();
  if (!ownerKey) {
    return localizedJsonError(req, "unauthorized", 401);
  }

  const quotaBlock = await gateGenerationQuota("cover");
  if (quotaBlock) {
    const body = await quotaBlock.json();
    return NextResponse.json(body, { status: 402 });
  }

  const throttleKey = await getThrottleKey("brief_cover", ownerKey);
  if (!rateLimit(throttleKey, 8, 60_000)) {
    return localizedJsonError(req, "rateLimited", 429);
  }

  const { id } = await ctx.params;
  const row = await prisma.project.findUnique({ where: { id } });
  if (!row || row.ownerKey !== ownerKey) {
    return localizedJsonError(req, "notFound", 404);
  }

  let bodyBrief: unknown;
  try {
    const body = await req.json().catch(() => ({}));
    bodyBrief =
      typeof body === "object" && body !== null && "creativeBrief" in body
        ? (body as { creativeBrief?: unknown }).creativeBrief
        : undefined;
  } catch {
    bodyBrief = undefined;
  }

  const parsedBody = bodyBrief ? CREATIVE_BRIEF_SCHEMA.safeParse(bodyBrief) : null;
  const brief = parsedBody?.success ? parsedBody.data : await loadProjectCreativeBrief(id);

  if (!brief) {
    return localizedJsonError(req, "noBrief", 400);
  }

  let spec;
  try {
    spec = parseGameSpec(JSON.parse(row.specJson));
  } catch {
    return localizedJsonError(req, "specInvalid", 400);
  }

  const { coverPath, source } = await generateGameCoverFromBrief(id, brief, spec);
  if (!coverPath) {
    return localizedJsonError(req, "coverComfyFailed", 502);
  }

  return NextResponse.json({ coverPath, source });
}
