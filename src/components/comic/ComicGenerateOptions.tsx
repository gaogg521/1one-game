"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
};

type Props = {
  novelId?: string;
  novelContent?: string;
  lengthTier?: string;
  /** 入库 prompt（《书名》·类型），用于识别儿童短篇类型 */
  novelPrompt?: string;
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
}: Props) {
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
  const [chapterPick, setChapterPick] = useState<"all" | string>("all");
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
    const story = chapters.find((ch) => ch.title.startsWith("儿童故事"));
    if (!story) return;
    childrenScopeDefaultedRef.current = childrenScopeKey;
    setChapterPick(String(story.num));
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
    if (!novelId) return;
    const saved = loadComicRosterFromStorage(novelId);
    if (saved?.characters.length) {
      setRosterDraft(saved);
      onChange({ ...value, characterRoster: saved });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅 novelId 变化时恢复
  }, [novelId]);

  function patch(partial: Partial<ComicGenerateOptionsState>) {
    onChange({ ...value, ...partial });
  }

  function applyChapterPick(pick: "all" | string) {
    setChapterPick(pick);
    if (pick === "all") {
      patch({ chapterScope: null });
      return;
    }
    const num = parseInt(pick, 10);
    if (!Number.isFinite(num)) return;
    const picked = chapters.find((ch) => ch.num === num);
    patch({
      chapterScope: {
        fromChapter: num,
        toChapter: num,
        label: picked?.title ?? (isChildren ? `模块${num}` : `第${num}章`),
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
          漫画画风
        </p>
        {isChildren ? (
          <p className="mb-2 text-[11px] leading-relaxed text-[var(--gc-muted)]">
            类型为儿童短篇时，漫画固定为现代 Q 版小人书五格分镜（上小下大、中通栏、圆角粗线框），画风已锁定。
          </p>
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
              <span className="font-semibold text-[var(--gc-text)]">{preset.label}</span>
              <span className="mt-0.5 block text-[10px] leading-snug text-[var(--gc-muted)]">
                {preset.hint}
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
          段落精读（快）
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
          全书精读（慢·更贴剧情）
        </button>
      </div>

      {chapters.length > 1 ? (
        <div>
          <label className="mb-1 block text-xs text-[var(--gc-muted)]">
            {isChildren ? "改编模块" : "改编范围"}
          </label>
          <select
            value={chapterPick}
            onChange={(e) => applyChapterPick(e.target.value as "all" | string)}
            className="w-full rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-bg-elevated)] px-3 py-2 text-sm text-[var(--gc-text)]"
          >
            <option value="all">{isChildren ? "全书（解读+故事+结尾）" : "全书"}</option>
            {chapters.map((ch) => (
              <option key={ch.num} value={String(ch.num)}>
                {isChildren ? ch.title : `第${ch.num}章 · ${ch.title}`}
              </option>
            ))}
          </select>
          {isChildren ? (
            <p className="mt-1.5 text-[10px] leading-relaxed text-[var(--gc-text-faint)]">
              画漫画分镜默认已选「儿童故事」正文；创意解读仅供阅读，一般不必改编进格子里。
            </p>
          ) : null}
        </div>
      ) : null}

      <div>
        <button
          type="button"
          onClick={() => setShowRoster((v) => !v)}
          className="text-xs font-medium text-[var(--gc-accent)]"
        >
          {showRoster ? "收起人设存档" : "人设存档（可选，全片统一外貌）"}
        </button>
        {showRoster ? (
          <div className="mt-2 flex flex-col gap-2">
            {rosterDraft.characters.map((c, i) => (
              <div
                key={c.id}
                className="grid gap-1 rounded-lg border border-[color:var(--gc-border)] p-2 sm:grid-cols-2"
              >
                <input
                  placeholder="角色名"
                  value={c.name}
                  onChange={(e) => {
                    const chars = [...rosterDraft.characters];
                    chars[i] = { ...c, name: e.target.value };
                    persistRoster({ ...rosterDraft, characters: chars });
                  }}
                  className="rounded border border-[color:var(--gc-border)] bg-transparent px-2 py-1 text-xs"
                />
                <input
                  placeholder="外貌（脸型发型身高）"
                  value={c.appearanceZh}
                  onChange={(e) => {
                    const chars = [...rosterDraft.characters];
                    chars[i] = { ...c, appearanceZh: e.target.value };
                    persistRoster({ ...rosterDraft, characters: chars });
                  }}
                  className="rounded border border-[color:var(--gc-border)] bg-transparent px-2 py-1 text-xs sm:col-span-2"
                />
                <input
                  placeholder="固定服饰"
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
              + 添加角色
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
