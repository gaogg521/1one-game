"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  resolveChildrenInputKind,
  resolveChildrenNarrativeMode,
} from "@/lib/children-source-fidelity";
import type {
  ChildrenBriefUserRevision,
  ChildrenCreativeBrief,
} from "@/lib/literary-brief/children-brief-types";

type Props = {
  brief: ChildrenCreativeBrief | null;
  summary?: string | null;
  className?: string;
  onRevisionChange?: (rev: ChildrenBriefUserRevision | null) => void;
  onRegenerateWithRevision?: () => void;
  regenerateDisabled?: boolean;
};

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-[var(--gc-accent)]">
        {title}
      </p>
      <div className="text-xs leading-relaxed text-[var(--gc-muted)]">{children}</div>
    </div>
  );
}

/** 儿童短篇专用轻量构思面板 */
export function ChildrenCreativeBriefPanel({
  brief,
  summary,
  className = "",
  onRevisionChange,
  onRegenerateWithRevision,
  regenerateDisabled,
}: Props) {
  const t = useTranslations("novelBrief");
  const [editing, setEditing] = useState(false);
  const [storyLine, setStoryLine] = useState("");
  const [addonNotes, setAddonNotes] = useState("");

  useEffect(() => {
    if (!brief) return;
    setStoryLine(brief.storyBeats.join("；"));
  }, [brief]);

  if (!brief && !summary) return null;

  const applyRevision = () => {
    const rev: ChildrenBriefUserRevision = {
      storyLine: storyLine.trim() || undefined,
      addonNotes: addonNotes.trim() || undefined,
    };
    const hasAny = Boolean(rev.storyLine || rev.addonNotes);
    onRevisionChange?.(hasAny ? rev : null);
    setEditing(false);
  };

  return (
    <details
      className={`rounded-xl border border-[color:color-mix(in_srgb,var(--gc-accent)_18%,var(--gc-border))] bg-[color:color-mix(in_srgb,var(--gc-surface-glass)_88%,transparent)] px-4 py-3 ${className}`}
      open={Boolean(brief)}
    >
      <summary className="cursor-pointer list-none text-sm font-medium text-[var(--gc-text-soft)] outline-none [&::-webkit-details-marker]:hidden">
        {t("childrenSummary")}
        {brief ? (
          <span className="ml-2 text-[10px] font-normal text-[var(--gc-text-faint)]">
            {t("childrenTag")}
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
            <p className="text-xs text-[var(--gc-muted)]">
              <span className="text-[var(--gc-text-faint)]">{t("narrative")}</span>
              {(() => {
                const mode = resolveChildrenNarrativeMode(
                  brief.userPrompt,
                  resolveChildrenInputKind(brief.userPrompt, brief.inputKind),
                  brief.targetAge,
                  brief.narrativeMode,
                );
                return mode === "retelling"
                  ? t("narrativeModeRetelling")
                  : t("narrativeModeListenerExtension");
              })()}
            </p>

            {editing ? (
              <div className="space-y-2 rounded-lg border border-[color:var(--gc-border)] p-3">
                <label className="block text-[10px] font-medium text-[var(--gc-muted)]">
                  {t("storyLineLabel")}
                </label>
                <textarea
                  value={storyLine}
                  onChange={(e) => setStoryLine(e.target.value)}
                  rows={3}
                  className="w-full resize-y rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-bg)] px-2 py-1.5 text-xs"
                />
                <label className="block text-[10px] font-medium text-[var(--gc-muted)]">{t("addonLabel")}</label>
                <textarea
                  value={addonNotes}
                  onChange={(e) => setAddonNotes(e.target.value)}
                  rows={2}
                  placeholder={t("childrenAddonPlaceholder")}
                  className="w-full resize-y rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-bg)] px-2 py-1.5 text-xs"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={applyRevision}
                    className="rounded-lg bg-[var(--gc-accent)]/20 px-3 py-1.5 text-xs"
                  >
                    {t("saveRevision")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="rounded-lg border px-3 py-1.5 text-xs text-[var(--gc-muted)]"
                  >
                    {t("cancel")}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <Block title={t("creativeRead")}>
                  <p>{brief.interpretation}</p>
                </Block>
                <Block title={t("roles")}>
                  <p>{brief.cast}</p>
                </Block>
                <Block title={t("threeBeats")}>
                  <ol className="list-decimal space-y-0.5 pl-4">
                    {brief.storyBeats.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ol>
                </Block>
                <Block title={t("scenes")}>
                  <p>{brief.scene}</p>
                </Block>
                <Block title={t("closing")}>
                  <p>{brief.moral}</p>
                </Block>
                {brief.avoid.length > 0 ? (
                  <Block title={t("avoid")}>
                    <ul className="list-disc space-y-0.5 pl-4">
                      {brief.avoid.slice(0, 5).map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  </Block>
                ) : null}
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="text-xs text-[var(--gc-accent)] underline-offset-2 hover:underline"
                  >
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
