"use client";

import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getLocalizedSample, getLocalizedSamplesByShelf } from "@/lib/i18n/samples-localized";
import { deriveFeaturedBlurb } from "@/lib/featured-blurb";
import { buildCreatePrefillPath } from "@/lib/sample-create-prefill";
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
            <SampleHeroCard
              sample={getLocalizedSample(hero, locale)}
              locale={locale}
              className="lg:col-span-7"
            />
          ) : null}
          <div className="grid h-full grid-cols-2 gap-3 lg:col-span-5 lg:grid-cols-2 lg:grid-rows-2">
            {rest.slice(0, 4).map((s) => (
              <SampleSideCard key={s.id} sample={getLocalizedSample(s, locale)} locale={locale} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function SampleHeroCard({
  sample,
  locale,
  className = "",
}: {
  sample: ReturnType<typeof getLocalizedSample>;
  locale: AppLocale;
  className?: string;
}) {
  const t = useTranslations("featured");
  const [coverFailed, setCoverFailed] = useState(false);
  const playHref = withLocalePath(`/play/${sampleProjectId(sample.id)}`, locale);
  const remixHref = buildCreatePrefillPath(sample.prompt, locale);
  const blurb = deriveFeaturedBlurb(sample.prompt, sample.subtitle);
  const tags = sample.tags.slice(0, 4);

  return (
    <article
      data-testid="home-featured-hero"
      className={`group flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] transition duration-500 hover:border-[color:color-mix(in_srgb,var(--gc-accent)_40%,var(--gc-border))] hover:shadow-[0_24px_50px_-28px_rgba(0,0,0,0.65)] ${className}`}
    >
      <Link
        href={playHref}
        className="relative block aspect-[16/10] min-h-[200px] w-full shrink-0 overflow-hidden bg-[var(--gc-bg-elevated)] sm:min-h-[260px]"
      >
        <div className="absolute inset-0" style={{ background: sample.coverGradient }} />
        {!coverFailed ? (
          <Image
            src={sample.coverImageSrc}
            alt={sample.coverAlt}
            fill
            sizes="(min-width: 1024px) 55vw, 92vw"
            unoptimized
            className="absolute inset-0 z-[1] h-full w-full object-cover object-[center_58%] transition duration-700 group-hover:scale-[1.04]"
            onError={() => setCoverFailed(true)}
          />
        ) : null}
        <div className="pointer-events-none absolute inset-0 z-[2] bg-[linear-gradient(180deg,transparent_55%,rgba(0,0,0,0.45)_100%)]" />
        <div className="absolute inset-0 z-[2] flex items-center justify-center opacity-0 transition duration-300 group-hover:opacity-100">
          <span className="rounded-full border border-white/30 bg-black/45 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-white backdrop-blur-md">
            Play
          </span>
        </div>
        {sample.badge ? (
          <span className="absolute left-3 top-3 z-[3] rounded-md bg-emerald-500/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-md">
            {sample.badge === "hot" ? "HOT" : "NEW"}
          </span>
        ) : null}
        <span className="absolute bottom-3 left-3 z-[3] rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-white backdrop-blur-md">
          {sample.plays}
        </span>
      </Link>

      {/* 故意保留的下方内容区：钩子文案 + 标签 + 双 CTA，承接被拉高的主卡高度 */}
      <div className="flex min-h-0 flex-1 flex-col justify-between gap-4 px-4 py-4 sm:px-5 sm:py-5">
        <div className="min-h-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--gc-text-faint)]">
            {t("sampleHeroHook")}
          </p>
          <h3 className="mt-1.5 text-lg font-semibold tracking-tight text-[var(--gc-text)] sm:text-xl">
            <Link href={playHref} className="transition hover:text-[var(--gc-accent)]">
              {sample.title}
            </Link>
          </h3>
          {blurb ? (
            <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[var(--gc-muted)] sm:text-[15px] sm:leading-6">
              {blurb}
            </p>
          ) : null}
          {tags.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-[color:var(--gc-border)] bg-[color:color-mix(in_srgb,var(--gc-bg)_70%,transparent)] px-2.5 py-0.5 text-[11px] text-[var(--gc-muted)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Link
            href={playHref}
            className="inline-flex flex-1 items-center justify-center rounded-full bg-[var(--gc-accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
          >
            {t("ctaPlay")}
          </Link>
          <Link
            href={remixHref}
            className="inline-flex flex-1 items-center justify-center rounded-full border border-[color:var(--gc-border)] bg-transparent px-4 py-2.5 text-sm font-medium text-[var(--gc-text)] transition hover:border-[color:color-mix(in_srgb,var(--gc-accent)_45%,var(--gc-border))] hover:text-[var(--gc-accent)]"
          >
            {t("sampleRemix")}
          </Link>
        </div>
        <p className="text-[11px] text-[var(--gc-text-faint)]">{t("samplePlaysLabel", { plays: sample.plays })}</p>
      </div>
    </article>
  );
}

function SampleSideCard({
  sample,
  locale,
}: {
  sample: ReturnType<typeof getLocalizedSample>;
  locale: AppLocale;
}) {
  const [coverFailed, setCoverFailed] = useState(false);
  const playHref = withLocalePath(`/play/${sampleProjectId(sample.id)}`, locale);
  const blurb = deriveFeaturedBlurb(sample.subtitle, sample.prompt);

  return (
    <Link
      href={playHref}
      className="group relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] transition duration-500 hover:-translate-y-1 hover:border-[color:color-mix(in_srgb,var(--gc-accent)_40%,var(--gc-border))] hover:shadow-[0_24px_50px_-28px_rgba(0,0,0,0.65)]"
    >
      <div className="relative aspect-[4/5] min-h-0 w-full flex-1 overflow-hidden bg-[var(--gc-bg-elevated)]">
        <div className="absolute inset-0" style={{ background: sample.coverGradient }} />
        {!coverFailed ? (
          <Image
            src={sample.coverImageSrc}
            alt={sample.coverAlt}
            fill
            sizes="(min-width: 1024px) 18vw, 44vw"
            unoptimized
            className="absolute inset-0 z-[1] h-full w-full object-cover object-[center_58%] transition duration-700 group-hover:scale-[1.05]"
            onError={() => setCoverFailed(true)}
          />
        ) : null}
        <div className="pointer-events-none absolute inset-0 z-[2] bg-[linear-gradient(180deg,transparent_38%,rgba(0,0,0,0.82)_100%)]" />
        <div className="absolute inset-0 z-[2] flex items-center justify-center opacity-0 transition duration-300 group-hover:opacity-100">
          <span className="rounded-full border border-white/30 bg-black/45 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur-md">
            Play
          </span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 z-[3] p-2.5 sm:p-3">
          <p className="line-clamp-2 text-[12px] font-semibold leading-tight tracking-tight text-white drop-shadow-sm sm:text-[13px]">
            {sample.title}
          </p>
          {blurb ? (
            <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-white/82 sm:text-[11px]">{blurb}</p>
          ) : null}
          <p className="mt-1.5 text-[10px] font-medium text-white/70">{sample.plays}</p>
        </div>
      </div>
    </Link>
  );
}
