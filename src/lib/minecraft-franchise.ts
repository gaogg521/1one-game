import type { GameSpec } from "@/lib/game-spec";

/** 用户是否明确要求网易《我的世界》/ Minecraft 气质（含 mc.163.com 参考页）。 */
export function detectMinecraftIntent(text: string): boolean {
  return /我的世界|minecraft|mc\.163|方块|草方|绿晶|沙盒|史蒂夫|steve|苦力怕|creeper|末影|绿宝石|网易.*我的世界/i.test(
    text,
  );
}

export const MINECRAFT_THEME = {
  backgroundColor: "#6eb5ff",
  playerColor: "#c49a6c",
  hazardColor: "#3d8f3d",
  collectibleColor: "#32cd32",
  particleTint: "#5d9b47",
} as const;

/** 追加到送入 LLM 的用户创意末尾（不替代正文）。 */
export function minecraftFranchiseAugment(prompt: string): string {
  if (!detectMinecraftIntent(prompt)) return prompt;
  const block = [
    "【IP 视觉约束 · 我的世界 / Minecraft】",
    "用户要的是网易《我的世界》式沙盒方块美学（参考 mc.163.com：3D 方块草地、泥土、天空、像素角色），不是抽象霓虹 UI 或纯色圆角躲避场。",
    "templateId：若描述含奔跑/跑酷/冲刺/闯关 → 优先 platformer；若强调俯视角收集 → collector；勿默认 avoider 除非明确只要「躲开落下物」。",
    "theme 建议：天空 #6EB5FF、草地 #5D9B47、泥土 #8B6914、玩家肤 #C49A6C、威胁用苦力怕绿 #3D8F3D；subtitle/labels 用中文方块世界称呼（史蒂夫、苦力怕、方块、绿宝石等）。",
    "禁止：赛博霓虹、与 MC 无关的「别墅/草地冲刺」泛化标题而不提方块世界。",
  ].join("\n");
  return `${prompt.trim()}\n\n---\n${block}`.slice(0, 4000);
}

export function isMinecraftLikeSpec(spec: GameSpec): boolean {
  const blob = [
    spec.title,
    spec.labels.subtitle ?? "",
    spec.labels.player,
    spec.labels.hazard,
    spec.labels.collectible ?? "",
  ].join(" ");
  return detectMinecraftIntent(blob);
}

/** 生成管线收尾：锁定 MC 配色，避免 LLM 落成灰蓝圆角平台风。 */
export function applyMinecraftThemeOverlay(spec: GameSpec): GameSpec {
  if (!isMinecraftLikeSpec(spec)) return spec;
  return {
    ...spec,
    theme: { ...MINECRAFT_THEME },
    presentation: {
      ...spec.presentation,
      musicProfile: "organic",
    },
    labels: {
      ...spec.labels,
      player: /史蒂夫|steve/i.test(spec.labels.player) ? spec.labels.player : "史蒂夫",
      hazard: /苦力怕|creeper|仙人掌/i.test(spec.labels.hazard) ? spec.labels.hazard : "仙人掌",
      collectible:
        spec.labels.collectible && /绿|宝石|晶/i.test(spec.labels.collectible)
          ? spec.labels.collectible
          : "绿宝石",
      subtitle:
        spec.labels.subtitle && detectMinecraftIntent(spec.labels.subtitle)
          ? spec.labels.subtitle
          : "方块草地 · 网易我的世界风跑酷",
    },
  };
}
