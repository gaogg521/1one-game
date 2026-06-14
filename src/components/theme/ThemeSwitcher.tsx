"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ThemeId } from "@/lib/themes";
import { THEME_IDS, THEME_SWATCH_COLORS } from "@/lib/themes";
import { useTheme } from "./ThemeProvider";

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
        const swatch = THEME_SWATCH_COLORS[id];
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
            } ${active ? "scale-110" : "hover:scale-105"}`}
            style={
              active
                ? {
                    boxShadow: `0 0 0 2px var(--gc-bg), 0 0 0 4px ${swatch.primary}`,
                  }
                : undefined
            }
          >
            <span
              className="rounded-full"
              style={{
                width: touchFriendly ? 16 : 14,
                height: touchFriendly ? 16 : 14,
                background: `linear-gradient(135deg, ${swatch.primary} 0%, ${swatch.secondary} 100%)`,
                opacity: active ? 1 : 0.72,
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
