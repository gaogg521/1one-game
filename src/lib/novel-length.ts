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

/** 创作页提示：预计耗时与保持页面打开说明。 */
export function novelGenerationEtaHint(tier: NovelLengthTier): string {
  if (tier === "short") return "短篇约 1–3 分钟";
  if (tier === "long") return "长篇分段续写约 1–3 小时（约 8 万字级），请勿关闭页面";
  return "中篇约 5–15 分钟";
}

export function novelStreamInterruptHint(tier: NovelLengthTier): string {
  const eta = novelGenerationEtaHint(tier);
  return `生成连接中断（多为网关或代理超时）。${eta}，请保持页面打开后重试；若反复失败请联系管理员检查 LLM 网关超时设置。`;
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
