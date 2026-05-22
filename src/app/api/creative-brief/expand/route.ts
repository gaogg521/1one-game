import { NextResponse } from "next/server";
import { expandCreativeBrief } from "@/lib/creative-brief/expand-brief";
import { CREATIVE_BRIEF_SCHEMA } from "@/lib/creative-brief/types";
import type { GameSpec } from "@/lib/game-spec";
import {
  expandChildrenCreativeBrief,
  expandNovelCreativeBrief,
  CHILDREN_CREATIVE_BRIEF_SCHEMA,
  NOVEL_CREATIVE_BRIEF_SCHEMA,
  isChildrenBriefExpandRequest,
} from "@/lib/literary-brief";
import { getOwnerKey } from "@/lib/owner";
import { rateLimit } from "@/lib/rate-limit";
import { getThrottleKey } from "@/lib/request-key";
import { PRODUCT } from "@/lib/product-config";

export async function POST(req: Request) {
  const ownerKey = await getOwnerKey();
  if (!ownerKey) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const throttleKey = await getThrottleKey("brief_expand", ownerKey);
  if (!rateLimit(throttleKey, 30, 60_000)) {
    return NextResponse.json({ error: "请求过于频繁" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "无效的 JSON" }, { status: 400 });
  }

  const prompt =
    typeof body === "object" && body !== null && "prompt" in body
      ? String((body as { prompt?: unknown }).prompt ?? "").trim()
      : "";
  if (prompt.length < 1) {
    return NextResponse.json({ error: "缺少 prompt" }, { status: 400 });
  }

  const mediumRaw =
    typeof body === "object" && body !== null && "medium" in body
      ? String((body as { medium?: unknown }).medium ?? "game")
      : "game";
  const medium =
    mediumRaw === "novel" || mediumRaw === "comic" || mediumRaw === "game" ? mediumRaw : "game";
  const skipLlm =
    typeof body === "object" && body !== null && "skipLlm" in body
      ? Boolean((body as { skipLlm?: unknown }).skipLlm)
      : false;
  const referenceSnippet =
    typeof body === "object" && body !== null && "referenceSnippet" in body
      ? String((body as { referenceSnippet?: unknown }).referenceSnippet ?? "").trim()
      : undefined;
  const novelGenreId =
    typeof body === "object" && body !== null && "novelGenreId" in body
      ? String((body as { novelGenreId?: unknown }).novelGenreId ?? "").trim() || undefined
      : undefined;
  const title =
    typeof body === "object" && body !== null && "title" in body
      ? String((body as { title?: unknown }).title ?? "").trim() || undefined
      : undefined;
  const childrenTargetAge =
    typeof body === "object" && body !== null && "childrenTargetAge" in body
      ? Number((body as { childrenTargetAge?: unknown }).childrenTargetAge)
      : undefined;

  try {
    if (medium === "novel" || medium === "comic") {
      if (medium === "novel" && !PRODUCT.novel.creativeBriefExpand) {
        return NextResponse.json({ error: "小说构思扩写未启用" }, { status: 503 });
      }
      if (medium === "comic" && !PRODUCT.comic.creativeBriefExpand) {
        return NextResponse.json({ error: "漫画构思扩写未启用" }, { status: 503 });
      }
      if (isChildrenBriefExpandRequest(novelGenreId)) {
        const result = await expandChildrenCreativeBrief({
          prompt,
          title,
          skipLlm,
          childrenTargetAge: Number.isFinite(childrenTargetAge) ? childrenTargetAge : undefined,
        });
        const checked = CHILDREN_CREATIVE_BRIEF_SCHEMA.safeParse(result.brief);
        if (!checked.success) {
          return NextResponse.json({ error: "儿童构思扩写结果无效" }, { status: 500 });
        }
        return NextResponse.json({
          briefKind: "children",
          brief: checked.data,
          oneLineSummary: result.oneLineSummary,
          augmentedPrompt: result.augmentedPrompt,
        });
      }

      const result = await expandNovelCreativeBrief({
        prompt,
        title,
        genreId: novelGenreId,
        skipLlm,
      });
      const checked = NOVEL_CREATIVE_BRIEF_SCHEMA.safeParse(result.brief);
      if (!checked.success) {
        return NextResponse.json({ error: "扩写结果无效" }, { status: 500 });
      }
      return NextResponse.json({
        briefKind: "novel",
        brief: checked.data,
        oneLineSummary: result.oneLineSummary,
        augmentedPrompt: result.augmentedPrompt,
      });
    }

    if (!PRODUCT.game.creativeBriefExpand) {
      return NextResponse.json({ error: "游戏 Brief 扩写未启用" }, { status: 503 });
    }

    const templateHint =
      typeof body === "object" && body !== null && "templateHint" in body
        ? ((body as { templateHint?: unknown }).templateHint as GameSpec["templateId"] | "auto" | undefined)
        : "auto";

    const result = await expandCreativeBrief({
      prompt,
      templateHint: templateHint ?? "auto",
      skipLlm,
      referenceSnippet: referenceSnippet || undefined,
      medium: "game",
    });
    const checked = CREATIVE_BRIEF_SCHEMA.safeParse(result.brief);
    if (!checked.success) {
      return NextResponse.json({ error: "扩写结果无效" }, { status: 500 });
    }
    return NextResponse.json({
      brief: checked.data,
      oneLineSummary: result.oneLineSummary,
      augmentedPrompt: result.augmentedPrompt,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "扩写失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
