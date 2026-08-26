"use client";

import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import { BRAND_NAME } from "@/lib/brand";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getLocalizedSamplesByShelf } from "@/lib/i18n/samples-localized";
import { getProductPromise } from "@/lib/product-ia";

/** 首屏：品牌级信号 + 一句承诺 + CTA，真实作品做全幅视觉证明（对标 Midjourney / Runway）。 */
export function HomeHero() {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("home");
  const promise = getProductPromise(locale);
  const stage = useMemo(() => getLocalizedSamplesByShelf("featured", locale).slice(0, 4), [locale]);
  const lead = stage[0];
  const rest = stage.slice(1);

  return (
    <section className="relative isolate min-h-[100dvh] overflow-hidden sm:min-h-[min(100dvh,920px)]">
      <div aria-hidden className="absolute inset-0">
        <div className="hidden h-full w-full sm:grid sm:grid-cols-4">
          {lead ? (
            <div className="relative col-span-2 overflow-hidden">
              <div className="absolute inset-0" style={{ background: lead.coverGradient }} />
              <Image
                src={lead.coverImageSrc}
                alt=""
                fill
                priority
                sizes="50vw"
                unoptimized
                className="gc-home-hero-pan object-cover object-center"
              />
            </div>
          ) : null}
          {rest.map((sample) => (
            <div key={sample.id} className="relative overflow-hidden">
              <div className="absolute inset-0" style={{ background: sample.coverGradient }} />
              <Image
                src={sample.coverImageSrc}
                alt=""
                fill
                sizes="25vw"
                unoptimized
                className="gc-home-hero-pan object-cover object-center"
              />
            </div>
          ))}
        </div>
        {lead ? (
          <div className="absolute inset-0 sm:hidden">
            <div className="absolute inset-0" style={{ background: lead.coverGradient }} />
            <Image
              src={lead.coverImageSrc}
              alt=""
              fill
              priority
              sizes="100vw"
              unoptimized
              className="gc-home-hero-pan object-cover object-[center_40%]"
            />
          </div>
        ) : (
          <div className="absolute inset-0 bg-[var(--gc-bg)]" />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.52)_0%,rgba(0,0,0,0.38)_40%,rgba(0,0,0,0.82)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_15%,transparent_0%,rgba(0,0,0,0.4)_100%)]" />
        <div className="gc-home-noise absolute inset-0 opacity-35" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col justify-end px-5 pb-16 pt-28 sm:min-h-[min(100dvh,920px)] sm:justify-center sm:px-10 sm:pb-24 sm:pt-32 lg:px-14">
        <p className="gc-home-reveal text-[11px] font-medium uppercase tracking-[0.42em] text-white/70">
          {t("platformLabel")}
        </p>
        <p
          className="gc-home-reveal gc-home-reveal-delay-1 mt-4 font-semibold tracking-[-0.04em] text-white"
          style={{ fontSize: "clamp(2.75rem, 1.2rem + 6vw, 5.5rem)", lineHeight: 0.95 }}
        >
          {BRAND_NAME}
        </p>
        <h1
          className="gc-home-reveal gc-home-reveal-delay-2 mt-5 max-w-3xl text-pretty font-medium tracking-[-0.02em] text-white"
          style={{ fontSize: "clamp(1.35rem, 0.85rem + 2vw, 2.15rem)", lineHeight: 1.25 }}
        >
          {promise.headline}
        </h1>
        <p className="gc-home-reveal gc-home-reveal-delay-3 mt-4 max-w-xl text-pretty text-[15px] leading-relaxed text-white/75 sm:text-base sm:leading-7">
          {promise.subhead}
        </p>
        <div className="gc-home-reveal gc-home-reveal-delay-4 mt-9 flex flex-col gap-3 sm:mt-11 sm:flex-row sm:items-center sm:gap-4">
          <Link
            href={withLocalePath("/start", locale)}
            className="gc-theme-cta inline-flex min-h-[52px] items-center justify-center px-8 py-3.5 text-sm font-semibold"
          >
            {promise.primaryCta}
          </Link>
          <Link
            href={withLocalePath("/samples", locale)}
            className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-white/25 bg-white/5 px-8 py-3.5 text-sm font-medium text-white backdrop-blur-md transition hover:border-white/45 hover:bg-white/10"
          >
            {promise.secondaryCta}
          </Link>
        </div>
      </div>
    </section>
  );
}
