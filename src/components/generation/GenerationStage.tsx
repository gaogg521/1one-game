"use client";

import { useTranslations } from "next-intl";

type Stage = {
  key: string;
  label: string;
  active?: boolean;
  done?: boolean;
};

type Props = {
  title: string;
  stages: Stage[];
  detail?: string;
  progress?: number;
};

export function GenerationStage({ title, stages, detail, progress }: Props) {
  return (
    <div className="rounded-xl border border-[color:color-mix(in_srgb,var(--gc-accent)_28%,var(--gc-border))] bg-[color:color-mix(in_srgb,var(--gc-accent)_8%,var(--gc-surface-glass))] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-[var(--gc-text)]">{title}</p>
        {typeof progress === "number" ? (
          <span className="text-xs tabular-nums text-[var(--gc-accent)]">
            {Math.min(100, Math.max(0, progress))}%
          </span>
        ) : null}
      </div>
      {typeof progress === "number" ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[color:color-mix(in_srgb,var(--gc-border)_55%,transparent)]">
          <div
            className="h-full rounded-full bg-[var(--gc-accent)] transition-all duration-300"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      ) : null}
      <ol className="mt-3 flex flex-wrap gap-2">
        {stages.map((s) => (
          <li
            key={s.key}
            className={`rounded-full px-2.5 py-1 text-xs ${
              s.active
                ? "bg-[color:color-mix(in_srgb,var(--gc-accent)_85%,transparent)] text-[var(--gc-text)]"
                : s.done
                  ? "border border-[color:color-mix(in_srgb,var(--gc-accent)_35%,var(--gc-border))] bg-[color:color-mix(in_srgb,var(--gc-accent)_12%,transparent)] text-[var(--gc-text-soft)]"
                  : "border border-[color:var(--gc-border)] bg-[var(--gc-bg-elevated)] text-[var(--gc-muted)]"
            }`}
          >
            {s.label}
          </li>
        ))}
      </ol>
      {detail ? <p className="mt-2 text-xs text-[var(--gc-muted)]">{detail}</p> : null}
    </div>
  );
}

export function useGameGenerationStages() {
  const t = useTranslations("generation.gameStages");
  return [
    { key: "brief", label: t("brief") },
    { key: "spec", label: t("spec") },
    { key: "assets", label: t("assets") },
    { key: "preview", label: t("preview") },
  ] as const;
}

export function useNovelGenerationStages() {
  const t = useTranslations("generation.novelStages");
  return [
    { key: "brief", label: t("brief") },
    { key: "outline", label: t("outline") },
    { key: "writing", label: t("writing") },
    { key: "polish", label: t("polish") },
  ] as const;
}

export function useComicGenerationStages() {
  const t = useTranslations("generation.comicStages");
  return [
    { key: "cast", label: t("cast") },
    { key: "storyboard", label: t("storyboard") },
    { key: "panels", label: t("panels") },
    { key: "done", label: t("done") },
  ] as const;
}
