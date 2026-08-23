import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOwnerKey } from "@/lib/owner";
import { localizedJsonError } from "@/lib/api/localized-error";
import { parseNovelBible, parseNovelChapterPlan } from "@/lib/novel-long-pipeline-types";
import { NovelStoryPlanError, reviseNovelStoryPlan } from "@/lib/novel-story-plan";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(req: Request, ctx: RouteContext) {
  const ownerKey = await getOwnerKey();
  if (!ownerKey) return localizedJsonError(req, "unauthorized", 401);

  const { id } = await ctx.params;
  const novel = await prisma.novel.findUnique({ where: { id } });
  if (!novel || novel.ownerKey !== ownerKey) return localizedJsonError(req, "notFound", 404);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return localizedJsonError(req, "badJson", 400);
  }
  const raw = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  const bible = parseNovelBible(raw?.bible);
  const chapterPlan = parseNovelChapterPlan(raw?.chapterPlan);
  if (!bible || !chapterPlan) {
    return NextResponse.json({ errorKey: "invalidStoryPlan" }, { status: 400 });
  }

  try {
    const result = await reviseNovelStoryPlan({ novel, bible, chapterPlan });
    return NextResponse.json({
      storyPlan: { bible: result.meta.bible, chapterPlan: result.meta.chapterPlan },
      core: result.core,
    });
  } catch (error) {
    if (error instanceof NovelStoryPlanError) {
      return NextResponse.json(
        { errorKey: error.code === "generating" ? "storyPlanGenerating" : "storyPlanUnavailable" },
        { status: 409 },
      );
    }
    console.error("[novel-story-plan]", { novelId: id, error });
    return NextResponse.json({ errorKey: "storyPlanSaveFailed" }, { status: 500 });
  }
}
