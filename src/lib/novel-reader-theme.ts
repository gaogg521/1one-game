import type { CSSProperties } from "react";

/** 与阅读器一致的配色（护眼 / 夜间 / 绿豆） */
export type NovelReaderThemeId = "paper" | "night" | "green";

export interface NovelReaderPalette {
  label: string;
  bg: string;
  panel: string;
  text: string;
  muted: string;
  border: string;
  tocActive: string;
}

export const NOVEL_READER_THEMES: Record<NovelReaderThemeId, NovelReaderPalette> = {
  paper: {
    label: "护眼",
    bg: "#ebe4d6",
    panel: "#f7f2e8",
    text: "#3d3429",
    muted: "#7a6f5f",
    border: "#ddd4c4",
    tocActive: "#c45c26",
  },
  night: {
    label: "夜间",
    bg: "#121216",
    panel: "#1e1e24",
    text: "#d4d0c8",
    muted: "#8a8680",
    border: "#2e2e34",
    tocActive: "#e8a87c",
  },
  green: {
    label: "绿豆",
    bg: "#dce8d4",
    panel: "#eef4e8",
    text: "#2d3a28",
    muted: "#5a6b52",
    border: "#c5d4b8",
    tocActive: "#3d7a45",
  },
};

/**
 * 在阅读页覆盖站点导航用到的 CSS 变量，使侧栏 / 顶栏与阅读器同色。
 */
export function novelReaderChromeCssVars(t: NovelReaderPalette): CSSProperties {
  return {
    "--gc-bg": t.bg,
    "--gc-bg-elevated": t.panel,
    "--gc-sidebar-bg": `color-mix(in srgb, ${t.panel} 92%, transparent)`,
    "--gc-header-bg": `color-mix(in srgb, ${t.panel} 92%, transparent)`,
    "--gc-border": t.border,
    "--gc-text": t.text,
    "--gc-muted": t.muted,
    "--gc-accent": t.tocActive,
    "--gc-accent2": t.tocActive,
    "--gc-selection-bg": `color-mix(in srgb, ${t.tocActive} 26%, transparent)`,
  } as CSSProperties;
}
