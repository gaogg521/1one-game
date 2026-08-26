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

  const [hero, ...rest] = samples;

  return (
    <section className="border-t border-[color:var(--gc-border)] px-5 py-14 sm:px-10 sm:py-20 lg:px-14 lg:py-24 xl:px-20 2xl:px-28">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-[var(--gc-text-faint)]">{t("sampleEyebrow")}</p>
            <h2 className="mt-3 text-2xl font-medium tracking-tight text-[var(--gc-text)] sm:text-3xl">{t("hotSamples")}</h2>
            <p className="mt-2 max-w-xl text-sm text-[var(--gc-muted)]">{t("hotSamplesDesc")}</p>
          </div>
          <Link
            href={withLocalePath("/samples", locale)}
            className="shrink-0 text-xs font-medium text-[var(--gc-muted)] underline-offset-4 hover:text-[var(--gc-text)] hover:underline"
          >
            {t("viewSamplesArrow")}
          </Link>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-12 lg:gap-5">
          {hero ? (
            <SampleShowcaseCard
              sample={getLocalizedSample(hero, locale)}
              locale={locale}
              hero
              className="lg:col-span-7"
            />
          ) : null}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:col-span-5 lg:grid-cols-2 lg:grid-rows-2">
            {rest.slice(0, 4).map((s) => (
              <SampleShowcaseCard key={s.id} sample={getLocalizedSample(s, locale)} locale={locale} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function SampleShowcaseCard({
  sample,
  locale,
  hero = false,
  className = "",
}: {
  sample: ReturnType<typeof getLocalizedSample>;
  locale: AppLocale;
  hero?: boolean;
  className?: string;
}) {
  const [coverFailed, setCoverFailed] = useState(false);
  const playHref = withLocalePath(`/play/${sampleProjectId(sample.id)}`, locale);

  return (
    <Link
      href={playHref}
      data-testid={hero ? "home-featured-hero" : undefined}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] transition duration-300 hover:border-[color:color-mix(in_srgb,var(--gc-accent)_35%,var(--gc-border))] ${className}`}
    >
      <div className={`relative w-full overflow-hidden bg-[var(--gc-bg-elevated)] ${hero ? "aspect-[16/10] min-h-[220px] sm:min-h-[320px]" : "aspect-[4/5]"}`}>
        <div className="absolute inset-0" style={{ background: sample.coverGradient }} />
        {!coverFailed ? (
          <Image
            src={sample.coverImageSrc}
            alt={sample.coverAlt}
            fill
            sizes={hero ? "(min-width: 1024px) 55vw, 92vw" : "(min-width: 1024px) 18vw, 44vw"}
            unoptimized
            className="absolute inset-0 z-[1] h-full w-full object-cover object-[center_58%] transition duration-700 group-hover:scale-[1.04]"
            onError={() => setCoverFailed(true)}
          />
        ) : null}
        <div className="pointer-events-none absolute inset-0 z-[2] bg-[linear-gradient(180deg,transparent_42%,rgba(0,0,0,0.78)_100%)]" />
        <div className="absolute bottom-0 left-0 right-0 z-[3] p-3 sm:p-4">
          <p className={`line-clamp-2 font-semibold leading-tight text-white drop-shadow-sm ${hero ? "text-base sm:text-xl" : "text-xs"}`}>
            {sample.title}
          </p>
          <p className={`mt-1 line-clamp-1 text-white/75 ${hero ? "text-sm" : "text-[10px]"}`}>{sample.plays}</p>
        </div>
      </div>
    </Link>
  );
}
