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
  { id: "dark", name: "墨蓝暗夜", tag: "靛紫星夜 · 深邃午夜" },
  { id: "light", name: "绢白极简", tag: "暖米宣纸 · 靛蓝点睛" },
  { id: "cyber-blue", name: "深海电光", tag: "极深午夜 · 天青电光" },
  { id: "warm-orange", name: "烟火琥珀", tag: "浓墨暖棕 · 琥珀金焰" },
  { id: "forest-green", name: "竹影翡翠", tag: "林幽深绿 · 翡翠流光" },
] as const;

export const THEME_META_COLOR: Record<ThemeId, string> = {
  dark: "#080f1e",
  light: "#f9f8f5",
  "cyber-blue": "#020b18",
  "warm-orange": "#110c07",
  "forest-green": "#071610",
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
