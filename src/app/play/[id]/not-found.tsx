import Link from "next/link";

export default function PlayNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <p className="text-sm font-medium uppercase tracking-[0.3em] text-[var(--gc-muted)]">404</p>
      <h1 className="text-2xl font-semibold text-[var(--gc-text)]">找不到这个作品</h1>
      <p className="max-w-md text-sm text-[var(--gc-muted)]">链接可能已失效，或作品已被删除。</p>
      <Link
        href="/create"
        className="gc-theme-cta rounded-full px-6 py-2.5 text-sm font-semibold"
      >
        去创作
      </Link>
    </div>
  );
}
