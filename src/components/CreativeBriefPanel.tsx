"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { BriefUserRevision } from "@/lib/creative-brief/format-revision";
import type { BriefMedium, CreativeBrief } from "@/lib/creative-brief/types";

type Props = {
  brief: CreativeBrief | null;
  summary?: string | null;
  medium?: BriefMedium;
  className?: string;
  onRevisionChange?: (rev: BriefUserRevision | null) => void;
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

/** 创作台：展示 / 修订 AI 对一句话创意的深度扩写（Creative Brief） */
export function CreativeBriefPanel({
  brief,
  summary,
  medium = "game",
  className = "",
  onRevisionChange,
  onRegenerateWithRevision,
  regenerateDisabled,
}: Props) {
  const t = useTranslations("creativeBrief");
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

  const templateLine = medium === "game";

  const applyRevision = () => {
    const rev: BriefUserRevision = {
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
      className={`rounded-xl border border-[color:color-mix(in_srgb,var(--gc-accent)_18%,var(--gc-border))] bg-[color:color-mix(in_srgb,var(--gc-surface-glass)_88%,transparent)] px-4 py-3 backdrop-blur-sm ${className}`}
      open={Boolean(brief)}
    >
      <summary className="cursor-pointer list-none text-sm font-medium text-[var(--gc-text-soft)] outline-none [&::-webkit-details-marker]:hidden">
        {t("summary")}
        {brief ? (
          <span className="ml-2 text-[10px] font-normal text-[var(--gc-text-faint)]">
            {brief.packLabel} · {brief.expandSource === "pack" ? t("expandPack") : t("expandModel")}
          </span>
        ) : null}
      </summary>
      <div className="mt-3 space-y-3 border-t border-[color:var(--gc-border)] pt-3">
        {summary ? (
          <p className="text-xs leading-relaxed text-[var(--gc-text-soft)]">{summary}</p>
        ) : null}
        {brief ? (
          <>
            <p className="text-xs text-[var(--gc-muted)]">
              <span className="text-[var(--gc-text-faint)]">{t("originalPrompt")}</span>
              {brief.userPrompt}
            </p>

            {editing ? (
              <div className="space-y-2 rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)]/40 p-3">
                <label className="block text-[10px] font-medium text-[var(--gc-muted)]">Logline</label>
                <textarea
                  value={logline}
                  onChange={(e) => setLogline(e.target.value)}
                  rows={2}
                  className="w-full resize-y rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-bg)] px-2 py-1.5 text-xs text-[var(--gc-text)]"
                />
                <label className="block text-[10px] font-medium text-[var(--gc-muted)]">{t("worldLabel")}</label>
                <textarea
                  value={world}
                  onChange={(e) => setWorld(e.target.value)}
                  rows={2}
                  className="w-full resize-y rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-bg)] px-2 py-1.5 text-xs text-[var(--gc-text)]"
                />
                <label className="block text-[10px] font-medium text-[var(--gc-muted)]">{t("addonLabel")}</label>
                <textarea
                  value={addonNotes}
                  onChange={(e) => setAddonNotes(e.target.value)}
                  rows={2}
                  placeholder={t(`medium.${medium}.addonPlaceholder`)}
                  className="w-full resize-y rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-bg)] px-2 py-1.5 text-xs text-[var(--gc-text)] placeholder:text-[var(--gc-text-faint)]"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={applyRevision}
                    className="rounded-lg bg-[color:color-mix(in_srgb,var(--gc-accent)_25%,transparent)] px-3 py-1.5 text-xs font-medium text-[var(--gc-text)] hover:brightness-110"
                  >
                    {t("saveRevision")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="rounded-lg border border-[color:var(--gc-border)] px-3 py-1.5 text-xs text-[var(--gc-muted)]"
                  >
                    {t("cancel")}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-xs font-medium text-[var(--gc-text)]">{logline || brief.logline}</p>
                <Section title={t("worldLabel")} items={[world || brief.world]} />
                <Section title={t("scenes")} items={brief.scenes} />
                <Section title={t("factions")} items={brief.factions} />
                <Section title={t(`medium.${medium}.unitSection`)} items={brief.units} />
                <Section title={t("weaponsVfx")} items={[...brief.weapons, ...brief.vfx]} />
                <Section title={t("artStyle")} items={brief.artStyle} />
                <Section title={t("mood")} items={brief.mood} />
                <Section title={t(`medium.${medium}.hints`)} items={brief.gameplayHints} />
                <Section title={t("negatives")} items={brief.negatives} />
                {templateLine ? (
                  <p className="text-[10px] text-[var(--gc-text-faint)]">
                    {t("templateHint")}
                    <code className="text-[var(--gc-muted)]">{brief.intent.templateHint}</code> · {t("tone")}{" "}
                    {brief.intent.tone} · {t("difficulty")} {brief.intent.difficulty}
                  </p>
                ) : (
                  <p className="text-[10px] text-[var(--gc-text-faint)]">
                    {t("tone")} {brief.intent.tone} · {t("pace")} {brief.intent.difficulty}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="text-xs font-medium text-[color:color-mix(in_srgb,var(--gc-accent)_90%,white)] underline-offset-2 hover:underline"
                  >
                    {t("editBrief")}
                  </button>
                  {onRegenerateWithRevision ? (
                    <button
                      type="button"
                      disabled={regenerateDisabled}
                      onClick={() => onRegenerateWithRevision()}
                      className="text-xs font-medium text-[var(--gc-muted)] underline-offset-2 hover:text-[var(--gc-text)] hover:underline disabled:opacity-40"
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
