import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { SiteFooterGate } from "@/components/SiteFooterGate";
import { MobileBrowseDock } from "@/components/mobile/MobileBrowseDock";
import { AppCapabilitiesRoot } from "@/providers/AppCapabilitiesRoot";
import { localeToHtmlLang, type AppLocale } from "@/i18n/routing";
import { htmlFontVariableClasses } from "@/lib/fonts";
import { THEME_INIT_SCRIPT } from "@/lib/theme-init-script";
import { THEME_META_COLOR, DEFAULT_THEME } from "@/lib/themes";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");

  return {
    title: {
      default: t("siteTitle"),
      template: t("siteTemplate"),
    },
    description: t("siteDescription"),
    openGraph: {
      title: t("siteOgTitle"),
      description: t("siteOgDescription"),
    },
  };
}

export const viewport = {
  themeColor: THEME_META_COLOR[DEFAULT_THEME],
  width: "device-width",
  initialScale: 1,
  /** 刘海屏安全区 env(safe-area-inset-*) 生效需要 cover */
  viewportFit: "cover" as const,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = (await getLocale()) as AppLocale;
  const messages = await getMessages();
  return (
    <html
      lang={localeToHtmlLang(locale)}
      data-theme={DEFAULT_THEME}
      data-scroll-behavior="smooth"
      className={`h-full antialiased ${htmlFontVariableClasses}`.trim()}
      suppressHydrationWarning
    >
      <body className="gc-page-bg relative flex min-h-[100dvh] min-h-full flex-col text-[var(--gc-text)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/* 1oneclaw 同款全站背景层（www/index.html + style.css） */}
        <div className="page-bg-fx" aria-hidden="true">
          <div className="page-bg-fx__mesh" />
          <div className="page-bg-fx__glow page-bg-fx__glow--a" />
          <div className="page-bg-fx__glow page-bg-fx__glow--b" />
          <div className="page-bg-fx__glow page-bg-fx__glow--c" />
          <div className="page-bg-fx__ring" />
          <div className="page-bg-fx__scan" />
        </div>
        <div className="noise" aria-hidden="true" />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AppCapabilitiesRoot>
            <div className="relative z-10 flex min-h-0 flex-1 flex-col">
              <div className="flex min-h-0 flex-1 flex-col pb-[calc(3.25rem+env(safe-area-inset-bottom))] md:pb-0">
                {children}
              </div>
              <MobileBrowseDock />
              <SiteFooterGate />
            </div>
          </AppCapabilitiesRoot>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
