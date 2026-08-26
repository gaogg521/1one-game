"use client";

import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getLocalizedSample, getLocalizedSamplesByShelf } from "@/lib/i18n/samples-localized";
import { sampleProjectId } from "@/lib/sample-gallery";

const SHOWCASE_COUNT = 6;

export function FeaturedSamplesSection() {
  const t = useTranslations("featured");
  const locale = useLocale() as AppLocale;
  const samples = useMemo(
    () => getLocalizedSamplesByShelf("featured", locale).slice(0, SHOWCASE_COUNT),
    [locale],
  );

  if (samples.length === 0) return null;

  return (
    <section className="border-t border-[color:var(--gc-border)] px-6 py-10 sm:px-10 sm:py-20 lg:px-14 lg:py-20 xl:px-20 2xl:px-28">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-[var(--gc-text-faint)]">{t("sampleEyebrow")}</p>
          <h2 className="mt-2 text-xl font-medium tracking-tight text-[var(--gc-text)] sm:text-2xl">{t("hotSamples")}</h2>
          <p className="mt-2 max-w-xl text-sm text-[var(--gc-muted)]">{t("hotSamplesDesc")}</p>
        </div>
        <Link
          href={withLocalePath("/samples", locale)}
          className="shrink-0 text-xs font-medium text-[var(--gc-muted)] underline-offset-4 hover:text-[var(--gc-text)] hover:underline"
        >
          {t("viewSamplesArrow")}
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:mt-10 lg:grid-cols-6 lg:gap-3">
        {samples.map((s, i) => (
          <SampleShowcaseCard key={s.id} sample={getLocalizedSample(s, locale)} locale={locale} hero={i === 0} />
        ))}
      </div>
    </section>
  );
}

function SampleShowcaseCard({
  sample,
  locale,
  hero = false,
}: {
  sample: ReturnType<typeof getLocalizedSample>;
  locale: AppLocale;
  hero?: boolean;
}) {
  const [coverFailed, setCoverFailed] = useState(false);
  const playHref = withLocalePath(`/play/${sampleProjectId(sample.id)}`, locale);

  return (
    <Link
      href={playHref}
      data-testid={hero ? "home-featured-hero" : undefined}
      className={`group flex flex-col overflow-hidden rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] transition hover:border-[color:color-mix(in_srgb,var(--gc-accent)_35%,var(--gc-border))] hover:shadow-md ${hero ? "col-span-2 sm:col-span-1" : ""}`}
    >
      <div className={`relative w-full overflow-hidden bg-[var(--gc-bg-elevated)] ${hero ? "aspect-[16/10] sm:aspect-[4/5]" : "aspect-[4/5]"}`}>
        <div className="absolute inset-0" style={{ background: sample.coverGradient }} />
        {!coverFailed ? (
          <Image
            src={sample.coverImageSrc}
            alt={sample.coverAlt}
            fill
            sizes={hero ? "(min-width: 1024px) 16vw, 92vw" : "(min-width: 1024px) 16vw, (min-width: 640px) 28vw, 44vw"}
            unoptimized
            className="absolute inset-0 z-[1] h-full w-full object-cover object-[center_58%] transition duration-500 group-hover:scale-[1.04]"
            onError={() => setCoverFailed(true)}
          />
        ) : null}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_45%,rgba(0,0,0,0.75)_100%)]" />
        {sample.badge === "hot" ? (
          <span className="absolute left-2 top-2 rounded-md bg-gradient-to-r from-rose-600 to-amber-500 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
            HOT
          </span>
        ) : null}
        <div className="absolute bottom-2 left-2 right-2">
          <p className={`line-clamp-2 font-semibold leading-tight text-white drop-shadow-sm ${hero ? "text-sm sm:text-xs" : "text-xs"}`}>{sample.title}</p>
          <p className={`mt-0.5 line-clamp-1 text-white/80 ${hero ? "text-xs sm:text-[10px]" : "text-[10px]"}`}>{sample.plays}</p>
        </div>
      </div>
    </Link>
  );
}
