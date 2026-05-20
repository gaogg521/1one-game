import { formatCreativeBriefForComic } from "@/lib/creative-brief/format-comic";
import { formatCreativeBriefForNovel } from "@/lib/creative-brief/format-novel";
import { formatCreativeBriefForGameSpec } from "@/lib/creative-brief/format-prompt";
import type { BriefMedium, CreativeBrief } from "@/lib/creative-brief/types";

export type BriefUserRevision = {
  logline?: string;
  world?: string;
  addonNotes?: string;
};

/** 用户修订合并进 Brief（用于再生成） */
export function mergeBriefRevision(brief: CreativeBrief, rev: BriefUserRevision): CreativeBrief {
  return {
    ...brief,
    logline: rev.logline?.trim() || brief.logline,
    world: rev.world?.trim() || brief.world,
  };
}

export function formatRevisionBlock(rev: BriefUserRevision): string {
  const lines: string[] = ["【用户修订的创意理解】"];
  if (rev.logline?.trim()) lines.push(`- Logline（修订）：${rev.logline.trim()}`);
  if (rev.world?.trim()) lines.push(`- 世界观（修订）：${rev.world.trim()}`);
  if (rev.addonNotes?.trim()) lines.push(`- 补充说明：${rev.addonNotes.trim()}`);
  return lines.join("\n");
}

function formatBriefBlockForMedium(brief: CreativeBrief, medium: BriefMedium): string {
  switch (medium) {
    case "novel":
      return formatCreativeBriefForNovel(brief);
    case "comic":
      return formatCreativeBriefForComic(brief);
    default:
      return formatCreativeBriefForGameSpec(brief);
  }
}

export function buildPromptWithBriefRevision(
  userPrompt: string,
  brief: CreativeBrief,
  rev?: BriefUserRevision | null,
  medium: BriefMedium = "game",
): string {
  const merged = rev ? mergeBriefRevision(brief, rev) : brief;
  const block = formatBriefBlockForMedium(merged, medium);
  const revBlock = rev ? formatRevisionBlock(rev) : "";
  const parts = [userPrompt.trim(), "---", block];
  if (revBlock) parts.push(revBlock);
  return parts.join("\n\n").slice(0, 4000);
}

export function buildPipelinePromptFromBrief(
  userPrompt: string,
  brief: CreativeBrief,
  medium: BriefMedium,
  rev?: BriefUserRevision | null,
): string {
  return buildPromptWithBriefRevision(userPrompt, brief, rev, medium);
}
