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
}: {
  page: ComicPage;
  rendering?: boolean;
  stylePreset?: ComicStylePresetId;
}) {
  const isPictureBook = stylePreset === "children_picture_book";
  const panels = page.panels.slice(0, PANEL_COUNT);
  while (panels.length < PANEL_COUNT) panels.push(emptyPanel());

  return (
    <div className="flex flex-col gap-2 sm:gap-3">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <ComicPanelCard
          panel={panels[0]!}
          pageNum={page.page}
          idx={0}
          aspectClass="col-span-1 aspect-square"
          rendering={rendering}
          stylePreset={stylePreset}
          shellClassName={panelShellClass(isPictureBook)}
        />
        <ComicPanelCard
          panel={panels[1]!}
          pageNum={page.page}
          idx={1}
          aspectClass="col-span-2 aspect-[4/3]"
          rendering={rendering}
          stylePreset={stylePreset}
          shellClassName={panelShellClass(isPictureBook)}
        />
      </div>
      <ComicPanelCard
        panel={panels[2]!}
        pageNum={page.page}
        idx={2}
        aspectClass="aspect-[21/9] min-h-[5rem] sm:min-h-[6rem]"
        rendering={rendering}
        stylePreset={stylePreset}
        shellClassName={panelShellClass(isPictureBook)}
      />
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <ComicPanelCard
          panel={panels[3]!}
          pageNum={page.page}
          idx={3}
          aspectClass="aspect-square"
          rendering={rendering}
          stylePreset={stylePreset}
          shellClassName={panelShellClass(isPictureBook)}
        />
        <ComicPanelCard
          panel={panels[4]!}
          pageNum={page.page}
          idx={4}
          aspectClass="aspect-square"
          rendering={rendering}
          stylePreset={stylePreset}
          shellClassName={panelShellClass(isPictureBook)}
        />
      </div>
    </div>
  );
}
