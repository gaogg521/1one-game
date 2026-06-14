"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { ComicPage, ComicPanel } from "@/lib/comic-format";

type PanelTextFields = {
  speaker: string;
  caption: string;
  prompt: string;
};

type Props = {
  pages: ComicPage[];
  currentPage?: number;
  onSelectPage?: (pageIndex: number) => void;
  isOwner?: boolean;
  rendering?: boolean;
  onRegeneratePanel?: (pageNumber: number, panelNumber: number) => void;
  onMovePanel?: (
    fromPageIndex: number,
    fromPanelIndex: number,
    toPageIndex: number,
    toPanelIndex: number,
  ) => void;
  onAddPanel?: (pageIndex: number, afterPanelIndex?: number) => void;
  onRemovePanel?: (pageIndex: number, panelIndex: number) => void;
  onAddPage?: (afterPageIndex?: number) => void;
  onMergePage?: (pageIndex: number) => void;
  maxPages?: number;
  onUpdatePanel?: (
    pageIndex: number,
    panelIndex: number,
    fields: Partial<PanelTextFields>,
  ) => void;
  reorderBusy?: boolean;
  className?: string;
};

function panelKey(pageIdx: number, panelIdx: number) {
  return `${pageIdx}-${panelIdx}`;
}

function panelToFields(panel: ComicPanel): PanelTextFields {
  return {
    speaker: panel.speaker ?? "",
    caption: panel.caption ?? "",
    prompt: panel.prompt ?? "",
  };
}

function fieldsEqual(a: PanelTextFields, b: PanelTextFields): boolean {
  return a.speaker === b.speaker && a.caption === b.caption && a.prompt === b.prompt;
}

function PanelInlineEditor({
  pageIdx,
  panelIdx,
  panel,
  disabled,
  onSave,
}: {
  pageIdx: number;
  panelIdx: number;
  panel: ComicPanel;
  disabled: boolean;
  onSave: (pageIndex: number, panelIndex: number, fields: Partial<PanelTextFields>) => void;
}) {
  const t = useTranslations("storyboardOutline");
  const baseline = useMemo(() => panelToFields(panel), [panel]);
  const [draft, setDraft] = useState(baseline);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputCls =
    "w-full rounded-md border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-2 py-1.5 text-[11px] text-[var(--gc-text)] outline-none placeholder:text-[var(--gc-text-faint)] focus:border-[color:color-mix(in_srgb,var(--gc-accent)_40%,var(--gc-border))]";

  useEffect(() => {
    setDraft(baseline);
  }, [baseline]);

  const flushSave = useCallback(
    (next: PanelTextFields) => {
      if (disabled || fieldsEqual(next, baseline)) return;
      const patch: Partial<PanelTextFields> = {};
      if (next.speaker !== baseline.speaker) patch.speaker = next.speaker;
      if (next.caption !== baseline.caption) patch.caption = next.caption;
      if (next.prompt !== baseline.prompt) patch.prompt = next.prompt;
      if (Object.keys(patch).length) onSave(pageIdx, panelIdx, patch);
    },
    [baseline, disabled, onSave, pageIdx, panelIdx],
  );

  const scheduleSave = useCallback(
    (next: PanelTextFields) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => flushSave(next), 500);
    },
    [flushSave],
  );

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );

  function update(field: keyof PanelTextFields, value: string) {
    const next = { ...draft, [field]: value };
    setDraft(next);
    scheduleSave(next);
  }

  return (
    <div
      className="mt-2 space-y-1.5 border-t border-[color:var(--gc-border)]/60 pt-2"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="text"
        value={draft.speaker}
        disabled={disabled}
        placeholder={t("editSpeaker")}
        onChange={(e) => update("speaker", e.target.value)}
        onBlur={() => flushSave(draft)}
        className={inputCls}
        data-testid={`storyboard-edit-speaker-p${pageIdx}-n${panelIdx}`}
      />
      <textarea
        value={draft.caption}
        disabled={disabled}
        placeholder={t("editCaption")}
        rows={2}
        onChange={(e) => update("caption", e.target.value)}
        onBlur={() => flushSave(draft)}
        className={`${inputCls} resize-y min-h-[2.5rem]`}
        data-testid={`storyboard-edit-caption-p${pageIdx}-n${panelIdx}`}
      />
      <textarea
        value={draft.prompt}
        disabled={disabled}
        placeholder={t("editPrompt")}
        rows={2}
        onChange={(e) => update("prompt", e.target.value)}
        onBlur={() => flushSave(draft)}
        className={`${inputCls} resize-y min-h-[2.5rem]`}
        data-testid={`storyboard-edit-prompt-p${pageIdx}-n${panelIdx}`}
      />
    </div>
  );
}

export function ComicStoryboardOutline({
  pages,
  currentPage = 0,
  onSelectPage,
  isOwner = false,
  rendering = false,
  onRegeneratePanel,
  onMovePanel,
  onAddPanel,
  onRemovePanel,
  onAddPage,
  onMergePage,
  maxPages = 32,
  onUpdatePanel,
  reorderBusy = false,
  className = "",
}: Props) {
  const t = useTranslations("storyboardOutline");
  const [expandedPage, setExpandedPage] = useState<number | null>(currentPage);
  const [dragFrom, setDragFrom] = useState<{ pageIdx: number; panelIdx: number } | null>(null);

  const stats = useMemo(() => {
    let panels = 0;
    let withDialogue = 0;
    let withImage = 0;
    for (const page of pages) {
      for (const panel of page.panels) {
        panels += 1;
        if (panel.caption?.trim() || panel.speaker?.trim()) withDialogue += 1;
        if (panel.imageUrl?.trim()) withImage += 1;
      }
    }
    return { pages: pages.length, panels, withDialogue, withImage };
  }, [pages]);

  const canEdit = Boolean(isOwner && onMovePanel && !reorderBusy && !rendering);
  const canEditText = Boolean(isOwner && onUpdatePanel && !reorderBusy && !rendering);
  const canAddPage = Boolean(isOwner && onAddPage && !reorderBusy && !rendering && pages.length < maxPages);
  const canMergePage = Boolean(isOwner && onMergePage && !reorderBusy && !rendering && pages.length > 1);

  if (pages.length === 0) return null;

  return (
    <section
      id="storyboard-outline"
      className={`scroll-mt-24 rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-4 sm:p-5 ${className}`}
      data-testid="comic-storyboard-outline"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--gc-accent)]">
        {t("eyebrow")}
      </p>
      <h2 className="mt-1 text-base font-semibold text-[var(--gc-text)]">{t("title")}</h2>
      <p className="mt-1 text-xs leading-relaxed text-[var(--gc-muted)]">{t("desc")}</p>
      {isOwner && (onMovePanel || onUpdatePanel) ? (
        <p className="mt-2 text-[10px] text-[var(--gc-text-faint)]">
          {reorderBusy
            ? t("reorderSaving")
            : canEditText
              ? t("editHint")
              : t("dragHint")}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-[var(--gc-text-soft)]">
        <span className="rounded-full border border-[color:var(--gc-border)] px-2 py-0.5">
          {t("statPages", { count: stats.pages })}
        </span>
        <span className="rounded-full border border-[color:var(--gc-border)] px-2 py-0.5">
          {t("statPanels", { count: stats.panels })}
        </span>
        <span className="rounded-full border border-[color:var(--gc-border)] px-2 py-0.5">
          {t("statDialogue", { count: stats.withDialogue })}
        </span>
        <span className="rounded-full border border-[color:var(--gc-border)] px-2 py-0.5">
          {t("statRendered", { count: stats.withImage, total: stats.panels })}
        </span>
      </div>

      <div className="mt-4 space-y-2">
        {pages.map((page, pageIdx) => {
          const open = expandedPage === pageIdx;
          const pageRendered = page.panels.filter((p) => p.imageUrl?.trim()).length;
          return (
            <div
              key={`page-${pageIdx}-${page.page}`}
              className="rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-bg-elevated)]/40"
            >
              <div className="flex w-full items-center justify-between gap-2 px-3 py-2.5">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => setExpandedPage(open ? null : pageIdx)}
                >
                  <span className="text-sm font-medium text-[var(--gc-text)]">
                    {t("pageLabel", { num: pageIdx + 1 })}
                  </span>
                </button>
                <span className="flex shrink-0 items-center gap-2">
                  {canMergePage && pageIdx < pages.length - 1 ? (
                    <button
                      type="button"
                      disabled={reorderBusy}
                      title={t("mergePage")}
                      onClick={() => {
                        if (window.confirm(t("confirmMergePage"))) {
                          onMergePage?.(pageIdx);
                        }
                      }}
                      className="rounded-md border border-[color:var(--gc-border)] px-2 py-0.5 text-[10px] text-[var(--gc-text-soft)] hover:border-[color:color-mix(in_srgb,var(--gc-accent)_35%,var(--gc-border))] hover:text-[var(--gc-accent)] disabled:opacity-45"
                      data-testid={`storyboard-merge-p${pageIdx}`}
                    >
                      {t("mergePage")}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="text-[10px] text-[var(--gc-muted)]"
                    onClick={() => setExpandedPage(open ? null : pageIdx)}
                  >
                    {t("pageMeta", {
                      panels: page.panels.length,
                      rendered: pageRendered,
                    })}
                  </button>
                </span>
              </div>
              {open ? (
                <ol className="space-y-1.5 border-t border-[color:var(--gc-border)] px-3 py-2">
                  {page.panels.map((panel, panelIdx) => (
                    <li
                      key={panelKey(pageIdx, panelIdx)}
                      draggable={canEdit}
                      onDragStart={() => setDragFrom({ pageIdx, panelIdx })}
                      onDragEnd={() => setDragFrom(null)}
                      onDragOver={(e) => {
                        if (dragFrom) e.preventDefault();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (
                          dragFrom &&
                          (dragFrom.pageIdx !== pageIdx || dragFrom.panelIdx !== panelIdx)
                        ) {
                          onMovePanel?.(
                            dragFrom.pageIdx,
                            dragFrom.panelIdx,
                            pageIdx,
                            panelIdx,
                          );
                        }
                        setDragFrom(null);
                      }}
                      className={
                        dragFrom?.pageIdx === pageIdx && dragFrom.panelIdx === panelIdx
                          ? "opacity-60"
                          : undefined
                      }
                    >
                      <div
                        className={`rounded-lg border px-2.5 py-2 text-[11px] transition ${
                          currentPage === pageIdx
                            ? "border-[color:color-mix(in_srgb,var(--gc-accent)_35%,var(--gc-border))]"
                            : "border-transparent hover:border-[color:var(--gc-border)]"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {isOwner && onMovePanel ? (
                            <span
                              className="cursor-grab select-none pt-0.5 text-[var(--gc-text-faint)] active:cursor-grabbing"
                              aria-hidden
                              title={t("dragHint")}
                            >
                              ⋮⋮
                            </span>
                          ) : null}
                          <div className="min-w-0 flex-1">
                            <button
                              type="button"
                              className="w-full text-left"
                              onClick={() => onSelectPage?.(pageIdx)}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className="font-medium text-[var(--gc-text-soft)]">
                                  {t("panelLabel", { num: panelIdx + 1 })}
                                  {panel.shotType ? (
                                    <span className="ml-1.5 font-normal text-[var(--gc-text-faint)]">
                                      · {panel.shotType}
                                    </span>
                                  ) : null}
                                </span>
                                <span
                                  className={`shrink-0 text-[10px] ${
                                    panel.imageUrl?.trim()
                                      ? "text-emerald-400"
                                      : "text-[var(--gc-text-faint)]"
                                  }`}
                                >
                                  {panel.imageUrl?.trim() ? t("hasImage") : t("noImage")}
                                </span>
                              </div>
                            </button>
                            {canEditText && onUpdatePanel ? (
                              <PanelInlineEditor
                                pageIdx={pageIdx}
                                panelIdx={panelIdx}
                                panel={panel}
                                disabled={reorderBusy}
                                onSave={onUpdatePanel}
                              />
                            ) : null}
                          </div>
                          {isOwner && onRemovePanel && stats.panels > 1 ? (
                            <button
                              type="button"
                              disabled={reorderBusy}
                              title={t("removePanel")}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(t("confirmRemovePanel"))) {
                                  onRemovePanel(pageIdx, panelIdx);
                                }
                              }}
                              className="shrink-0 rounded px-1 text-[var(--gc-text-faint)] hover:text-red-400 disabled:opacity-45"
                              data-testid={`storyboard-remove-p${pageIdx}-n${panelIdx}`}
                            >
                              ×
                            </button>
                          ) : null}
                        </div>
                        {isOwner && onRegeneratePanel ? (
                          <button
                            type="button"
                            disabled={rendering}
                            onClick={(e) => {
                              e.stopPropagation();
                              onRegeneratePanel(page.page, panelIdx + 1);
                            }}
                            className="mt-2 rounded-md border border-[color:color-mix(in_srgb,var(--gc-accent)_35%,var(--gc-border))] px-2 py-1 text-[10px] font-medium text-[var(--gc-accent)] disabled:opacity-45"
                            data-testid={`storyboard-regen-p${page.page}-n${panelIdx + 1}`}
                          >
                            {rendering ? t("regenPanelBusy") : t("regenPanel")}
                          </button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                  {isOwner && onAddPanel ? (
                    <li>
                      <button
                        type="button"
                        disabled={reorderBusy}
                        onClick={() => onAddPanel(pageIdx)}
                        className="w-full rounded-lg border border-dashed border-[color:var(--gc-border)] px-2 py-2 text-[10px] font-medium text-[var(--gc-accent)] hover:border-[color:color-mix(in_srgb,var(--gc-accent)_35%,var(--gc-border))] disabled:opacity-45"
                        data-testid={`storyboard-add-p${pageIdx}`}
                      >
                        {t("addPanel")}
                      </button>
                    </li>
                  ) : null}
                </ol>
              ) : null}
            </div>
          );
        })}
        {canAddPage ? (
          <button
            type="button"
            disabled={reorderBusy}
            onClick={() => onAddPage?.(pages.length - 1)}
            className="w-full rounded-xl border border-dashed border-[color:var(--gc-border)] px-3 py-2.5 text-[11px] font-medium text-[var(--gc-accent)] hover:border-[color:color-mix(in_srgb,var(--gc-accent)_35%,var(--gc-border))] disabled:opacity-45"
            data-testid="storyboard-add-page"
          >
            {t("addPage")}
          </button>
        ) : null}
      </div>
    </section>
  );
}
