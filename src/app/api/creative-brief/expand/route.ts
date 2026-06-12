import { NextResponse } from "next/server";
import { detectBriefInputLocale, type BriefInputLocale } from "@/lib/creative-brief/detect-input-locale";
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
import { localizedJsonError, apiErrorFromUnknown } from "@/lib/api/localized-error";

export async function POST(req: Request) {
  const ownerKey = await getOwnerKey();
  if (!ownerKey) {
    return localizedJsonError(req, "unauthorized", 401);
  }

  const throttleKey = await getThrottleKey("brief_expand", ownerKey);
  if (!rateLimit(throttleKey, 30, 60_000)) {
    return localizedJsonError(req, "rateLimited", 429);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return localizedJsonError(req, "badJson", 400);
  }

  const prompt =
    typeof body === "object" && body !== null && "prompt" in body
      ? String((body as { prompt?: unknown }).prompt ?? "").trim()
      : "";
  if (prompt.length < 1) {
    return localizedJsonError(req, "missingPrompt", 400);
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
  const inputLocaleRaw =
    typeof body === "object" && body !== null && "inputLocale" in body
      ? String((body as { inputLocale?: unknown }).inputLocale ?? "").trim()
      : "";
  const inputLocale: BriefInputLocale | undefined =
    inputLocaleRaw === "zh" ||
    inputLocaleRaw === "zh-Hant" ||
    inputLocaleRaw === "en" ||
    inputLocaleRaw === "ja" ||
    inputLocaleRaw === "ms" ||
    inputLocaleRaw === "th"
      ? inputLocaleRaw
      : undefined;

  try {
    if (medium === "novel" || medium === "comic") {
      if (medium === "novel" && !PRODUCT.novel.creativeBriefExpand) {
        return localizedJsonError(req, "expandNovelDisabled", 503);
      }
      if (medium === "comic" && !PRODUCT.comic.creativeBriefExpand) {
        return localizedJsonError(req, "expandComicDisabled", 503);
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
          return localizedJsonError(req, "expandChildrenInvalid", 500);
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
        inputLocale: inputLocale ?? detectBriefInputLocale(prompt),
        skipLlm,
      });
      const checked = NOVEL_CREATIVE_BRIEF_SCHEMA.safeParse(result.brief);
      if (!checked.success) {
        return localizedJsonError(req, "expandInvalid", 500);
      }
      return NextResponse.json({
        briefKind: "novel",
        brief: checked.data,
        oneLineSummary: result.oneLineSummary,
        augmentedPrompt: result.augmentedPrompt,
      });
    }

    if (!PRODUCT.game.creativeBriefExpand) {
      return localizedJsonError(req, "expandGameDisabled", 503);
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
      return localizedJsonError(req, "expandInvalid", 500);
    }
    return NextResponse.json({
      brief: checked.data,
      oneLineSummary: result.oneLineSummary,
      augmentedPrompt: result.augmentedPrompt,
    });
  } catch (e) {
    return NextResponse.json({ error: apiErrorFromUnknown(req, e, "expandFailed") }, { status: 500 });
  }
}
