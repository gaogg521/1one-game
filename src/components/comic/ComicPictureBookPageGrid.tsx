"use client";

import { ComicPanelCard } from "@/components/comic/ComicPanelCard";
import type { ComicPage, ComicPanel } from "@/lib/comic-format";
import type { ComicStylePresetId } from "@/lib/comic-style-presets";

const PANEL_COUNT = 5;

function emptyPanel(): ComicPanel {
  return { caption: "", prompt: "" };
}

function panelShellClass(isPictureBook: boolean): string {
  const base =
    "relative overflow-hidden bg-[var(--gc-bg-elevated)]";
  if (isPictureBook) {
    return `${base} rounded-2xl border-[3px] border-amber-900/75 shadow-sm`;
  }
  return `${base} rounded-lg border border-[color:var(--gc-border)]`;
}

/** 儿童小人书五格：上排左小右大 → 中通栏 → 下排左右各半 */
export function ComicPictureBookPageGrid({
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
  const isPictureBook = stylePreset === "children_picture_book";
  const panels = page.panels.slice(0, PANEL_COUNT);
  while (panels.length < PANEL_COUNT) panels.push(emptyPanel());
  const removable = Boolean(canRemovePanel && onRemovePanel && page.panels.length > 1);

  const panelProps = (idx: number) => ({
    pageNum: page.page,
    idx,
    rendering,
    stylePreset,
    shellClassName: panelShellClass(isPictureBook),
    canRemove: removable,
    onRemove: removable ? () => onRemovePanel!(idx) : undefined,
    removeBusy,
  });

  return (
    <div className="flex flex-col gap-2 sm:gap-3">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <ComicPanelCard
          panel={panels[0]!}
          aspectClass="col-span-1 aspect-square"
          {...panelProps(0)}
        />
        <ComicPanelCard
          panel={panels[1]!}
          aspectClass="col-span-2 aspect-[4/3]"
          {...panelProps(1)}
        />
      </div>
      <ComicPanelCard
        panel={panels[2]!}
        aspectClass="aspect-[21/9] min-h-[5rem] sm:min-h-[6rem]"
        {...panelProps(2)}
      />
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <ComicPanelCard
          panel={panels[3]!}
          aspectClass="aspect-square"
          {...panelProps(3)}
        />
        <ComicPanelCard
          panel={panels[4]!}
          aspectClass="aspect-square"
          {...panelProps(4)}
        />
      </div>
    </div>
  );
}
