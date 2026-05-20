import type { CreativeBrief } from "@/lib/creative-brief/types";
import type { GameSpec } from "@/lib/game-spec";

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** 0=冷 1=暖 */
function warmth(hex: string): number | null {
  const c = parseHex(hex);
  if (!c) return null;
  return (c.r * 2 + c.g - c.b) / 765;
}

function isPastoralGreen(hex: string): boolean {
  const c = parseHex(hex);
  if (!c) return false;
  return c.g > c.r + 18 && c.g > c.b + 10 && warmth(hex)! > 0.42 && warmth(hex)! < 0.62;
}

function isDeepCold(hex: string): boolean {
  const w = warmth(hex);
  if (w == null) return false;
  return w < 0.38;
}

/** Brief 与 GameSpec.theme / templateId 一致性检查 */
export function lintBriefThemeAlignment(brief: CreativeBrief, spec: GameSpec): string[] {
  const issues: string[] = [];
  const hint = brief.intent.templateHint;

  if (hint !== "auto" && hint !== spec.templateId) {
    issues.push(
      `玩法模板不一致：Brief 倾向 ${hint}，但 GameSpec.templateId=${spec.templateId}；请改 templateId 或调整 Brief。`,
    );
  }

  const bg = spec.theme.backgroundColor;
  const pack = brief.packId;

  if (pack === "space-epic" && bg && (isPastoralGreen(bg) || warmth(bg)! > 0.55)) {
    issues.push(
      "主题色与星际科幻 Brief 不一致：backgroundColor 应偏冷色深空（如 #0a1224），当前偏暖/田园。",
    );
  }
  if (pack === "horror-survival" && bg && warmth(bg)! > 0.5) {
    issues.push("恐怖 Brief 要求极暗背景，当前 backgroundColor 过亮或偏暖。");
  }
  if (pack === "cozy-collect" && bg && isDeepCold(bg)) {
    issues.push("治愈 Brief 不宜使用过冷过暗的背景色。");
  }

  const th = brief.themeHints;
  if (th.backgroundColor && bg && th.backgroundColor.toLowerCase() !== bg.toLowerCase()) {
    const hw = warmth(th.backgroundColor);
    const sw = warmth(bg);
    if (hw != null && sw != null && Math.abs(hw - sw) > 0.22) {
      issues.push(
        `backgroundColor 与 Brief.themeHints 色相偏离较大（hint=${th.backgroundColor} spec=${bg}）。`,
      );
    }
  }

  if (th.musicProfile && spec.presentation?.musicProfile && th.musicProfile !== spec.presentation.musicProfile) {
    issues.push(
      `musicProfile 建议 ${th.musicProfile}，当前为 ${spec.presentation.musicProfile}。`,
    );
  }

  return issues;
}

/** 将 Brief 中的 themeHints 合并进 GameSpec */
export function applyBriefThemeHints(spec: GameSpec, brief: CreativeBrief, force = false): GameSpec {
  const h = brief.themeHints;
  const theme = { ...spec.theme };
  const presentation = { ...spec.presentation };

  const shouldFixBg =
    force ||
    (h.backgroundColor &&
      brief.packId === "space-epic" &&
      theme.backgroundColor &&
      isPastoralGreen(theme.backgroundColor));

  if (h.backgroundColor && shouldFixBg) theme.backgroundColor = h.backgroundColor;
  if (h.playerColor && force) theme.playerColor = h.playerColor;
  if (h.hazardColor && force) theme.hazardColor = h.hazardColor;
  if (h.collectibleColor && force) theme.collectibleColor = h.collectibleColor;
  if (h.musicProfile && (force || !presentation.musicProfile)) {
    presentation.musicProfile = h.musicProfile;
  }

  return { ...spec, theme, presentation };
}

/** 当检测到明显冲突时，自动对齐主题色 */
export function alignSpecThemeFromBrief(spec: GameSpec, brief: CreativeBrief): GameSpec {
  const issues = lintBriefThemeAlignment(brief, spec);
  if (!issues.length) return spec;
  return applyBriefThemeHints(spec, brief, true);
}
