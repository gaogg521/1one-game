"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  emptyComicCharacterRoster,
  type ComicCharacterRoster,
  type ComicCharacterRosterEntry,
} from "@/lib/comic-character-roster";
import { loadComicRosterFromStorage, saveComicRosterToStorage } from "@/lib/comic-roster-storage";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { mergeLocaleHeaders } from "@/lib/i18n/client-headers";

type Props = {
  novelId: string;
  isOwner?: boolean;
  initialRoster?: ComicCharacterRoster | null;
  className?: string;
};

function defaultEntry(i: number): ComicCharacterRosterEntry {
  return {
    id: `char_${i + 1}`,
    name: "",
    appearanceZh: "",
    outfitZh: "",
  };
}

function cleanRoster(roster: ComicCharacterRoster): ComicCharacterRoster {
  return {
    ...roster,
    characters: roster.characters.filter((c) => c.name.trim() || c.appearanceZh.trim()),
  };
}

export function NovelCharacterRosterPanel({
  novelId,
  isOwner = false,
  initialRoster,
  className = "",
}: Props) {
  const t = useTranslations("characterRoster");
  const tc = useTranslations("comicOptions");
  const locale = useLocale() as AppLocale;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [roster, setRoster] = useState<ComicCharacterRoster>(() => {
    if (initialRoster?.characters.length) return initialRoster;
    const stored = loadComicRosterFromStorage(novelId);
    if (stored?.characters.length) return stored;
    return { ...emptyComicCharacterRoster(), characters: [defaultEntry(0), defaultEntry(1)] };
  });
  const [saveState, setSaveState] = useState<"idle" | "local" | "server" | "error">("idle");
  const [sheetBusy, setSheetBusy] = useState<string | "all" | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);

  useEffect(() => {
    if (initialRoster?.characters.length) {
      setRoster(initialRoster);
      saveComicRosterToStorage(novelId, initialRoster);
    }
  }, [initialRoster, novelId]);

  const persistServer = useCallback(
    (next: ComicCharacterRoster) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void fetch(`/api/novel/${encodeURIComponent(novelId)}/character-roster`, {
          method: "PUT",
          headers: mergeLocaleHeaders(locale, { "Content-Type": "application/json" }),
          body: JSON.stringify({ roster: cleanRoster(next) }),
        })
          .then((res) => {
            if (!res.ok) throw new Error("save failed");
            setSaveState("server");
          })
          .catch(() => setSaveState("error"));
      }, 600);
    },
    [novelId, locale],
  );

  function persist(next: ComicCharacterRoster) {
    setRoster(next);
    const cleaned = cleanRoster(next);
    if (cleaned.characters.length) {
      saveComicRosterToStorage(novelId, cleaned);
      setSaveState("local");
      if (isOwner) persistServer(next);
    }
  }

  const characterCount = cleanRoster(roster).characters.length;

  async function generateSheets(characterIds?: string[]) {
    if (!isOwner || sheetBusy) return;
    setSheetError(null);
    setSheetBusy(characterIds?.length === 1 ? characterIds[0]! : "all");
    try {
      const res = await fetch(`/api/novel/${encodeURIComponent(novelId)}/character-sheets`, {
        method: "POST",
        headers: mergeLocaleHeaders(locale, { "Content-Type": "application/json" }),
        body: JSON.stringify(characterIds?.length ? { characterIds } : {}),
      });
      const data = (await res.json()) as {
        roster?: ComicCharacterRoster;
        results?: { characterId: string; error?: string | null }[];
        errorKey?: string;
      };
      if (!res.ok) {
        setSheetError(data.errorKey ?? "saveFailed");
        return;
      }
      if (data.roster) {
        setRoster(data.roster);
        saveComicRosterToStorage(novelId, cleanRoster(data.roster));
        setSaveState("server");
      }
      const failed = data.results?.find((r) => r.error);
      if (failed?.error) {
        setSheetError(failed.error);
      }
    } catch {
      setSheetError(t("saveFailed"));
    } finally {
      setSheetBusy(null);
    }
  }

  const readyForSheet = cleanRoster(roster).characters.filter(
    (c) => c.name.trim() && c.appearanceZh.trim(),
  ).length;

  return (
    <section
      id="character-roster"
      className={`scroll-mt-24 rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-4 sm:p-5 ${className}`}
      data-testid="novel-character-roster"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--gc-accent)]">
            {t("eyebrow")}
          </p>
          <h2 className="mt-1 text-base font-semibold text-[var(--gc-text)]">{t("title")}</h2>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-[var(--gc-muted)]">{t("desc")}</p>
        </div>
        {characterCount > 0 ? (
          <span className="rounded-full border border-[color:var(--gc-border)] px-2.5 py-1 text-[10px] text-[var(--gc-text-soft)]">
            {t("count", { count: characterCount })}
          </span>
        ) : null}
      </div>

      {!isOwner ? (
        <p className="mt-4 text-xs text-[var(--gc-muted)]">{t("ownerOnlyHint")}</p>
      ) : (
        <>
          <div className="mt-4 flex flex-col gap-2">
            {roster.characters.map((c, i) => (
              <div
                key={c.id}
                className="grid gap-2 rounded-xl border border-[color:var(--gc-border)] p-3 sm:grid-cols-[72px_1fr_1fr]"
              >
                <div className="flex flex-col items-center gap-1 sm:row-span-2">
                  {c.referenceImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.referenceImageUrl}
                      alt={c.name || t("referenceImage")}
                      className="h-[72px] w-[72px] rounded-lg border border-[color:var(--gc-border)] object-cover"
                    />
                  ) : (
                    <div className="flex h-[72px] w-[72px] items-center justify-center rounded-lg border border-dashed border-[color:var(--gc-border)] text-[9px] text-[var(--gc-text-faint)]">
                      {t("referenceImage")}
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={Boolean(sheetBusy) || !c.name.trim() || !c.appearanceZh.trim()}
                    onClick={() => void generateSheets([c.id])}
                    className="text-[10px] font-medium text-[var(--gc-accent)] disabled:opacity-45"
                    data-testid={`char-sheet-gen-${c.id}`}
                  >
                    {sheetBusy === c.id ? t("generatingSheet") : t("generateSheet")}
                  </button>
                </div>
                <input
                  placeholder={tc("charName")}
                  value={c.name}
                  onChange={(e) => {
                    const chars = [...roster.characters];
                    chars[i] = { ...c, name: e.target.value };
                    persist({ ...roster, characters: chars });
                  }}
                  className="rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-3 py-2 text-xs text-[var(--gc-text)]"
                />
                <input
                  placeholder={tc("charAppearance")}
                  value={c.appearanceZh}
                  onChange={(e) => {
                    const chars = [...roster.characters];
                    chars[i] = { ...c, appearanceZh: e.target.value };
                    persist({ ...roster, characters: chars });
                  }}
                  className="rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-3 py-2 text-xs text-[var(--gc-text)] sm:col-span-2"
                />
                <input
                  placeholder={tc("charOutfit")}
                  value={c.outfitZh ?? ""}
                  onChange={(e) => {
                    const chars = [...roster.characters];
                    chars[i] = { ...c, outfitZh: e.target.value };
                    persist({ ...roster, characters: chars });
                  }}
                  className="rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-3 py-2 text-xs text-[var(--gc-text)] sm:col-span-2"
                />
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() =>
                persist({
                  ...roster,
                  characters: [...roster.characters, defaultEntry(roster.characters.length)],
                })
              }
              className="text-xs font-medium text-[var(--gc-accent)]"
            >
              {tc("addCharacter")}
            </button>
            <button
              type="button"
              disabled={Boolean(sheetBusy) || readyForSheet === 0}
              onClick={() => void generateSheets()}
              className="text-xs font-medium text-[var(--gc-text-soft)] hover:text-[var(--gc-accent)] disabled:opacity-45"
              data-testid="char-sheet-gen-all"
            >
              {sheetBusy === "all" ? t("generatingSheet") : t("generateAllSheets")}
            </button>
            {readyForSheet === 0 ? (
              <span className="text-[10px] text-[var(--gc-text-faint)]">{t("noAppearanceHint")}</span>
            ) : null}
            {sheetError ? (
              <span className="text-[10px] text-red-400">{t("sheetError", { error: sheetError })}</span>
            ) : null}
            {saveState === "server" ? (
              <span className="text-[10px] text-emerald-400">{t("savedServer")}</span>
            ) : saveState === "local" ? (
              <span className="text-[10px] text-[var(--gc-text-faint)]">{t("savedLocally")}</span>
            ) : saveState === "error" ? (
              <span className="text-[10px] text-red-400">{t("saveFailed")}</span>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={withLocalePath(`/comic/create?novelId=${encodeURIComponent(novelId)}`, locale)}
              className="gc-theme-cta rounded-lg px-4 py-2 text-xs font-semibold"
            >
              {t("adaptCta")}
            </Link>
            <Link
              href={withLocalePath(`/novel/${novelId}?adaptComic=1`, locale)}
              className="rounded-lg border border-[color:var(--gc-border)] px-4 py-2 text-xs font-medium text-[var(--gc-text-soft)] hover:border-[color:var(--gc-accent)]/40"
            >
              {t("quickAdaptCta")}
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
