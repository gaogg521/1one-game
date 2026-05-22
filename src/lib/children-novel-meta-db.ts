import { prisma } from "@/lib/prisma";
import {
  childrenMaxCharsForAge,
  parseChildrenTargetAge,
  type ChildrenTargetAge,
} from "@/lib/children-age-length";

export type ChildrenNovelMeta = {
  kind: "children";
  targetAge: ChildrenTargetAge;
  maxChars: number;
  /** 成稿【创意/典故深度解读】 */
  sourceInterpretation?: string;
  /** 成稿【家长共读】一句（≤20 字） */
  parentReadingTip?: string;
  /** 成稿【故事标题】（≤12 字） */
  storyTitle?: string;
};

export function serializeChildrenNovelMeta(meta: ChildrenNovelMeta): string {
  return JSON.stringify(meta);
}

export function parseChildrenNovelMeta(raw: string | null | undefined): ChildrenNovelMeta | null {
  if (!raw?.trim()) return null;
  try {
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object") return null;
    const o = j as Record<string, unknown>;
    if (o.kind === "children" && o.targetAge !== undefined) {
      const targetAge = parseChildrenTargetAge(o.targetAge);
      return {
        kind: "children",
        targetAge,
        maxChars:
          typeof o.maxChars === "number" && o.maxChars > 0
            ? Math.floor(o.maxChars)
            : childrenMaxCharsForAge(targetAge),
        ...(typeof o.sourceInterpretation === "string" && o.sourceInterpretation.trim()
          ? { sourceInterpretation: o.sourceInterpretation.trim().slice(0, 220) }
          : {}),
        ...(typeof o.parentReadingTip === "string" && o.parentReadingTip.trim()
          ? { parentReadingTip: o.parentReadingTip.trim() }
          : {}),
        ...(typeof o.storyTitle === "string" && o.storyTitle.trim()
          ? { storyTitle: o.storyTitle.trim() }
          : {}),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function persistChildrenNovelMeta(
  novelId: string,
  meta: ChildrenNovelMeta,
): Promise<void> {
  const json = serializeChildrenNovelMeta(meta);
  try {
    await prisma.$executeRaw`UPDATE "Novel" SET "generationMetaJson" = ${json} WHERE "id" = ${novelId}`;
  } catch {
    /* 列或 Client 未同步时忽略 */
  }
}

export async function loadChildrenNovelMeta(novelId: string): Promise<ChildrenNovelMeta | null> {
  try {
    const rows = await prisma.$queryRaw<Array<{ generationMetaJson: string | null }>>`
      SELECT "generationMetaJson" FROM "Novel" WHERE "id" = ${novelId}
    `;
    return parseChildrenNovelMeta(rows[0]?.generationMetaJson);
  } catch {
    return null;
  }
}
