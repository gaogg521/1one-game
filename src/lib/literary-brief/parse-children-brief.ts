import { DEFAULT_CHILDREN_TARGET_AGE, parseChildrenTargetAge } from "@/lib/children-age-length";
import {
  resolveChildrenInputKind,
  resolveChildrenNarrativeMode,
} from "@/lib/children-source-fidelity";
import {
  CHILDREN_CREATIVE_BRIEF_SCHEMA,
  type ChildrenCreativeBrief,
} from "@/lib/literary-brief/children-brief-types";
import {
  NOVEL_CREATIVE_BRIEF_SCHEMA,
  type NovelCreativeBrief,
} from "@/lib/literary-brief/novel-types";

/** 旧版网文形态儿童 brief → 儿童独立 brief（只读兼容） */
export function novelBriefToChildrenBrief(novel: NovelCreativeBrief): ChildrenCreativeBrief | null {
  if (novel.genreId !== "children") return null;

  const hints = novel.narrativeHints;
  const interpretation =
    hints
      .find((h) => h.includes("创意解读") || h.includes("深度解读"))
      ?.replace(/^【[^】]+】/, "")
      .trim() ||
    novel.logline;

  const moral =
    hints.find((h) => h.startsWith("结尾寓意："))?.replace("结尾寓意：", "").trim() ||
    hints.find((h) => h.startsWith("家长初衷："))?.replace("家长初衷：", "").trim() ||
    "";

  const inputKind =
    hints.find((h) => h.startsWith("输入归类："))?.replace("输入归类：", "").trim() ||
    "mixed";

  const cast = [novel.protagonist, ...novel.characters].filter(Boolean).join("和");

  return CHILDREN_CREATIVE_BRIEF_SCHEMA.parse({
    kind: "children",
    version: 1,
    userPrompt: novel.userPrompt,
    title: novel.title,
    genreLabel: novel.genreLabel || "儿童短篇",
    targetAge: DEFAULT_CHILDREN_TARGET_AGE,
    inputKind,
    interpretation,
    cast,
    storyBeats: novel.plotBeats.length ? novel.plotBeats.slice(0, 3) : [novel.logline],
    scene: novel.setting || novel.keyScenes[0] || "",
    moral: moral || "温柔探索，遇到困难问大人",
    avoid: novel.negatives.slice(0, 8),
    expandSource: novel.expandSource === "pack" ? "seed" : "seed+llm",
    narrativeMode: resolveChildrenNarrativeMode(
      novel.userPrompt,
      resolveChildrenInputKind(novel.userPrompt, inputKind),
      DEFAULT_CHILDREN_TARGET_AGE,
    ),
  });
}

function enrichChildrenBrief(brief: ChildrenCreativeBrief): ChildrenCreativeBrief {
  const inputKind = resolveChildrenInputKind(brief.userPrompt, brief.inputKind);
  return {
    ...brief,
    inputKind,
    narrativeMode: resolveChildrenNarrativeMode(
      brief.userPrompt,
      inputKind,
      brief.targetAge,
      brief.narrativeMode,
    ),
  };
}

export function parseChildrenCreativeBrief(raw: unknown): ChildrenCreativeBrief | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.kind === "children") {
    const direct = CHILDREN_CREATIVE_BRIEF_SCHEMA.safeParse(raw);
    if (direct.success) {
      return enrichChildrenBrief({
        ...direct.data,
        targetAge: parseChildrenTargetAge(direct.data.targetAge),
      });
    }
    return null;
  }
  const novel = NOVEL_CREATIVE_BRIEF_SCHEMA.safeParse(raw);
  if (novel.success) return novelBriefToChildrenBrief(novel.data);
  return null;
}

export function isChildrenCreativeBrief(raw: unknown): raw is ChildrenCreativeBrief {
  return parseChildrenCreativeBrief(raw) !== null;
}
