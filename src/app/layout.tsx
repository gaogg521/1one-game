import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { AppCapabilitiesRoot } from "@/providers/AppCapabilitiesRoot";
import { htmlFontVariableClasses } from "@/lib/fonts";
import { THEME_INIT_SCRIPT } from "@/lib/theme-init-script";
import { THEME_META_COLOR, DEFAULT_THEME } from "@/lib/themes";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "1ONE游戏平台 — AI 小游戏创作",
    template: "%s · 1ONE游戏平台",
  },
  description:
    "1ONE游戏平台：用自然语言生成可玩的网页小游戏；结构化规格、Phaser 运行时、参考图与文档解读、作品保存与分享。",
  openGraph: {
    title: "1ONE游戏平台",
    description: "AI 驱动的浏览器小游戏创作与分享 · 一句话开玩",
  },
};

export const viewport = {
  themeColor: THEME_META_COLOR[DEFAULT_THEME],
  width: "device-width",
  initialScale: 1,
  /** 刘海屏安全区 env(safe-area-inset-*) 生效需要 cover */
  viewportFit: "cover" as const,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-Hans"
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
        <AppCapabilitiesRoot>
          <div className="relative z-10 flex min-h-full flex-1 flex-col">
            <div className="flex min-h-full flex-1 flex-col">{children}</div>
            <SiteFooter />
          </div>
        </AppCapabilitiesRoot>
      </body>
    </html>
  );
}
