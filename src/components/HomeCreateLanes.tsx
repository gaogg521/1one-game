"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getCreationModes, type CreationMode } from "@/lib/product-ia";

const ORDER: CreationMode[] = ["game", "novel", "comic"];

/** 首屏之后唯一职责：让用户选对创作介质。 */
export function HomeCreateLanes() {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("home");
  const modes = getCreationModes(locale);

  return (
    <section className="px-5 py-16 sm:px-10 sm:py-20 lg:px-14 lg:py-24 xl:px-20 2xl:px-28">
      <div className="mx-auto max-w-6xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-[var(--gc-text-faint)]">{t("lanesEyebrow")}</p>
        <h2 className="mt-3 text-2xl font-medium tracking-tight text-[var(--gc-text)] sm:text-3xl">{t("lanesTitle")}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--gc-muted)] sm:text-base">{t("lanesDesc")}</p>

        <div className="mt-10 grid gap-3 sm:mt-12 sm:grid-cols-3 sm:gap-4">
          {ORDER.map((key) => {
            const mode = modes[key];
            return (
              <Link
                key={key}
                href={withLocalePath(mode.href, locale)}
                data-module={key}
                className="group flex min-h-[148px] flex-col justify-between rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-5 py-5 transition duration-300 hover:-translate-y-0.5 hover:border-[color:color-mix(in_srgb,var(--gc-accent)_40%,var(--gc-border))] hover:bg-[var(--gc-surface-glass-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--gc-accent)_45%,transparent)] sm:min-h-[180px] sm:px-6 sm:py-6"
              >
                <div>
                  <p className="text-lg font-semibold tracking-tight text-[var(--gc-text)]">{mode.label}</p>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--gc-muted)]">{mode.tagline}</p>
                </div>
                <div className="mt-6 flex items-center justify-between gap-3">
                  <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--gc-text-faint)]">{mode.eta}</span>
                  <span className="text-sm font-medium text-[var(--gc-text-soft)] transition group-hover:text-[var(--gc-text)]">
                    {mode.wow} →
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
