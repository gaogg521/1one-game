"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getCreationModes, type CreationMode } from "@/lib/product-ia";

const ORDER: CreationMode[] = ["game", "novel", "comic"];

const LANE_ACCENT: Record<CreationMode, string> = {
  game: "from-sky-400/80 via-sky-500/30 to-transparent",
  novel: "from-amber-300/75 via-amber-500/25 to-transparent",
  comic: "from-rose-400/80 via-fuchsia-500/25 to-transparent",
};

/** 贴着首屏收口的三条介质入口，消灭大空洞，并给足 hover 反馈。 */
export function HomeCreateLanes() {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("home");
  const modes = getCreationModes(locale);

  return (
    <section className="relative z-20 -mt-16 px-5 sm:-mt-20 sm:px-10 lg:px-14 xl:px-20 2xl:px-28">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex flex-col gap-1 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-[var(--gc-text-faint)]">{t("lanesEyebrow")}</p>
            <h2 className="mt-2 text-xl font-medium tracking-tight text-[var(--gc-text)] sm:text-2xl">{t("lanesTitle")}</h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-[var(--gc-muted)]">{t("lanesDesc")}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
          {ORDER.map((key, index) => {
            const mode = modes[key];
            return (
              <Link
                key={key}
                href={withLocalePath(mode.href, locale)}
                data-module={key}
                style={{ animationDelay: `${0.08 + index * 0.08}s` }}
                className="gc-home-lane group relative flex min-h-[168px] flex-col justify-between overflow-hidden rounded-2xl border border-[color:var(--gc-border)] bg-[color:color-mix(in_srgb,var(--gc-bg-elevated)_88%,transparent)] px-5 py-5 shadow-[0_20px_50px_-36px_rgba(0,0,0,0.75)] backdrop-blur-xl transition duration-500 hover:-translate-y-1.5 hover:border-[color:color-mix(in_srgb,var(--gc-accent)_45%,var(--gc-border))] hover:shadow-[0_28px_60px_-30px_rgba(0,0,0,0.85)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--gc-accent)_45%,transparent)] sm:min-h-[190px] sm:px-6 sm:py-6"
              >
                <div
                  aria-hidden
                  className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${LANE_ACCENT[key]} opacity-80 transition duration-500 group-hover:opacity-100`}
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-[color:color-mix(in_srgb,var(--gc-accent)_14%,transparent)] blur-2xl transition duration-500 group-hover:scale-125 group-hover:opacity-100"
                />
                <div className="relative">
                  <p className="text-lg font-semibold tracking-tight text-[var(--gc-text)]">{mode.label}</p>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--gc-muted)]">{mode.tagline}</p>
                </div>
                <div className="relative mt-8 flex items-center justify-between gap-3">
                  <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--gc-text-faint)]">{mode.eta}</span>
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-[var(--gc-text-soft)] transition duration-300 group-hover:translate-x-1 group-hover:text-[var(--gc-text)]">
                    {mode.wow}
                    <span aria-hidden className="transition duration-300 group-hover:translate-x-0.5">
                      →
                    </span>
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
