import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { AppMain, AppPageShell } from "@/components/AppPageShell";
import { SiteHeader } from "@/components/SiteHeader";
import { FeaturedGamesSection } from "@/components/FeaturedGamesSection";
import { FeaturedNovelsSection } from "@/components/FeaturedNovelsSection";
import { FeaturedComicsSection } from "@/components/FeaturedComicsSection";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getProductPromise, getWowSteps } from "@/lib/product-ia";

export default async function Home() {
  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations();
  const productPromise = getProductPromise(locale);
  const wowSteps = getWowSteps(locale);
  const pillars = [
    {
      en: "Wow",
      title: t("home.pillars.wowTitle"),
      body: t("home.pillars.wowBody"),
    },
    {
      en: "Depth",
      title: t("home.pillars.depthTitle"),
      body: t("home.pillars.depthBody"),
    },
    {
      en: "Community",
      title: t("home.pillars.communityTitle"),
      body: t("home.pillars.communityBody"),
    },
  ] as const;
  return (
    <AppPageShell>
      <SiteHeader />
      <AppMain>
      <main className="@container/main relative flex min-h-full w-full flex-col">
        <section className="relative min-h-[min(92vh,880px)] overflow-hidden px-6 pb-24 pt-20 sm:px-10 sm:pb-28 sm:pt-24 lg:min-h-[min(88vh,920px)] lg:px-14 lg:pb-32 lg:pt-28 xl:px-20 2xl:px-28">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_70%_at_50%_-30%,rgba(124,58,237,0.18),transparent_55%),radial-gradient(ellipse_80%_50%_at_100%_10%,rgba(34,211,238,0.1),transparent_50%),radial-gradient(ellipse_70%_45%_at_0%_80%,rgba(244,114,182,0.06),transparent_50%)]" />
            <div className="gc-home-noise" />
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[var(--gc-bg)] to-transparent" />
          </div>

          <div className="relative grid min-w-0 gap-16 xl:grid-cols-[minmax(0,1fr)_minmax(300px,420px)] xl:items-start xl:gap-x-16 2xl:gap-x-24">
            <div className="min-w-0 pl-0 xl:pl-8 2xl:pl-10">
              <p className="inline-flex items-center gap-2 rounded-full border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.32em] text-[var(--gc-muted)] shadow-[0_0_40px_-12px_rgba(139,92,246,0.35)] backdrop-blur-sm">
                <span
                  className="h-1 w-1 rounded-full shadow-[0_0_10px_color-mix(in_srgb,var(--gc-cta-b)_60%,transparent)]"
                  style={{ background: "linear-gradient(90deg, var(--gc-cta-a), var(--gc-cta-c))" }}
                />
                {t("home.badge")}
              </p>

              <h1
                className="gc-theme-hero mt-10 max-w-3xl text-pretty bg-gradient-to-br from-[var(--gc-text)] via-[var(--gc-text-soft)] to-[var(--gc-muted)] bg-clip-text py-2 font-normal leading-[1.12] tracking-[0.02em] text-transparent sm:mt-12 [filter:drop-shadow(0_4px_48px_color-mix(in_srgb,var(--gc-text)_14%,transparent))]"
                style={{ fontSize: "clamp(1.5rem, 0.5rem + 2.8cqi, 3.75rem)" }}
              >
                {productPromise.headline}
              </h1>

              <p className="mt-8 max-w-2xl text-pretty text-[15px] leading-[1.8] text-[var(--gc-muted)] sm:text-base lg:mt-10 lg:text-[17px] lg:leading-8">
                {productPromise.subhead}
              </p>

              <div className="mt-12 flex flex-wrap items-center gap-3 sm:mt-14 sm:gap-4">
                <Link
                  href={withLocalePath("/start", locale)}
                  className="gc-theme-cta inline-flex items-center justify-center px-9 py-4 text-sm font-semibold transition duration-300 hover:scale-[1.02]"
                >
                  {productPromise.primaryCta}
                </Link>
                <Link
                  href={withLocalePath("/samples", locale)}
                  className="inline-flex items-center justify-center rounded-full border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-8 py-4 text-sm font-medium text-[var(--gc-text)] shadow-[inset_0_1px_0_color-mix(in_srgb,var(--gc-text)_10%,transparent)] backdrop-blur-md transition duration-300 hover:border-[color:color-mix(in_srgb,var(--gc-accent)_35%,var(--gc-border))] hover:bg-[var(--gc-surface-glass-strong)]"
                >
                  {productPromise.secondaryCta}
                </Link>
                <Link
                  href={withLocalePath("/studio", locale)}
                  className="inline-flex items-center justify-center rounded-full px-7 py-4 text-sm font-medium text-[var(--gc-muted)] transition duration-300 hover:text-[var(--gc-text)]"
                >
                  {t("home.workspaceCta")}
                </Link>
              </div>
            </div>

            <aside className="relative min-w-0 rounded-3xl border border-[color:var(--gc-border)] bg-gradient-to-b from-[var(--gc-surface-glass-strong)] via-[var(--gc-surface-glass)] to-transparent p-8 shadow-[0_0_0_1px_rgba(0,0,0,0.35),0_32px_64px_-28px_rgba(0,0,0,0.55),0_0_80px_-30px_rgba(124,58,237,0.25)] backdrop-blur-xl sm:p-9 xl:p-10">
              <h2 className="text-[13px] font-medium uppercase tracking-[0.2em] text-[var(--gc-muted)]">{t("home.firstExperience")}</h2>
              <p className="mt-2 text-base font-medium tracking-wide text-[var(--gc-text)]">{t("home.wowMoment")}</p>
              <ol className="mt-8 space-y-7 border-t border-[color:var(--gc-border)] pt-8">
                {wowSteps.map((step) => (
                  <li key={step.n} className="group flex gap-4">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] font-mono text-[11px] tabular-nums text-[var(--gc-muted)] transition group-hover:border-[color:color-mix(in_srgb,var(--gc-accent)_35%,transparent)] group-hover:text-[color:color-mix(in_srgb,var(--gc-accent)_90%,var(--gc-text))]">
                      {step.n}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-[var(--gc-text-soft)]">{step.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-[var(--gc-muted)]">{step.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="mt-8 rounded-2xl border border-[color:var(--gc-border)] bg-[color:color-mix(in_srgb,var(--gc-bg-elevated)_75%,transparent)] p-5">
                <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--gc-text-faint)]">{t("home.dualProduct")}</p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--gc-muted)]">
                  {t("home.dualProductDesc")}
                </p>
              </div>
            </aside>
          </div>
        </section>

        <div className="relative mx-6 h-px shrink-0 sm:mx-10 lg:mx-14 xl:mx-20 2xl:mx-28">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-[color:color-mix(in_srgb,var(--gc-muted)_35%,transparent)] to-transparent" />
        </div>

        <section className="px-6 py-20 sm:px-10 sm:py-24 lg:px-14 lg:py-28 xl:px-20 2xl:px-28">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-[var(--gc-text-faint)]">{t("home.strategy")}</p>
              <h2 className="mt-2 text-2xl font-medium tracking-tight text-[var(--gc-text)] sm:text-3xl">{t("home.strategyTitle")}</h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--gc-muted)] sm:text-base">
                {t("home.strategyDesc")}
              </p>
            </div>
            <Link
              href={withLocalePath("/start", locale)}
              className="self-start rounded-full border border-[color:color-mix(in_srgb,var(--gc-accent)_35%,transparent)] px-5 py-2 text-sm font-medium text-[color:color-mix(in_srgb,var(--gc-accent)_95%,white)] hover:bg-[color:color-mix(in_srgb,var(--gc-accent)_10%,transparent)] lg:self-auto"
            >
              {t("home.enterLauncher")}
            </Link>
          </div>

          <div className="mt-14 grid gap-6 sm:mt-16 sm:grid-cols-2 lg:mt-20 lg:grid-cols-3 lg:gap-8">
            {pillars.map((item) => (
              <div
                key={item.en}
                className="group relative overflow-hidden rounded-2xl border border-[color:var(--gc-border)] bg-gradient-to-b from-[var(--gc-surface-glass-strong)] to-transparent p-8 transition duration-500 hover:border-[color:color-mix(in_srgb,var(--gc-accent)_28%,var(--gc-border))]"
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--gc-text-faint)]">{item.en}</p>
                <h3 className="relative mt-4 text-lg font-medium tracking-tight text-[var(--gc-text)]">{item.title}</h3>
                <p className="relative mt-4 text-sm leading-relaxed text-[var(--gc-muted)] lg:text-[15px] lg:leading-7">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <FeaturedGamesSection />
        <FeaturedNovelsSection />
        <FeaturedComicsSection />

        <section className="mt-auto border-t border-[color:var(--gc-border)] px-6 py-16 sm:px-10 sm:py-20 lg:px-14 lg:py-20 xl:px-20 2xl:px-28">
          <div className="max-w-4xl">
            <p
              className="gc-theme-hero bg-gradient-to-r from-[var(--gc-text)] via-[var(--gc-text-soft)] to-[var(--gc-muted)] bg-clip-text font-normal leading-tight text-transparent"
              style={{ fontSize: "clamp(1.35rem, 0.55rem + 2.2cqi, 2.65rem)" }}
            >
              {t("home.ctaTitle")}
            </p>
            <p className="gc-theme-soft mt-5 max-w-2xl text-[clamp(0.95rem,0.4rem+1.1cqi,1.2rem)] leading-relaxed text-[var(--gc-muted)] sm:mt-6">
              {t("home.ctaDesc")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={withLocalePath("/start", locale)} className="gc-theme-cta rounded-full px-6 py-2.5 text-sm font-semibold">
                {t("common.startCreating")}
              </Link>
              <Link
                href={withLocalePath("/discover", locale)}
                className="rounded-full border border-[color:var(--gc-border)] px-6 py-2.5 text-sm font-medium text-[var(--gc-muted)] hover:text-[var(--gc-text)]"
              >
                {t("common.browseCommunity")}
              </Link>
            </div>
          </div>
        </section>
      </main>
      </AppMain>
    </AppPageShell>
  );
}
