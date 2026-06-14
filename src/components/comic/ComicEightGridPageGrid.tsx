"use client";

import { ComicPanelCard } from "@/components/comic/ComicPanelCard";
import type { ComicPage, ComicPanel } from "@/lib/comic-format";
import type { ComicStylePresetId } from "@/lib/comic-style-presets";

const PANEL_COUNT = 8;

function emptyPanel(): ComicPanel {
  return { caption: "", prompt: "" };
}

export function ComicEightGridPageGrid({
  page,
  rendering,
  stylePreset,
  canRemovePanel,
  onRemovePanel,
  removeBusy,
}: {
  page: ComicPage;
  rendering?: boolean;
  stylePreset?: ComicStylePresetId;
  canRemovePanel?: boolean;
  onRemovePanel?: (panelIndex: number) => void;
  removeBusy?: boolean;
}) {
  const panels = page.panels.slice(0, PANEL_COUNT);
  while (panels.length < PANEL_COUNT) panels.push(emptyPanel());
  const removable = Boolean(canRemovePanel && onRemovePanel && page.panels.length > 1);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      {panels.map((panel, idx) => (
        <ComicPanelCard
          key={idx}
          panel={panel}
          pageNum={page.page}
          idx={idx}
          aspectClass="aspect-[4/5]"
          rendering={rendering}
          stylePreset={stylePreset}
          canRemove={removable}
          onRemove={removable ? () => onRemovePanel!(idx) : undefined}
          removeBusy={removeBusy}
        />
      ))}
    </div>
  );
}
