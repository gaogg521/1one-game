import type { BriefMedium } from "@/lib/creative-brief/types";

export const BRIEF_MARKERS: Record<BriefMedium, string> = {
  game: "【AI 深度扩写 · Creative Brief】",
  novel: "【AI 深度扩写 · 小说 Creative Brief】",
  comic: "【AI 深度扩写 · 漫画改编 Brief】",
};

export function promptHasCreativeBriefBlock(prompt: string, medium?: BriefMedium): boolean {
  const p = prompt.trim();
  if (!p) return false;
  if (medium) return p.includes(BRIEF_MARKERS[medium]);
  return Object.values(BRIEF_MARKERS).some((m) => p.includes(m));
}
