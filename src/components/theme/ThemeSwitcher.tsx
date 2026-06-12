"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ThemeId } from "@/lib/themes";
import { THEME_IDS } from "@/lib/themes";
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
  const t = useTranslations("theme");

  return (
    <div
      className={`flex items-center ${touchFriendly ? "gap-0.5" : "gap-1.5"}`}
      role="group"
      aria-label={t("ariaLabel")}
      suppressHydrationWarning
    >
      {THEME_IDS.map((id) => {
        const active = theme === id;
        const isHovered = hovered === id;
        const name = t(`${id}.name`);
        return (
          <button
            key={id}
            type="button"
            onClick={() => setTheme(id)}
            onMouseEnter={() => setHovered(id)}
            onMouseLeave={() => setHovered((h) => (h === id ? null : h))}
            aria-pressed={active}
            aria-label={name}
            className={`relative flex shrink-0 items-center justify-center rounded-full transition-all ${
              touchFriendly ? "min-h-[36px] min-w-[36px] sm:min-h-[44px] sm:min-w-[44px]" : ""
            } ${active ? "ring-2 ring-white/80 ring-offset-1 ring-offset-[var(--gc-bg)] scale-110" : "hover:scale-105"}`}
          >
            <span
              className="rounded-full"
              style={{
                width: touchFriendly ? 16 : 14,
                height: touchFriendly ? 16 : 14,
                backgroundColor: DOT_COLOR[id],
                opacity: active ? 1 : 0.65,
              }}
            />
            {!touchFriendly && (isHovered || active) ? (
              <span
                className="pointer-events-none absolute left-1/2 top-full z-10 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-[color:var(--gc-border)] bg-[var(--gc-bg-elevated)] px-2 py-0.5 text-[10px] font-medium text-[var(--gc-text)] shadow-sm"
              >
                {name}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
