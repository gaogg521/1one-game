import fs from "node:fs/promises";
import path from "node:path";
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

export function duplicateTitle(base: string, maxLen = 80): string {
  const suffix = "（副本）";
  if (base.length + suffix.length <= maxLen) return `${base}${suffix}`;
  return `${base.slice(0, maxLen - suffix.length - 1)}…${suffix}`;
}
