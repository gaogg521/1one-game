import type { AppLocale } from "@/i18n/routing";

export function comicStoryboardQualityWarning(
  storyboardSource: "llm" | "emergency" | string | null | undefined,
  uiLocale: AppLocale = "zh-Hans",
): string | undefined {
  if (storyboardSource !== "emergency") return undefined;
  if (uiLocale === "zh-Hant") {
    return "分鏡模型多次失敗，已先生成保底靜態分鏡；建議稍後重新生成以獲得更高品質。";
  }
  if (uiLocale === "en") {
    return "Storyboard generation fell back to a static emergency draft. Regenerate later for better quality.";
  }
  return "分镜模型多次失败，已先生成保底静态分镜；建议稍后重新生成以获得更高质量。";
}

export function comicPanelResumeHint(params: {
  withImage: number;
  total: number;
  uiLocale?: AppLocale;
}): string | undefined {
  const remaining = Math.max(0, params.total - params.withImage);
  if (remaining <= 0) return undefined;
  const uiLocale = params.uiLocale ?? "zh-Hans";
  if (uiLocale === "zh-Hant") {
    return `還有 ${remaining} 格未完成，可繼續補圖；長篇配圖會分批保存進度。`;
  }
  if (uiLocale === "en") {
    return `${remaining} panels remain. Continue rendering; long comics save progress in batches.`;
  }
  return `还有 ${remaining} 格未完成，可继续补图；长篇配图会分批保存进度。`;
}
