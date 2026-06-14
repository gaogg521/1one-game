"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

export type ComicStandaloneStepId = "pitch" | "script" | "storyboard" | "art";

type StepDef = {
  id: ComicStandaloneStepId;
  titleKey: string;
  descKey: string;
  href?: string;
};

const STEPS: StepDef[] = [
  { id: "pitch", titleKey: "stepPitchTitle", descKey: "stepPitchDesc", href: "/comic/create" },
  { id: "script", titleKey: "stepScriptTitle", descKey: "stepScriptDesc" },
  { id: "storyboard", titleKey: "stepStoryboardTitle", descKey: "stepStoryboardDesc" },
  { id: "art", titleKey: "stepArtTitle", descKey: "stepArtDesc" },
];

type Props = {
  activeStep: ComicStandaloneStepId;
  stepHrefs?: Partial<Record<ComicStandaloneStepId, string>>;
  className?: string;
  compact?: boolean;
  linkPendingSteps?: boolean;
  /** 首页宣传：展示完整流程说明，无进度高亮与跳转 */
  promotional?: boolean;
};

export function ComicStandaloneChain({
  activeStep,
  stepHrefs,
  className = "",
  compact = false,
  linkPendingSteps = false,
  promotional = false,
}: Props) {
  const t = useTranslations("comicStandaloneChain");
  const locale = useLocale() as AppLocale;
  const activeIdx = STEPS.findIndex((s) => s.id === activeStep);

  const list = (
    <ol
      className={
        compact
          ? "mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          : "mt-4 space-y-2"
      }
    >
      {STEPS.map((step, idx) => {
        const state = promotional
          ? "neutral"
          : idx < activeIdx
            ? "done"
            : idx === activeIdx
              ? "active"
              : "pending";
        const hrefRaw = stepHrefs?.[step.id] ?? step.href;
        const href = hrefRaw ? withLocalePath(hrefRaw, locale) : undefined;
        const canLink = !promotional && Boolean(href && (state !== "pending" || linkPendingSteps));

        const body = (
          <div
            className={
              compact
                ? `flex min-w-[9.5rem] shrink-0 flex-col gap-1 rounded-xl border px-3 py-2 transition ${
                    state === "active"
                      ? "border-[color:color-mix(in_srgb,var(--gc-accent)_45%,var(--gc-border))] bg-[color:color-mix(in_srgb,var(--gc-accent)_10%,transparent)]"
                      : state === "done"
                        ? "border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)]"
                        : "border-[color:var(--gc-border)] bg-transparent opacity-80"
                  }`
                : `flex gap-3 rounded-xl border px-3 py-2.5 transition ${
                    state === "active"
                      ? "border-[color:color-mix(in_srgb,var(--gc-accent)_45%,var(--gc-border))] bg-[color:color-mix(in_srgb,var(--gc-accent)_10%,transparent)]"
                      : state === "done"
                        ? "border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] opacity-90"
                        : state === "neutral"
                          ? "border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)]"
                          : "border-[color:var(--gc-border)] bg-transparent opacity-75"
                  }`
            }
          >
            <div className="flex items-center gap-2">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  state === "active"
                    ? "bg-[var(--gc-accent)] text-white"
                    : state === "done"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : state === "neutral"
                        ? "bg-[color:color-mix(in_srgb,var(--gc-accent)_15%,var(--gc-bg-elevated))] text-[var(--gc-muted)]"
                        : "bg-[var(--gc-bg-elevated)] text-[var(--gc-text-faint)]"
                }`}
              >
                {state === "done" ? "✓" : idx + 1}
              </span>
              <p className={`font-medium text-[var(--gc-text)] ${compact ? "text-xs" : "text-sm"}`}>
                {t(step.titleKey)}
              </p>
            </div>
            {!compact ? (
              <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--gc-muted)] sm:pl-8">
                {t(step.descKey)}
              </p>
            ) : null}
          </div>
        );

        return (
          <li key={step.id}>
            {canLink ? (
              <Link href={href!} className="block hover:brightness-105">
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ol>
  );

  return (
    <section
      className={`rounded-2xl border border-[color:color-mix(in_srgb,var(--gc-accent)_18%,var(--gc-border))] bg-[color:color-mix(in_srgb,var(--gc-accent)_5%,var(--gc-surface-glass))] ${compact ? "p-3 sm:p-4" : "p-4 sm:p-5"} ${className}`}
      data-testid="comic-standalone-chain"
    >
      {!compact ? (
        promotional ? (
          <p className="text-sm font-semibold text-[var(--gc-text)]">{t("compactTitle")}</p>
        ) : (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:color-mix(in_srgb,var(--gc-accent)_85%,white)]">
              {t("eyebrow")}
            </p>
            <h2 className="mt-1 text-base font-semibold text-[var(--gc-text)]">{t("title")}</h2>
            <p className="mt-1 text-xs leading-relaxed text-[var(--gc-muted)]">{t("subtitle")}</p>
          </>
        )
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-[var(--gc-text)]">{t("compactTitle")}</p>
          <p className="text-[10px] text-[var(--gc-muted)]">{t("compactHint")}</p>
        </div>
      )}
      {list}
    </section>
  );
}
