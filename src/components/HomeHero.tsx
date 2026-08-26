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
import { sampleProjectId } from "@/lib/sample-gallery";

/** 电影感单幅首屏：品牌 + 承诺 + CTA；右侧真实作品舞台，不做廉价拼贴。 */
export function HomeHero() {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("home");
  const promise = getProductPromise(locale);
  const stage = useMemo(() => getLocalizedSamplesByShelf("featured", locale).slice(0, 3), [locale]);
  const lead = stage[0];
  const orbit = stage.slice(1, 3);

  return (
    <section className="relative isolate overflow-hidden">
      <div aria-hidden className="absolute inset-0">
        {lead ? (
          <>
            <div className="absolute inset-0" style={{ background: lead.coverGradient }} />
            <Image
              src={lead.coverImageSrc}
              alt=""
              fill
              priority
              sizes="100vw"
              unoptimized
              className="gc-home-hero-drift object-cover object-center opacity-55"
            />
          </>
        ) : (
          <div className="absolute inset-0 bg-[var(--gc-bg)]" />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(105deg,rgba(2,8,20,0.92)_0%,rgba(2,8,20,0.78)_42%,rgba(2,8,20,0.45)_68%,rgba(2,8,20,0.72)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[var(--gc-bg)] to-transparent" />
        <div className="gc-home-noise absolute inset-0 opacity-30" />
      </div>

      <div className="relative z-10 mx-auto grid min-h-[min(88dvh,820px)] w-full max-w-6xl items-center gap-10 px-5 pb-28 pt-24 sm:px-10 sm:pb-32 sm:pt-28 lg:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.95fr)] lg:gap-12 lg:px-14 lg:pb-36">
        <div className="min-w-0">
          <p className="gc-home-reveal text-[11px] font-medium uppercase tracking-[0.42em] text-white/65">
            {t("platformLabel")}
          </p>
          <p
            className="gc-home-reveal gc-home-reveal-delay-1 mt-5 font-semibold tracking-[-0.045em] text-white"
            style={{ fontSize: "clamp(3rem, 1.4rem + 5.5vw, 5.25rem)", lineHeight: 0.92 }}
          >
            {BRAND_NAME}
          </p>
          <h1
            className="gc-home-reveal gc-home-reveal-delay-2 mt-6 max-w-xl text-pretty font-medium tracking-[-0.02em] text-white"
            style={{ fontSize: "clamp(1.25rem, 0.9rem + 1.4vw, 1.85rem)", lineHeight: 1.3 }}
          >
            {promise.headline}
          </h1>
          <p className="gc-home-reveal gc-home-reveal-delay-3 mt-4 max-w-lg text-pretty text-[15px] leading-relaxed text-white/72 sm:text-base sm:leading-7">
            {promise.subhead}
          </p>
          <div className="gc-home-reveal gc-home-reveal-delay-4 mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <Link
              href={withLocalePath("/start", locale)}
              className="gc-theme-cta gc-home-cta-pulse inline-flex min-h-[52px] items-center justify-center px-8 py-3.5 text-sm font-semibold"
            >
              {promise.primaryCta}
            </Link>
            <Link
              href={withLocalePath("/samples", locale)}
              className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-white/20 bg-white/[0.06] px-8 py-3.5 text-sm font-medium text-white backdrop-blur-md transition duration-300 hover:border-white/40 hover:bg-white/[0.12]"
            >
              {promise.secondaryCta}
            </Link>
          </div>
        </div>

        {lead ? (
          <div className="gc-home-reveal gc-home-reveal-delay-3 relative mx-auto hidden w-full max-w-md lg:mx-0 lg:block lg:max-w-none">
            <Link
              href={withLocalePath(`/play/${sampleProjectId(lead.id)}`, locale)}
              className="group relative block overflow-hidden rounded-[1.35rem] border border-white/15 bg-black/30 shadow-[0_40px_100px_-40px_rgba(0,0,0,0.9)] backdrop-blur-sm transition duration-500 hover:-translate-y-1 hover:border-white/30 hover:shadow-[0_48px_120px_-36px_rgba(0,0,0,0.95)]"
            >
              <div className="relative aspect-[16/11] w-full">
                <div className="absolute inset-0" style={{ background: lead.coverGradient }} />
                <Image
                  src={lead.coverImageSrc}
                  alt={lead.coverAlt}
                  fill
                  sizes="(min-width: 1024px) 28vw, 90vw"
                  unoptimized
                  className="object-cover object-center transition duration-700 group-hover:scale-[1.04]"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_45%,rgba(0,0,0,0.78)_100%)]" />
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <p className="text-lg font-semibold text-white">{lead.title}</p>
                  <p className="mt-1 text-sm text-white/70">{lead.plays}</p>
                </div>
                <span className="absolute right-4 top-4 rounded-full border border-white/20 bg-black/35 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-white/85 backdrop-blur-md transition group-hover:bg-white/15">
                  Play
                </span>
              </div>
            </Link>

            <div className="pointer-events-none absolute -bottom-8 -left-6 flex gap-3">
              {orbit.map((sample, index) => (
                <div
                  key={sample.id}
                  className={`gc-home-float relative h-24 w-20 overflow-hidden rounded-xl border border-white/20 shadow-2xl ${index === 1 ? "gc-home-float-delay mt-6" : ""}`}
                >
                  <div className="absolute inset-0" style={{ background: sample.coverGradient }} />
                  <Image src={sample.coverImageSrc} alt="" fill sizes="80px" unoptimized className="object-cover" />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
