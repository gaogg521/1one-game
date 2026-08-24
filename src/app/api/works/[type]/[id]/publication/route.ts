import { NextResponse } from "next/server";
import { localizedJsonError } from "@/lib/api/localized-error";
import { setCreatorWorkPublication, CreatorPublicationError, type PublishableWorkType } from "@/lib/creator-publication";
import { resolveCreatorWorkStage } from "@/lib/creator-workflow";
import { getOwnerKey } from "@/lib/owner";
import { recordCreatorFunnelEvent } from "@/lib/creator-funnel";

type RouteContext = { params: Promise<{ type: string; id: string }> };

export async function POST(req: Request, ctx: RouteContext) {
  const ownerKey = await getOwnerKey();
  if (!ownerKey) return localizedJsonError(req, "unauthorized", 401);
  const { type, id } = await ctx.params;
  if (type !== "game" && type !== "novel" && type !== "comic") return localizedJsonError(req, "notFound", 404);
  const body = (await req.json().catch(() => ({}))) as { action?: string; revisionId?: unknown };
  const action = body.action === "unpublish" ? "unpublish" : body.action === "publish" ? "publish" : null;
  if (!action) return localizedJsonError(req, "invalidRequest", 400);

  try {
    const revisionId = typeof body.revisionId === "string" ? body.revisionId.trim() : undefined;
    const result = await setCreatorWorkPublication({ type: type as PublishableWorkType, id, ownerKey, action, ...(revisionId ? { revisionId } : {}) });
    if (action === "publish") await recordCreatorFunnelEvent({ event: "publish", workType: type });
    return NextResponse.json({
      visibility: result.visibility,
      quality: result.quality,
      workflow: { stage: resolveCreatorWorkStage({ status: "ready", visibility: result.visibility, quality: result.quality }) },
    });
  } catch (error) {
    if (error instanceof CreatorPublicationError) {
      const status = error.code === "not_found" ? 404 : error.code === "not_owner" ? 403 : 409;
      return localizedJsonError(req, error.code, status);
    }
    return localizedJsonError(req, "publicationFailed", 500);
  }
}
