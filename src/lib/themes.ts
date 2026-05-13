/**
 * 与 1oneclaw 宣传站 / 面板一致：html[data-theme] + localStorage「theme」
 * @see D:\Openclaw项目和工具\Openclaw-SKILLS-OneOne-\软件SOFT\www\src\style.css
 */
export const THEME_IDS = ["dark", "light", "cyber-blue", "warm-orange", "forest-green"] as const;

export type ThemeId = (typeof THEME_IDS)[number];

/** 默认：深海暗夜 */
export const DEFAULT_THEME: ThemeId = "dark";

export const THEMES: readonly {
  id: ThemeId;
  name: string;
  tag: string;
}[] = [
  { id: "dark", name: "深海暗夜", tag: " slate 蓝 · 冰青点缀" },
  { id: "light", name: "极简浅色", tag: "纸白底 · 深蓝字" },
  { id: "cyber-blue", name: "蓝色科技风", tag: "电青网格 · 霓虹蓝" },
  { id: "warm-orange", name: "橙色暖调", tag: "琥珀金 · 暖橙主色" },
  { id: "forest-green", name: "森林绿境", tag: "松石绿 · 森系暗底" },
] as const;

export const THEME_META_COLOR: Record<ThemeId, string> = {
  dark: "#0f172a",
  light: "#f3f6fb",
  "cyber-blue": "#061126",
  "warm-orange": "#1a120a",
  "forest-green": "#0c1f17",
};

/** 旧版游戏站主题 id → 1oneclaw id */
export const LEGACY_THEME_MAP: Record<string, ThemeId> = {
  nebula: "dark",
  ember: "warm-orange",
  ink: "dark",
  pulse: "cyber-blue",
  moss: "forest-green",
};

export function isThemeId(v: string): v is ThemeId {
  return (THEME_IDS as readonly string[]).includes(v);
}
