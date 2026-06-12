/** 样品馆系统账号 — 预置公开试玩项目归属，访客可 Remix 克隆到自己的会话库。 */
export const SAMPLE_GALLERY_OWNER = "__sample-gallery__";

export function sampleProjectId(sampleId: string): string {
  return `sample-${sampleId}`;
}

export function isSampleGalleryProject(projectId: string): boolean {
  return projectId.startsWith("sample-");
}

/** 将展示用播放量（如 6.2M）转为整数。 */
export function parseSamplePlaysLabel(label: string): number {
  const m = label.trim().match(/^(\d+(?:\.\d+)?)\s*([KMB])?$/i);
  if (!m) return 1000;
  const n = parseFloat(m[1]);
  const suffix = m[2]?.toUpperCase();
  const mult = suffix === "M" ? 1_000_000 : suffix === "K" ? 1000 : suffix === "B" ? 1_000_000_000 : 1;
  return Math.max(1, Math.round(n * mult));
}

export function sampleShareCode(sampleId: string): string {
  return `sg-${sampleId.replace(/[^a-z0-9]+/gi, "").slice(0, 18)}`;
}
