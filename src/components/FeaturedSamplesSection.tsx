"use client";

import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getLocalizedSample, getLocalizedSamplesByShelf } from "@/lib/i18n/samples-localized";
import { deriveFeaturedBlurb } from "@/lib/featured-blurb";
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
    <section className="mt-12 border-t border-[color:var(--gc-border)] px-5 py-12 sm:mt-14 sm:px-10 sm:py-14 lg:px-14 xl:px-20 2xl:px-28">
      <div className="mx-auto max-w-6xl">
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

        <div className="mt-7 grid items-stretch gap-3 lg:grid-cols-12 lg:gap-4">
          {hero ? (
            <SampleShowcaseCard
              sample={getLocalizedSample(hero, locale)}
              locale={locale}
              hero
              className="lg:col-span-7 lg:h-full"
            />
          ) : null}
          <div className="grid h-full grid-cols-2 gap-3 lg:col-span-5 lg:grid-cols-2 lg:grid-rows-2">
            {rest.slice(0, 4).map((s) => (
              <SampleShowcaseCard key={s.id} sample={getLocalizedSample(s, locale)} locale={locale} className="h-full" />
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
  const blurb = deriveFeaturedBlurb(sample.subtitle, sample.prompt);

  return (
    <Link
      href={playHref}
      data-testid={hero ? "home-featured-hero" : undefined}
      className={`group relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] transition duration-500 hover:-translate-y-1 hover:border-[color:color-mix(in_srgb,var(--gc-accent)_40%,var(--gc-border))] hover:shadow-[0_24px_50px_-28px_rgba(0,0,0,0.65)] ${className}`}
    >
      {/*
        主卡在桌面会被右侧 2×2 货架拉高；封面必须跟着铺满，
        否则 Link 多出来的高度会露出卡片灰底（不是留给简介的区域）。
      */}
      <div
        className={`relative w-full flex-1 overflow-hidden bg-[var(--gc-bg-elevated)] ${
          hero
            ? "aspect-[16/10] min-h-[220px] sm:min-h-[300px] lg:aspect-auto lg:min-h-0"
            : "aspect-[4/5] min-h-0"
        }`}
      >
        <div className="absolute inset-0" style={{ background: sample.coverGradient }} />
        {!coverFailed ? (
          <Image
            src={sample.coverImageSrc}
            alt={sample.coverAlt}
            fill
            sizes={hero ? "(min-width: 1024px) 55vw, 92vw" : "(min-width: 1024px) 18vw, 44vw"}
            unoptimized
            className="absolute inset-0 z-[1] h-full w-full object-cover object-[center_58%] transition duration-700 group-hover:scale-[1.05]"
            onError={() => setCoverFailed(true)}
          />
        ) : null}
        <div className="pointer-events-none absolute inset-0 z-[2] bg-[linear-gradient(180deg,transparent_38%,rgba(0,0,0,0.82)_100%)]" />
        <div className="absolute inset-0 z-[2] flex items-center justify-center opacity-0 transition duration-300 group-hover:opacity-100">
          <span
            className={`rounded-full border border-white/30 bg-black/45 font-semibold uppercase tracking-[0.18em] text-white backdrop-blur-md ${
              hero ? "px-5 py-2.5 text-xs" : "px-3 py-1.5 text-[10px]"
            }`}
          >
            Play
          </span>
        </div>
        {/* 字阶随封面尺寸：主卡放大标题/简介，侧卡压缩 */}
        <div
          className={`absolute bottom-0 left-0 right-0 z-[3] ${
            hero ? "p-4 sm:p-5 lg:p-6" : "p-2.5 sm:p-3"
          }`}
        >
          <p
            className={`line-clamp-2 font-semibold leading-tight tracking-tight text-white drop-shadow-sm ${
              hero ? "text-lg sm:text-2xl" : "text-[12px] sm:text-[13px]"
            }`}
          >
            {sample.title}
          </p>
          {blurb ? (
            <p
              className={`mt-1.5 text-white/82 ${
                hero
                  ? "line-clamp-2 max-w-xl text-sm leading-relaxed sm:text-[15px] sm:leading-6"
                  : "line-clamp-2 text-[10px] leading-snug sm:text-[11px]"
              }`}
            >
              {blurb}
            </p>
          ) : null}
          <p
            className={`mt-1.5 font-medium text-white/70 ${
              hero ? "text-sm sm:text-base" : "text-[10px]"
            }`}
          >
            {sample.plays}
          </p>
        </div>
      </div>
    </Link>
  );
}
