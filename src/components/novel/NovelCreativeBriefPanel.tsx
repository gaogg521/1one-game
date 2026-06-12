"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { NovelBriefUserRevision, NovelCreativeBrief } from "@/lib/literary-brief/novel-types";

type Props = {
  brief: NovelCreativeBrief | null;
  summary?: string | null;
  className?: string;
  onRevisionChange?: (rev: NovelBriefUserRevision | null) => void;
  onRegenerateWithRevision?: () => void;
  regenerateDisabled?: boolean;
};

function Section({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-[var(--gc-text-faint)]">
        {title}
      </p>
      <ul className="space-y-0.5 text-xs leading-relaxed text-[var(--gc-muted)]">
        {items.map((line) => (
          <li key={`${title}-${line.slice(0, 24)}`}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

/** 小说创意构思面板（网文字段，非游戏 Brief） */
export function NovelCreativeBriefPanel({
  brief,
  summary,
  className = "",
  onRevisionChange,
  onRegenerateWithRevision,
  regenerateDisabled,
}: Props) {
  const t = useTranslations("novelBrief");
  const [editing, setEditing] = useState(false);
  const [logline, setLogline] = useState("");
  const [world, setWorld] = useState("");
  const [addonNotes, setAddonNotes] = useState("");

  useEffect(() => {
    if (!brief) return;
    setLogline(brief.logline);
    setWorld(brief.world);
  }, [brief]);

  if (!brief && !summary) return null;

  const applyRevision = () => {
    const rev: NovelBriefUserRevision = {
      logline: logline.trim() || undefined,
      world: world.trim() || undefined,
      addonNotes: addonNotes.trim() || undefined,
    };
    const hasAny = Boolean(rev.logline || rev.world || rev.addonNotes);
    onRevisionChange?.(hasAny ? rev : null);
    setEditing(false);
  };

  return (
    <details
      className={`rounded-xl border border-[color:color-mix(in_srgb,var(--gc-accent)_18%,var(--gc-border))] bg-[color:color-mix(in_srgb,var(--gc-surface-glass)_88%,transparent)] px-4 py-3 ${className}`}
      open={Boolean(brief)}
    >
      <summary className="cursor-pointer list-none text-sm font-medium text-[var(--gc-text-soft)] outline-none [&::-webkit-details-marker]:hidden">
        {t("novelSummary")}
        {brief ? (
          <span className="ml-2 text-[10px] font-normal text-[var(--gc-text-faint)]">
            {brief.genreLabel} · {brief.expandSource === "pack" ? t("expandPack") : t("expandModel")}
          </span>
        ) : null}
      </summary>
      <div className="mt-3 space-y-3 border-t border-[color:var(--gc-border)] pt-3">
        {summary && !brief ? (
          <p className="text-xs leading-relaxed text-[var(--gc-text-soft)]">{summary}</p>
        ) : null}
        {brief ? (
          <>
            {brief.title ? (
              <p className="text-xs text-[var(--gc-muted)]">
                <span className="text-[var(--gc-text-faint)]">{t("titlePrefix")}</span>《{brief.title}》
              </p>
            ) : null}

            {editing ? (
              <div className="space-y-2 rounded-lg border border-[color:var(--gc-border)] p-3">
                <label className="block text-[10px] font-medium text-[var(--gc-muted)]">Logline</label>
                <textarea
                  value={logline}
                  onChange={(e) => setLogline(e.target.value)}
                  rows={2}
                  className="w-full resize-y rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-bg)] px-2 py-1.5 text-xs"
                />
                <label className="block text-[10px] font-medium text-[var(--gc-muted)]">{t("worldLabel")}</label>
                <textarea
                  value={world}
                  onChange={(e) => setWorld(e.target.value)}
                  rows={2}
                  className="w-full resize-y rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-bg)] px-2 py-1.5 text-xs"
                />
                <label className="block text-[10px] font-medium text-[var(--gc-muted)]">{t("addonLabel")}</label>
                <textarea
                  value={addonNotes}
                  onChange={(e) => setAddonNotes(e.target.value)}
                  rows={2}
                  placeholder={t("addonPlaceholder")}
                  className="w-full resize-y rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-bg)] px-2 py-1.5 text-xs"
                />
                <div className="flex gap-2">
                  <button type="button" onClick={applyRevision} className="rounded-lg bg-[var(--gc-accent)]/20 px-3 py-1.5 text-xs">
                    {t("saveRevision")}
                  </button>
                  <button type="button" onClick={() => setEditing(false)} className="rounded-lg border px-3 py-1.5 text-xs text-[var(--gc-muted)]">
                    {t("cancel")}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-xs font-medium text-[var(--gc-text)]">{logline || brief.logline}</p>
                <Section title={t("setting")} items={[brief.setting]} />
                <Section title={t("world")} items={[world || brief.world]} />
                <Section title={t("protagonist")} items={[brief.protagonist]} />
                <Section title={t("coreConflict")} items={[brief.coreConflict]} />
                <Section title={t("protagonistGoal")} items={[brief.protagonistGoal]} />
                <Section title={t("characters")} items={brief.characters} />
                <Section title={t("antagonists")} items={brief.antagonists} />
                <Section title={t("plotBeats")} items={brief.plotBeats} />
                <Section title={t("keyScenes")} items={brief.keyScenes} />
                <Section title={t("tone")} items={[brief.tone]} />
                <Section title={t("writingStyle")} items={brief.writingStyle} />
                <Section title={t("narrativeHints")} items={brief.narrativeHints} />
                <Section title={t("negatives")} items={brief.negatives} />
                <div className="flex flex-wrap gap-2 pt-1">
                  <button type="button" onClick={() => setEditing(true)} className="text-xs text-[var(--gc-accent)] underline-offset-2 hover:underline">
                    {t("editBrief")}
                  </button>
                  {onRegenerateWithRevision ? (
                    <button
                      type="button"
                      disabled={regenerateDisabled}
                      onClick={() => onRegenerateWithRevision()}
                      className="text-xs text-[var(--gc-muted)] hover:underline disabled:opacity-40"
                    >
                      {t("regenerateBrief")}
                    </button>
                  ) : null}
                </div>
              </>
            )}
          </>
        ) : null}
      </div>
    </details>
  );
}
