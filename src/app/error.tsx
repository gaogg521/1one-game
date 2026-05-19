"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-lg font-semibold text-[var(--gc-text)]">页面加载失败</h1>
      <p className="text-sm text-[var(--gc-muted)]">
        开发模式下若刚跑过长测试或改了配置，请重启 <code className="text-xs">npm run dev</code> 后再试。
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="gc-theme-cta rounded-full px-5 py-2 text-sm font-semibold"
        >
          重试
        </button>
        <Link
          href="/"
          className="rounded-full border border-[color:var(--gc-border)] px-5 py-2 text-sm text-[var(--gc-text)]"
        >
          回首页
        </Link>
      </div>
    </div>
  );
}
