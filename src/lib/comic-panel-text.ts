import type { ComicPanel } from "@/lib/comic-format";
import type { ComicShotType } from "@/lib/comic-director-types";

export type ComicPanelTextType =
  | "dialogue"
  | "narration"
  | "inner"
  | "scene_note"
  | "time_place";

const TEXT_TYPES = new Set<ComicPanelTextType>([
  "dialogue",
  "narration",
  "inner",
  "scene_note",
  "time_place",
]);

const SHOT_TYPES = new Set<ComicShotType>([
  "wide",
  "medium",
  "close",
  "over_shoulder",
  "extreme_close",
]);

export function parseComicPanelTextType(raw: unknown): ComicPanelTextType {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (TEXT_TYPES.has(s as ComicPanelTextType)) return s as ComicPanelTextType;
  return "narration";
}

export function parseComicPanelShotType(raw: unknown): ComicShotType {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (SHOT_TYPES.has(s as ComicShotType)) return s as ComicShotType;
  return "medium";
}

/** 从 caption 启发式推断文字类型（兼容旧数据） */
export function inferPanelTextType(panel: Pick<ComicPanel, "caption" | "textType" | "speaker">): ComicPanelTextType {
  if (panel.textType && TEXT_TYPES.has(panel.textType)) return panel.textType;
  const cap = panel.caption?.trim() ?? "";
  if (/^（.+）$|^【.+】$/.test(cap)) return "inner";
  if (/^\d{1,4}年|^[一二三四五六七八九十]+、|^(清晨|午后|深夜|翌日)/.test(cap)) return "time_place";
  if (panel.speaker?.trim() || /^[\u4e00-\u9fa5A-Za-z0-9]{1,8}[：:]/.test(cap)) return "dialogue";
  if (cap.length > 0 && cap.length <= 18 && !/[。！？]$/.test(cap)) return "dialogue";
  return "narration";
}

export function normalizePanelTextFields(
  pan: Partial<ComicPanel> & { caption?: string; prompt?: string },
): Pick<
  ComicPanel,
  "caption" | "textType" | "speaker" | "shotType" | "sourceSegmentIndex"
> {
  let caption = String(pan.caption ?? "").trim().slice(0, 120);
  let speaker = typeof pan.speaker === "string" ? pan.speaker.trim().slice(0, 24) : undefined;
  const textType = parseComicPanelTextType(pan.textType);
  const shotType = parseComicPanelShotType(pan.shotType);

  const colon = caption.match(/^([\u4e00-\u9fa5A-Za-z0-9·]{1,10})[：:](.+)$/);
  if (colon && textType === "dialogue") {
    speaker = speaker || colon[1]!.trim();
    caption = colon[2]!.trim();
  }

  const sourceSegmentIndex =
    typeof pan.sourceSegmentIndex === "number" && pan.sourceSegmentIndex >= 0
      ? Math.floor(pan.sourceSegmentIndex)
      : undefined;

  return {
    caption: caption || "……",
    textType,
    ...(speaker ? { speaker } : {}),
    shotType,
    ...(sourceSegmentIndex !== undefined ? { sourceSegmentIndex } : {}),
  };
}
