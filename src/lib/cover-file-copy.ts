import fs from "node:fs/promises";
import path from "node:path";
import type { AppLocale } from "@/i18n/routing";
import { tMessage } from "@/lib/i18n/messages";
import { coverAbsPathFromPublicRel } from "@/lib/project-cover";

/** 复制 public/covers 下已有文件到新相对路径。 */
export async function copyPublicCoverRel(srcRel: string, destRel: string): Promise<boolean> {
  if (!srcRel.startsWith("/covers/") || !destRel.startsWith("/covers/")) return false;
  try {
    const srcAbs = coverAbsPathFromPublicRel(srcRel);
    const destAbs = coverAbsPathFromPublicRel(destRel);
    await fs.mkdir(path.dirname(destAbs), { recursive: true });
    await fs.copyFile(srcAbs, destAbs);
    return true;
  } catch {
    return false;
  }
}

export function duplicateTitle(base: string, locale: AppLocale = "zh-Hans", maxLen = 80): string {
  const suffix = tMessage(locale, "studioErrors.duplicateCopySuffix");
  if (base.length + suffix.length <= maxLen) return `${base}${suffix}`;
  const ellipsis = locale === "zh-Hans" || locale === "zh-Hant" ? "…" : "...";
  return `${base.slice(0, maxLen - suffix.length - ellipsis.length)}${ellipsis}${suffix}`;
}
