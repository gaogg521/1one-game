"use client";

import { useState } from "react";
import type { ThemeId } from "@/lib/themes";
import { THEMES } from "@/lib/themes";
import { useTheme } from "./ThemeProvider";

const DOT_COLOR: Record<ThemeId, string> = {
  dark: "#22d3ee",
  light: "#0e7490",
  "cyber-blue": "#67e8f9",
  "warm-orange": "#fb923c",
  "forest-green": "#34d399",
};

export function ThemeSwitcher({ touchFriendly }: { touchFriendly?: boolean }) {
  const { theme, setTheme } = useTheme();
  const [hovered, setHovered] = useState<ThemeId | null>(null);

  return (
    <div className={`flex items-center ${touchFriendly ? "gap-0.5" : "gap-1.5"}`} role="group" aria-label="界面主题" suppressHydrationWarning>
      {THEMES.map((t) => {
        const active = theme === t.id;
        const isHovered = hovered === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => setTheme(t.id)}
            onMouseEnter={() => setHovered(t.id)}
            onMouseLeave={() => setHovered((h) => (h === t.id ? null : h))}
            aria-pressed={active}
            title={t.name}
            className={`relative flex shrink-0 items-center justify-center rounded-full transition-all ${
              touchFriendly ? "min-h-[44px] min-w-[44px]" : ""
            } ${active ? "ring-2 ring-white/80 ring-offset-1 ring-offset-[var(--gc-bg)] scale-110" : "hover:scale-105"}`}
          >
            <span
              className="rounded-full"
              style={{
                width: touchFriendly ? 16 : 14,
                height: touchFriendly ? 16 : 14,
                backgroundColor: DOT_COLOR[t.id],
                opacity: active ? 1 : 0.65,
              }}
            />
            {!touchFriendly && (isHovered || active) ? (
              <span
                className="pointer-events-none absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-0.5 text-[10px] font-medium"
                style={{
                  backgroundColor: "var(--gc-surface-glass)",
                  color: "var(--gc-text)",
                  border: "1px solid var(--gc-border)",
                }}
              >
                {t.name}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
