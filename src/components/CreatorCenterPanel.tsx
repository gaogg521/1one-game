"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

type WorkSnapshot = {
  id: string;
  title: string;
  type: "project" | "novel" | "comic";
  coverPath: string | null;
  status: string;
  likeCount: number;
  updatedAt: string;
  lastRefinement?: { mode: "patch" | "regenerate"; instruction: string };
};

function workHref(type: WorkSnapshot["type"], id: string, locale: AppLocale) {
  switch (type) {
    case "novel":
      return withLocalePath(`/novel/${id}`, locale);
    case "comic":
      return withLocalePath(`/comic/${id}`, locale);
    default:
      return withLocalePath(`/play/${id}`, locale);
  }
}

export function CreatorCenterPanel({ works }: { works: WorkSnapshot[] }) {
  const t = useTranslations("studio");
  const locale = useLocale() as AppLocale;

  if (works.length === 0) return null;

  const recent = works.slice(0, 3);
  const needsCover = works.filter((w) => !w.coverPath).slice(0, 3);
  const worthPolish = [...works]
    .filter((w) => w.likeCount > 0 || w.status !== "ready" || w.lastRefinement)
    .sort((a, b) => b.likeCount - a.likeCount)
    .slice(0, 2);

  function typeLabel(type: WorkSnapshot["type"]) {
    switch (type) {
      case "novel":
        return t("workType.novel");
      case "comic":
        return t("workType.comic");
      default:
        return t("workType.project");
    }
  }

  return (
    <section className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-5">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--gc-text-faint)]">{t("recent")}</p>
        <ul className="mt-3 space-y-2">
          {recent.map((w) => (
            <li key={`${w.type}-${w.id}`}>
              <Link
                href={workHref(w.type, w.id, locale)}
                className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm text-[var(--gc-text-soft)] hover:bg-[color:color-mix(in_srgb,var(--gc-accent)_8%,transparent)] hover:text-[var(--gc-text)]"
              >
                <span className="line-clamp-1">{w.title}</span>
                <span className="shrink-0 text-[10px] text-[var(--gc-text-faint)]">{typeLabel(w.type)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-5">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--gc-text-faint)]">{t("todo")}</p>
        {needsCover.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--gc-muted)]">{t("coversReady")}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {needsCover.map((w) => (
              <li key={`cover-${w.type}-${w.id}`}>
                <Link
                  href={workHref(w.type, w.id, locale)}
                  className="block rounded-lg px-2 py-1.5 text-sm text-[var(--gc-text-soft)] hover:bg-[color:color-mix(in_srgb,var(--gc-accent)_8%,transparent)]"
                >
                  <span className="line-clamp-1">{w.title}</span>
                  <span className="text-[10px] text-amber-400/90">{t("fixCover")}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-[color:color-mix(in_srgb,var(--gc-accent)_22%,var(--gc-border))] bg-[color:color-mix(in_srgb,var(--gc-accent)_6%,var(--gc-surface-glass))] p-5">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--gc-text-faint)]">{t("nextStep")}</p>
        {worthPolish.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--gc-muted)]">
            {t("launcherHint")}
            <Link
              href={withLocalePath("/start", locale)}
              className="mx-1 text-[color:color-mix(in_srgb,var(--gc-accent)_90%,white)] underline-offset-2 hover:underline"
            >
              {t("launcherLink")}
            </Link>
            {t("launcherTail")}
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {worthPolish.map((w) => (
              <li key={`polish-${w.type}-${w.id}`}>
                <Link
                  href={workHref(w.type, w.id, locale)}
                  className="block rounded-lg px-2 py-1.5 text-sm text-[var(--gc-text-soft)] hover:bg-[color:color-mix(in_srgb,var(--gc-accent)_10%,transparent)]"
                >
                  <span className="line-clamp-1">{w.title}</span>
                  <span className="text-[10px] text-[var(--gc-muted)]">
                    {w.lastRefinement
                      ? w.lastRefinement.mode === "regenerate"
                        ? t("lastRefinementRegen", { instruction: w.lastRefinement.instruction })
                        : t("lastRefinementPatch", { instruction: w.lastRefinement.instruction })
                      : w.likeCount > 0
                        ? t("worthPolish", { count: w.likeCount })
                        : t("draftOrPublish")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={withLocalePath("/discover", locale)}
            className="rounded-full border border-[color:var(--gc-border)] px-3 py-1 text-[11px] text-[var(--gc-muted)] hover:text-[var(--gc-text)]"
          >
            {t("goRemix")}
          </Link>
          <Link
            href={withLocalePath("/start", locale)}
            className="rounded-full border border-[color:color-mix(in_srgb,var(--gc-accent)_35%,transparent)] px-3 py-1 text-[11px] text-[color:color-mix(in_srgb,var(--gc-accent)_90%,white)]"
          >
            {t("createWork")}
          </Link>
        </div>
      </div>
    </section>
  );
}
