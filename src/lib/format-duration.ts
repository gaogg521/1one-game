import type { AppLocale } from "@/i18n/routing";
import { formatDurationMessage } from "@/lib/i18n/chapter-labels";

/** 将毫秒格式化为耗时（用于 SSE / UI） */
export function formatImageGenElapsed(ms: number, uiLocale: AppLocale = "zh-Hans"): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  if (sec < 60) return formatDurationMessage(uiLocale, "secOnly", { sec });
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return rem > 0
    ? formatDurationMessage(uiLocale, "minSec", { min, sec: rem })
    : formatDurationMessage(uiLocale, "minOnly", { min });
}
