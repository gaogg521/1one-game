"use client";

import type { ThemeId } from "@/lib/themes";
import { THEMES } from "@/lib/themes";
import { useTheme } from "./ThemeProvider";

const STRIPE: Record<ThemeId, string> = {
  dark: "linear-gradient(to bottom, #22d3ee, #38bdf8, #a78bfa)",
  light: "linear-gradient(to bottom, #0e7490, #0369a1, #7c3aed)",
  "cyber-blue": "linear-gradient(to bottom, #67e8f9, #22d3ee, #60a5fa)",
  "warm-orange": "linear-gradient(to bottom, #fdba74, #fb923c, #f59e0b)",
  "forest-green": "linear-gradient(to bottom, #6ee7b7, #34d399, #22c55e)",
};

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-2" role="group" aria-label="界面主题" suppressHydrationWarning>
      <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--gc-text-faint)]">主题</p>
      <div className="flex flex-col gap-1.5" suppressHydrationWarning>
        {THEMES.map((t) => {
          const active = theme === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id)}
              aria-pressed={active}
              className={`flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition ${
                active
                  ? "border-[color:var(--gc-accent)]/50 bg-[color:var(--gc-accent)]/12 text-[var(--gc-text)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                  : "border-transparent text-[color:var(--gc-muted)] hover:border-[color:color-mix(in_srgb,var(--gc-accent)_35%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--gc-accent)_8%,transparent)] hover:text-[var(--gc-text)]"
              }`}
            >
              <span aria-hidden className="h-6 w-1 shrink-0 rounded-full" style={{ backgroundImage: STRIPE[t.id] }} />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium leading-tight">{t.name}</span>
                <span className="mt-0.5 block truncate text-[10px] leading-tight opacity-80">{t.tag}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
