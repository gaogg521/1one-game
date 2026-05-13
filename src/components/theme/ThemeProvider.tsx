"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { DEFAULT_THEME, LEGACY_THEME_MAP, THEME_META_COLOR, isThemeId, type ThemeId } from "@/lib/themes";

const STORAGE_KEY = "theme";

function readStoredTheme(): ThemeId {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const fromDom = document.documentElement.dataset.theme;
  if (fromDom && isThemeId(fromDom)) return fromDom;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && isThemeId(raw)) return raw;
    const legacy = localStorage.getItem("gc-theme");
    if (legacy && LEGACY_THEME_MAP[legacy]) return LEGACY_THEME_MAP[legacy];
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME;
}

type ThemeContextValue = {
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(() => readStoredTheme());

  const setTheme = useCallback((t: ThemeId) => {
    document.documentElement.dataset.theme = t;
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
    setThemeState(t);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", THEME_META_COLOR[t]);
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
