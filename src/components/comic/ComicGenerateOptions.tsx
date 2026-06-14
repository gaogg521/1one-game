"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { ComicChapterScope } from "@/lib/comic-chapter-scope";
import { listChapterScopeOptions } from "@/lib/comic-chapter-scope";
import {
  emptyComicCharacterRoster,
  type ComicCharacterRoster,
  type ComicCharacterRosterEntry,
} from "@/lib/comic-character-roster";
import type { ComicReadMode } from "@/lib/comic-format";
import { loadComicRosterFromStorage, saveComicRosterToStorage } from "@/lib/comic-roster-storage";
import { isChildrenNovelTier, parseNovelLengthTier, resolveNovelLengthTier } from "@/lib/novel-length";
import { inferNovelGenreTagFromStoredPrompt } from "@/lib/novel-genre-tags";
import {
  COMIC_STYLE_PRESET_LIST,
  type ComicStylePresetId,
} from "@/lib/comic-style-presets";

export type ComicGenerateOptionsState = {
  stylePreset: ComicStylePresetId;
  readMode: ComicReadMode;
  chapterScope: ComicChapterScope | null;
  characterRoster: ComicCharacterRoster | null;
  forceLightStoryboard: boolean;
};

type Props = {
  novelId?: string;
  novelContent?: string;
  lengthTier?: string;
  /** 入库 prompt（《书名》·类型），用于识别儿童短篇类型 */
  novelPrompt?: string;
  /** 预填按章改编范围（连载下一章 / URL 参数） */
  initialChapterScope?: ComicChapterScope | null;
  /** standalone=独立漫画：隐藏章节改编范围 */
  variant?: "standalone" | "adapt";
  value: ComicGenerateOptionsState;
  onChange: (next: ComicGenerateOptionsState) => void;
  compact?: boolean;
};

function defaultEntry(i: number): ComicCharacterRosterEntry {
  return {
    id: `char_${i + 1}`,
    name: "",
    appearanceZh: "",
    outfitZh: "",
  };
}

export function defaultComicGenerateOptions(): ComicGenerateOptionsState {
  return {
    stylePreset: "japanese_clean",
    readMode: "segment",
    chapterScope: null,
    characterRoster: null,
    forceLightStoryboard: false,
  };
}

export function ComicGenerateOptions({
  novelId,
  novelContent,
  lengthTier: lengthTierRaw,
  novelPrompt,
  value,
  onChange,
  compact,
  initialChapterScope,
  variant = "adapt",
}: Props) {
  const t = useTranslations("comicOptions");
  const tStyles = useTranslations("comicStyles");
  const childrenStoryTitle = t("childrenStoryTitle");
  const genreFromPrompt = inferNovelGenreTagFromStoredPrompt(novelPrompt ?? "");
  const effectiveTier = resolveNovelLengthTier({
    genreTagId: genreFromPrompt?.id,
    lengthTierPick: lengthTierRaw,
  });
  const isChildren = isChildrenNovelTier(effectiveTier);
  const stylePresets = useMemo(
    () =>
      isChildren
        ? COMIC_STYLE_PRESET_LIST.filter((p) => p.id === "children_picture_book")
        : COMIC_STYLE_PRESET_LIST,
    [isChildren],
  );

  useEffect(() => {
    if (isChildren && value.stylePreset !== "children_picture_book") {
      onChange({ ...value, stylePreset: "children_picture_book" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅儿童档位切换时锁定画风
  }, [isChildren]);

  const chapters = useMemo(
    () =>
      novelContent?.trim() ? listChapterScopeOptions(novelContent, { isChildren }) : [],
    [novelContent, isChildren],
  );
  type ChapterPickMode = "all" | "single" | "range";
  const [pickMode, setPickMode] = useState<ChapterPickMode>("all");
  const [chapterPick, setChapterPick] = useState<string>("1");
  const [rangeTo, setRangeTo] = useState<string>("1");
  const childrenScopeDefaultedRef = useRef<string | null>(null);
  const [showRoster, setShowRoster] = useState(false);
  const [rosterDraft, setRosterDraft] = useState<ComicCharacterRoster>(() =>
    value.characterRoster?.characters.length
      ? value.characterRoster
      : { ...emptyComicCharacterRoster(), characters: [defaultEntry(0), defaultEntry(1)] },
  );

  const childrenScopeKey = `${novelId ?? "paste"}:${(novelContent ?? "").slice(0, 120)}`;

  useEffect(() => {
    if (!isChildren || chapters.length === 0) return;
    if (childrenScopeDefaultedRef.current === childrenScopeKey) return;
    const story = chapters.find((ch) => ch.title.startsWith(childrenStoryTitle));
    if (!story) return;
    childrenScopeDefaultedRef.current = childrenScopeKey;
    setPickMode("single");
    setChapterPick(String(story.num));
    setRangeTo(String(story.num));
    patch({
      chapterScope: {
        fromChapter: story.num,
        toChapter: story.num,
        label: story.title,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 每篇儿童文仅默认一次
  }, [isChildren, childrenScopeKey, chapters]);

  useEffect(() => {
    if (!initialChapterScope) return;
    const from = initialChapterScope.fromChapter;
    const to = initialChapterScope.toChapter;
    if (from === to) {
      setPickMode("single");
      setChapterPick(String(from));
      setRangeTo(String(to));
    } else {
      setPickMode("range");
      setChapterPick(String(from));
      setRangeTo(String(to));
    }
    patch({
      chapterScope: {
        fromChapter: from,
        toChapter: to,
        label: initialChapterScope.label,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 外部预填章节范围
  }, [initialChapterScope?.fromChapter, initialChapterScope?.toChapter, initialChapterScope?.label]);

  useEffect(() => {
    if (!novelId) return;
    void (async () => {
      try {
        const res = await fetch(`/api/novel/${encodeURIComponent(novelId)}/character-roster`);
        if (res.ok) {
          const data = (await res.json()) as { roster?: ComicCharacterRoster };
          if (data.roster?.characters.length) {
            setRosterDraft(data.roster);
            saveComicRosterToStorage(novelId, data.roster);
            onChange({ ...value, characterRoster: data.roster });
            return;
          }
        }
      } catch {
        /* fallback local */
      }
      const saved = loadComicRosterFromStorage(novelId);
      if (saved?.characters.length) {
        setRosterDraft(saved);
        onChange({ ...value, characterRoster: saved });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅 novelId 变化时恢复
  }, [novelId]);

  function patch(partial: Partial<ComicGenerateOptionsState>) {
    onChange({ ...value, ...partial });
  }

  function applyChapterScope(mode: ChapterPickMode, fromStr: string, toStr?: string) {
    setPickMode(mode);
    if (mode === "all") {
      patch({ chapterScope: null });
      return;
    }
    const from = parseInt(fromStr, 10);
    const to = parseInt(toStr ?? fromStr, 10);
    if (!Number.isFinite(from) || !Number.isFinite(to)) return;
    const lo = Math.min(from, to);
    const hi = Math.max(from, to);
    setChapterPick(String(lo));
    setRangeTo(String(hi));
    const pickedFrom = chapters.find((ch) => ch.num === lo);
    const pickedTo = chapters.find((ch) => ch.num === hi);
    const label =
      lo === hi
        ? (pickedFrom?.title ??
          (isChildren ? t("moduleLabel", { num: lo }) : t("chapterShort", { num: lo })))
        : isChildren
          ? t("moduleRange", {
              from: pickedFrom?.title ?? t("moduleLabel", { num: lo }),
              to: pickedTo?.title ?? t("moduleLabel", { num: hi }),
            })
          : t("chapterRange", { from: lo, to: hi });
    patch({
      chapterScope: {
        fromChapter: lo,
        toChapter: hi,
        label,
      },
    });
  }

  function persistRoster(next: ComicCharacterRoster) {
    setRosterDraft(next);
    const cleaned = {
      ...next,
      characters: next.characters.filter((c) => c.name.trim() || c.appearanceZh.trim()),
    };
    if (novelId && cleaned.characters.length) saveComicRosterToStorage(novelId, cleaned);
    patch({ characterRoster: cleaned.characters.length ? cleaned : null });
  }

  return (
    <div className={`flex flex-col gap-3 ${compact ? "" : "rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-4"}`}>
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--gc-muted)]">
          {t("styleLabel")}
        </p>
        {isChildren ? (
          <p className="mb-2 text-[11px] leading-relaxed text-[var(--gc-muted)]">{t("childrenStyleLocked")}</p>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-2">
          {stylePresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => patch({ stylePreset: preset.id })}
              className={`rounded-lg border px-2.5 py-2 text-left text-xs transition ${
                value.stylePreset === preset.id
                  ? "border-[color:var(--gc-accent)] bg-[color:color-mix(in_srgb,var(--gc-accent)_12%,transparent)]"
                  : "border-[color:var(--gc-border)] hover:border-[color:var(--gc-accent)]/30"
              }`}
            >
              <span className="font-semibold text-[var(--gc-text)]">{tStyles(`${preset.id}.label`)}</span>
              <span className="mt-0.5 block text-[10px] leading-snug text-[var(--gc-muted)]">
                {tStyles(`${preset.id}.hint`)}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => patch({ readMode: "segment" })}
          className={`rounded-lg border px-3 py-1.5 text-xs ${
            value.readMode === "segment"
              ? "border-[color:var(--gc-accent)] text-[var(--gc-accent)]"
              : "border-[color:var(--gc-border)] text-[var(--gc-muted)]"
          }`}
        >
          {t("readModeSegment")}
        </button>
        <button
          type="button"
          onClick={() => patch({ readMode: "full" })}
          className={`rounded-lg border px-3 py-1.5 text-xs ${
            value.readMode === "full"
              ? "border-[color:var(--gc-accent)] text-[var(--gc-accent)]"
              : "border-[color:var(--gc-border)] text-[var(--gc-muted)]"
          }`}
        >
          {t("readModeFull")}
        </button>
      </div>

      <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-[color:var(--gc-border)] px-3 py-2 text-xs text-[var(--gc-text-soft)]">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={value.forceLightStoryboard}
          onChange={(e) => patch({ forceLightStoryboard: e.target.checked })}
        />
        <span>
          <span className="font-medium text-[var(--gc-text)]">{t("forceLightLabel")}</span>
          <span className="mt-0.5 block text-[10px] leading-snug text-[var(--gc-muted)]">
            {t("forceLightHint")}
          </span>
        </span>
      </label>

      {variant !== "standalone" && chapters.length > 1 ? (
        <div>
          <label className="mb-1 block text-xs text-[var(--gc-muted)]">
            {isChildren ? t("scopeLabelChildren") : t("scopeLabelNovel")}
          </label>
          <div className="mb-2 flex flex-wrap gap-2">
            {(["all", "single", "range"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  if (m === "all") applyChapterScope("all", "1");
                  else if (m === "single") applyChapterScope("single", chapterPick, chapterPick);
                  else applyChapterScope("range", chapterPick, rangeTo);
                }}
                className={`rounded-lg border px-2.5 py-1 text-[11px] ${
                  pickMode === m
                    ? "border-[color:var(--gc-accent)] text-[var(--gc-accent)]"
                    : "border-[color:var(--gc-border)] text-[var(--gc-muted)]"
                }`}
              >
                {m === "all"
                  ? isChildren
                    ? t("modeAllChildren")
                    : t("modeAllNovel")
                  : m === "single"
                    ? t("modeSingle")
                    : t("modeRange")}
              </button>
            ))}
          </div>
          {pickMode === "single" ? (
            <select
              value={chapterPick}
              onChange={(e) => applyChapterScope("single", e.target.value, e.target.value)}
              className="w-full rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-bg-elevated)] px-3 py-2 text-sm text-[var(--gc-text)]"
            >
              {chapters.map((ch) => (
                <option key={ch.num} value={String(ch.num)}>
                  {isChildren ? ch.title : t("chapterOption", { num: ch.num, title: ch.title })}
                </option>
              ))}
            </select>
          ) : null}
          {pickMode === "range" ? (
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={chapterPick}
                onChange={(e) => applyChapterScope("range", e.target.value, rangeTo)}
                className="min-w-0 flex-1 rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-bg-elevated)] px-3 py-2 text-sm text-[var(--gc-text)]"
              >
                {chapters.map((ch) => (
                  <option key={ch.num} value={String(ch.num)}>
                    {isChildren ? ch.title : t("chapterShort", { num: ch.num })}
                  </option>
                ))}
              </select>
              <span className="text-xs text-[var(--gc-muted)]">{t("rangeTo")}</span>
              <select
                value={rangeTo}
                onChange={(e) => applyChapterScope("range", chapterPick, e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-bg-elevated)] px-3 py-2 text-sm text-[var(--gc-text)]"
              >
                {chapters.map((ch) => (
                  <option key={ch.num} value={String(ch.num)}>
                    {isChildren ? ch.title : t("chapterShort", { num: ch.num })}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {pickMode === "range" && value.chapterScope && value.chapterScope.fromChapter !== value.chapterScope.toChapter ? (
            <p className="mt-1.5 text-[10px] text-[var(--gc-accent)]">
              {t("willAdapt", { label: value.chapterScope.label })}
            </p>
          ) : null}
          {isChildren ? (
            <p className="mt-1.5 text-[10px] leading-relaxed text-[var(--gc-text-faint)]">{t("childrenHint")}</p>
          ) : null}
        </div>
      ) : null}

      <div>
        <button
          type="button"
          onClick={() => setShowRoster((v) => !v)}
          className="text-xs font-medium text-[var(--gc-accent)]"
        >
          {showRoster ? t("rosterHide") : t("rosterShow")}
        </button>
        {showRoster ? (
          <div className="mt-2 flex flex-col gap-2">
            {rosterDraft.characters.map((c, i) => (
              <div
                key={c.id}
                className="grid gap-1 rounded-lg border border-[color:var(--gc-border)] p-2 sm:grid-cols-2"
              >
                <input
                  placeholder={t("charName")}
                  value={c.name}
                  onChange={(e) => {
                    const chars = [...rosterDraft.characters];
                    chars[i] = { ...c, name: e.target.value };
                    persistRoster({ ...rosterDraft, characters: chars });
                  }}
                  className="rounded border border-[color:var(--gc-border)] bg-transparent px-2 py-1 text-xs"
                />
                <input
                  placeholder={t("charAppearance")}
                  value={c.appearanceZh}
                  onChange={(e) => {
                    const chars = [...rosterDraft.characters];
                    chars[i] = { ...c, appearanceZh: e.target.value };
                    persistRoster({ ...rosterDraft, characters: chars });
                  }}
                  className="rounded border border-[color:var(--gc-border)] bg-transparent px-2 py-1 text-xs sm:col-span-2"
                />
                <input
                  placeholder={t("charOutfit")}
                  value={c.outfitZh}
                  onChange={(e) => {
                    const chars = [...rosterDraft.characters];
                    chars[i] = { ...c, outfitZh: e.target.value };
                    persistRoster({ ...rosterDraft, characters: chars });
                  }}
                  className="rounded border border-[color:var(--gc-border)] bg-transparent px-2 py-1 text-xs sm:col-span-2"
                />
              </div>
            ))}
            <button
              type="button"
              className="text-xs text-[var(--gc-muted)]"
              onClick={() =>
                persistRoster({
                  ...rosterDraft,
                  characters: [...rosterDraft.characters, defaultEntry(rosterDraft.characters.length)],
                })
              }
            >
              {t("addCharacter")}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
