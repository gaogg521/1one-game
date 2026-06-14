/** 小说封面在 UI 中的最大展示高度（px） */
export const NOVEL_COVER_MAX_HEIGHT_PX = 350;

/** 漫画封面在 UI 中的最大展示高度（px） */
export const COMIC_COVER_MAX_HEIGHT_PX = 400;

/** 创作页等单张预览：固定高度 + 3:4 比例 */
export const novelCoverPreviewFrameClass =
  "relative mx-auto w-full max-w-[262px] overflow-hidden rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-bg-elevated)] shadow-lg ring-1 ring-[color:color-mix(in_srgb,var(--gc-accent)_15%,transparent)]";

export const novelCoverPreviewHeightClass = "h-[350px]";

/** 列表/发现页小说卡片封面容器 */
export const novelCoverCardFrameClass =
  "relative w-full max-h-[350px] aspect-[3/4] overflow-hidden bg-[var(--gc-bg-elevated)]";

/** 列表/发现页漫画卡片封面容器 */
export const comicCoverCardFrameClass =
  "relative w-full max-h-[400px] aspect-[2/3] overflow-hidden bg-[var(--gc-bg-elevated)]";

/** 漫画详情页单张封面（约 400px 高） */
export const comicCoverDetailFrameClass =
  "relative mx-auto w-full max-w-[267px] max-h-[400px] aspect-[2/3] overflow-hidden bg-[var(--gc-bg-elevated)]";

/** 首页精选漫画（横版缩略） */
export const comicCoverFeaturedFrameClass =
  "relative w-full max-h-[400px] aspect-[4/3] overflow-hidden bg-[var(--gc-bg-elevated)]";

export type StudioCoverWorkType = "project" | "novel" | "comic";

/** 工作室卡片封面容器：游戏 16:9，小说/漫画用统一 max-height */
export function studioWorkCoverLinkClass(type: StudioCoverWorkType): string {
  if (type === "novel") return `block ${novelCoverCardFrameClass}`;
  if (type === "comic") return `block ${comicCoverCardFrameClass}`;
  return "relative block aspect-video w-full overflow-hidden bg-[var(--gc-bg-elevated)]";
}
