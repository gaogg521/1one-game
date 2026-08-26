import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { AppMain, AppPageShell } from "@/components/AppPageShell";
import { SiteHeader } from "@/components/SiteHeader";
import { HomeHero } from "@/components/HomeHero";
import { HomeCreateLanes } from "@/components/HomeCreateLanes";
import { HomeFeaturedSections } from "@/components/HomeFeaturedSections";
import { HomeLiteraryPipelineSection } from "@/components/HomeLiteraryPipelineSection";
import { MobileFeedPromoStrip } from "@/components/mobile/MobileFeedPromoStrip";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

export default async function Home() {
  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations();

  return (
    <AppPageShell>
      <SiteHeader />
      <AppMain>
        <main className="@container/main relative flex min-h-full w-full flex-col">
          <HomeHero />
          <HomeCreateLanes />

          <div className="px-5 sm:px-10 lg:px-14 xl:px-20 2xl:px-28">
            <MobileFeedPromoStrip />
          </div>

          <HomeFeaturedSections />

          <section className="px-5 py-16 sm:px-10 sm:py-20 lg:px-14 lg:py-24 xl:px-20 2xl:px-28">
            <div className="mx-auto max-w-6xl">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-[var(--gc-text-faint)]">
                    {t("home.literaryPipelineLabel")}
                  </p>
                  <h2 className="mt-3 text-2xl font-medium tracking-tight text-[var(--gc-text)] sm:text-3xl">
                    {t("home.strategyTitle")}
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--gc-muted)] sm:text-base">
                    {t("home.literaryPipelineDesc")}
                  </p>
                </div>
                <Link
                  href={withLocalePath("/start", locale)}
                  className="self-start rounded-full border border-[color:color-mix(in_srgb,var(--gc-accent)_35%,transparent)] px-5 py-2 text-sm font-medium text-[color:color-mix(in_srgb,var(--gc-accent)_95%,white)] hover:bg-[color:color-mix(in_srgb,var(--gc-accent)_10%,transparent)] lg:self-auto"
                >
                  {t("home.enterLauncher")}
                </Link>
              </div>
              <HomeLiteraryPipelineSection />
            </div>
          </section>

          <section className="mt-auto border-t border-[color:var(--gc-border)] px-5 py-16 sm:px-10 sm:py-20 lg:px-14 xl:px-20 2xl:px-28">
            <div className="mx-auto max-w-6xl">
              <p
                className="font-medium tracking-tight text-[var(--gc-text)]"
                style={{ fontSize: "clamp(1.5rem, 0.7rem + 2.4cqi, 2.75rem)", lineHeight: 1.15 }}
              >
                {t("home.ctaTitle")}
              </p>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[var(--gc-muted)] sm:text-base">
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
