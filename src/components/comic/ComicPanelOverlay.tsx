"use client";

import type { ComicPanel } from "@/lib/comic-format";
import { inferPanelTextType } from "@/lib/comic-panel-text";
import {
  getComicStylePreset,
  type ComicStylePresetId,
} from "@/lib/comic-style-presets";

type Props = {
  panel: ComicPanel;
  stylePreset?: ComicStylePresetId;
  hasImage?: boolean;
};

export function ComicPanelOverlay({ panel, stylePreset, hasImage = true }: Props) {
  const caption = panel.caption?.trim();
  if (!caption) return null;

  const textType = inferPanelTextType(panel);
  const fontClass = stylePreset
    ? getComicStylePreset(stylePreset).captionFontClass
    : "font-sans";

  const baseText = hasImage
    ? "text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
    : "text-[var(--gc-text-soft)]";

  if (textType === "dialogue") {
    const speaker = panel.speaker?.trim();
    return (
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-end p-2">
        <div
          className={`max-w-[92%] self-center rounded-2xl border-2 border-black/80 bg-white px-3 py-2 shadow-md ${fontClass}`}
        >
          {speaker ? (
            <p className="mb-0.5 text-[10px] font-bold text-neutral-700">{speaker}</p>
          ) : null}
          <p className="text-sm font-semibold leading-snug text-neutral-900">{caption}</p>
        </div>
      </div>
    );
  }

  if (textType === "inner") {
    return (
      <div className="pointer-events-none absolute inset-0 p-2">
        <div
          className={`max-w-[85%] rounded-xl border border-dashed border-white/70 bg-black/45 px-2.5 py-1.5 ${fontClass}`}
        >
          <p className={`text-xs italic leading-snug ${baseText}`}>{caption}</p>
        </div>
      </div>
    );
  }

  if (textType === "time_place" || textType === "scene_note") {
    return (
      <div className="pointer-events-none absolute left-2 top-2 max-w-[90%]">
        <p
          className={`rounded bg-black/55 px-2 py-0.5 text-[10px] leading-snug ${baseText} ${fontClass}`}
        >
          {caption}
        </p>
      </div>
    );
  }

  /* narration — 老式小人书页脚旁白 */
  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-0 px-2 pb-1.5 pt-6 ${
        hasImage ? "bg-gradient-to-t from-amber-950/92 via-amber-950/50 to-transparent" : "bg-amber-950/75"
      }`}
    >
      <p
        className={`text-center text-xs leading-relaxed tracking-wide ${baseText} ${fontClass} ${
          hasImage ? "" : ""
        }`}
      >
        {caption}
      </p>
    </div>
  );
}
