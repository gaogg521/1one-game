import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";

export function SiteFooter() {
  return (
    <footer
      className="mt-auto border-t py-10 pb-[calc(2.5rem+env(safe-area-inset-bottom,0px))] text-sm text-[var(--gc-muted)] lg:pb-10"
      style={{ borderColor: "var(--gc-border)", backgroundColor: "var(--gc-footer-bg)" }}
    >
      <div className="flex flex-col gap-6 px-6 sm:flex-row sm:items-center sm:justify-between sm:px-10 lg:px-14 xl:px-20 2xl:px-28">
        <p className="max-w-md leading-relaxed text-[var(--gc-text)]">
          {BRAND_NAME} — AI 与规格驱动的浏览器小游戏管线；适合创意验证、教学演示与快速迭代。
        </p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 sm:gap-x-6 sm:gap-y-2">
          <Link
            href="/create"
            className="-m-1 inline-flex min-h-[44px] items-center rounded-lg px-3 py-2 text-[var(--gc-muted)] hover:text-[var(--gc-accent)] sm:min-h-0 sm:px-0 sm:py-0"
          >
            创作
          </Link>
          <Link
            href="/studio"
            className="-m-1 inline-flex min-h-[44px] items-center rounded-lg px-3 py-2 text-[var(--gc-muted)] hover:text-[var(--gc-accent)] sm:min-h-0 sm:px-0 sm:py-0"
          >
            工作室
          </Link>
          <span className="hidden opacity-70 sm:inline">Next.js · Phaser · Prisma</span>
        </div>
      </div>
    </footer>
  );
}
