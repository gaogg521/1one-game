"use client";

import { useTranslations } from "next-intl";
import { ComicPanelOverlay } from "@/components/comic/ComicPanelOverlay";
import type { ComicPanel } from "@/lib/comic-format";
import { inferPanelTextType } from "@/lib/comic-panel-text";
import type { ComicStylePresetId } from "@/lib/comic-style-presets";

type Props = {
  panel: ComicPanel;
  pageNum: number;
  idx: number;
  aspectClass: string;
  rendering?: boolean;
  stylePreset?: ComicStylePresetId;
  shellClassName?: string;
  imageClassName?: string;
};

function shouldRenderOverlay(textType: ReturnType<typeof inferPanelTextType>) {
  return textType !== "narration";
}

function shouldRenderBelowText(textType: ReturnType<typeof inferPanelTextType>) {
  return textType === "narration";
}

export function ComicPanelCard({
  panel,
  pageNum,
  idx,
  aspectClass,
  rendering,
  stylePreset,
  shellClassName,
  imageClassName,
}: Props) {
  const t = useTranslations("comicPanelCard");
  const hasImage = Boolean(panel.imageUrl?.trim());
  const caption = panel.caption?.trim() ?? "";
  const textType = inferPanelTextType(panel);
  const showOverlay = hasImage && caption && shouldRenderOverlay(textType);
  const showBelowText = caption && shouldRenderBelowText(textType);

  return (
    <article
      className={`${shellClassName ?? "overflow-hidden rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)]"} ${aspectClass}`.trim()}
    >
      <div className={`relative h-full w-full overflow-hidden bg-[var(--gc-bg-elevated)] ${showBelowText ? "" : "min-h-[9rem]"}`}>
        {hasImage ? (
          <img
            src={panel.imageUrl}
            alt={caption || t("altFallback", { page: pageNum, index: idx + 1 })}
            className={imageClassName ?? "h-full w-full object-cover"}
            loading="lazy"
          />
        ) : (
          <div className="flex h-full min-h-[4.5rem] flex-col items-center justify-center gap-2 p-3 text-center">
            <span className="text-[10px] uppercase tracking-wider text-[var(--gc-muted)]">
              {rendering ? t("rendering") : t("pendingImage")}
            </span>
            {caption ? (
              <p className="line-clamp-4 text-xs leading-relaxed text-[var(--gc-text-soft)]">
                {caption}
              </p>
            ) : null}
          </div>
        )}
        {showOverlay ? (
          <ComicPanelOverlay panel={panel} stylePreset={stylePreset} hasImage={hasImage} />
        ) : null}
      </div>
      {showBelowText ? (
        <div className="border-t border-[color:color-mix(in_srgb,var(--gc-border)_70%,transparent)] px-3 py-2.5 sm:px-4 sm:py-3">
          {panel.speaker?.trim() ? (
            <p className="mb-1 text-xs font-semibold text-[var(--gc-accent)]">{panel.speaker}</p>
          ) : null}
          <p className="text-xs leading-relaxed text-[var(--gc-text-soft)] sm:text-sm">{caption}</p>
        </div>
      ) : null}
    </article>
  );
}
