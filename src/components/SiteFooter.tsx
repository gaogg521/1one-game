import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t py-10 text-sm text-[var(--gc-muted)]" style={{ borderColor: "var(--gc-border)", backgroundColor: "var(--gc-footer-bg)" }}>
      <div className="flex flex-col gap-6 px-6 sm:flex-row sm:items-center sm:justify-between sm:px-10 lg:px-14 xl:px-20 2xl:px-28">
        <p className="max-w-md leading-relaxed text-[var(--gc-text)]">
          {BRAND_NAME} — AI 与规格驱动的浏览器小游戏管线；适合创意验证、教学演示与快速迭代。
        </p>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/create" className="text-[var(--gc-muted)] hover:text-[var(--gc-accent)]">
            创作
          </Link>
          <Link href="/studio" className="text-[var(--gc-muted)] hover:text-[var(--gc-accent)]">
            工作室
          </Link>
          <span className="opacity-70">Next.js · Phaser · Prisma</span>
        </div>
      </div>
    </footer>
  );
}
