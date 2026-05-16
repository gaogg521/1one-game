/** 小说篇幅档位：短篇 / 中篇 / 长篇 */
export type NovelLengthTier = "short" | "medium" | "long";

export const NOVEL_LENGTH_TIERS: {
  id: NovelLengthTier;
  label: string;
  desc: string;
  minChars: number;
  maxChars: number;
}[] = [
  { id: "short", label: "短篇", desc: "约 300–2,000 字", minChars: 300, maxChars: 2000 },
  { id: "medium", label: "中篇", desc: "约 2,000–10,000 字", minChars: 2000, maxChars: 10000 },
  { id: "long", label: "长篇", desc: "约 10,000–100,000 字", minChars: 10000, maxChars: 100000 },
];

export function parseNovelLengthTier(raw: unknown): NovelLengthTier {
  if (raw === "short" || raw === "medium" || raw === "long") return raw;
  return "medium";
}

export function novelLengthConfig(tier: NovelLengthTier) {
  const row = NOVEL_LENGTH_TIERS.find((t) => t.id === tier) ?? NOVEL_LENGTH_TIERS[1];
  const chapterHint =
    tier === "short"
      ? "2–4 章，每章 80–600 字"
      : tier === "medium"
        ? "4–10 章，每章 400–1200 字"
        : "10–40 章，每章 800–3000 字（可分多段输出）";
  return { ...row, chapterHint };
}
