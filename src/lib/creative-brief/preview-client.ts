import type { AppLocale } from "@/i18n/routing";
import type { BriefInputLocale } from "@/lib/creative-brief/detect-input-locale";
import type { BriefMedium } from "@/lib/creative-brief/types";
import { mergeLocaleHeaders } from "@/lib/i18n/client-headers";
import { apiErrorMessage, clientErrorMessage } from "@/lib/i18n/progress-message";
import {
  CHILDREN_CREATIVE_BRIEF_SCHEMA,
  NOVEL_CREATIVE_BRIEF_SCHEMA,
  type ChildrenCreativeBrief,
  type NovelCreativeBrief,
} from "@/lib/literary-brief";
import { isChildrenGenreTag } from "@/lib/novel-genre-tags";

export type BriefPreviewResult =
  | { ok: true; kind: "children"; brief: ChildrenCreativeBrief; oneLineSummary: string }
  | { ok: true; kind: "novel"; brief: NovelCreativeBrief; oneLineSummary: string }
  | { ok: false; error: string };

/** 创作页：生成前预览文学创意构思（小说 / 漫画） */
export async function fetchCreativeBriefPreview(
  prompt: string,
  medium: BriefMedium,
  options?: {
    skipLlm?: boolean;
    novelGenreId?: string;
    title?: string;
    childrenTargetAge?: number;
    inputLocale?: BriefInputLocale;
    uiLocale?: AppLocale;
  },
): Promise<BriefPreviewResult> {
  const locale = options?.uiLocale ?? "zh-Hans";

  if (medium === "game") {
    return { ok: false, error: clientErrorMessage(locale, "useGameStudio") };
  }

  const trimmed = prompt.trim();
  if (trimmed.length < 2) {
    return { ok: false, error: clientErrorMessage(locale, "needMinPrompt") };
  }

  const res = await fetch("/api/creative-brief/expand", {
    method: "POST",
    headers: mergeLocaleHeaders(locale, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      prompt: trimmed,
      medium,
      skipLlm: options?.skipLlm,
      novelGenreId: options?.novelGenreId,
      title: options?.title,
      childrenTargetAge: options?.childrenTargetAge,
      inputLocale: options?.inputLocale,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    brief?: unknown;
    briefKind?: "children" | "novel";
    oneLineSummary?: string;
  };
  if (!res.ok) {
    return { ok: false, error: data.error ?? clientErrorMessage(locale, "expandPreviewFailed") };
  }

  if (data.briefKind === "children" || isChildrenGenreTag(options?.novelGenreId)) {
    const parsed = CHILDREN_CREATIVE_BRIEF_SCHEMA.safeParse(data.brief);
    if (!parsed.success) {
      return { ok: false, error: apiErrorMessage(locale, "expandChildrenInvalid") };
    }
    return {
      ok: true,
      kind: "children",
      brief: parsed.data,
      oneLineSummary: data.oneLineSummary ?? parsed.data.storyBeats[0] ?? "",
    };
  }

  const parsed = NOVEL_CREATIVE_BRIEF_SCHEMA.safeParse(data.brief);
  if (!parsed.success) {
    return { ok: false, error: apiErrorMessage(locale, "expandInvalid") };
  }
  return {
    ok: true,
    kind: "novel",
    brief: parsed.data,
    oneLineSummary: data.oneLineSummary ?? parsed.data.logline,
  };
}
