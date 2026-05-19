import type { GameSpec } from "@/lib/game-spec";
import { withPresentationDefaults } from "@/lib/cohesive-presentation";
import { buildTowerDefenseBlueprint } from "@/lib/td-blueprint";
import { buildDirector } from "@/lib/director";
import { buildSystems } from "@/lib/systems";
import {
  applyMinecraftThemeOverlay,
  detectMinecraftIntent,
  MINECRAFT_THEME,
} from "@/lib/minecraft-franchise";

function hashPrompt(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function pick<T>(arr: T[], seed: number, i: number): T {
  return arr[(seed + i * 17) % arr.length];
}

/** 从一句话里抽标题：优先第一句，截断加省略号。 */
function extractTitle(prompt: string, seed: number): string {
  const t = prompt.trim();
  if (!t) return pick(["星际小游戏", "奇妙冒险", "指尖挑战"], seed, 0);
  const first = t.split(/[。！？\n]/)[0]?.trim() ?? t;
  const core = first.replace(/^[\s"'「」]+|[\s"'」]+$/g, "");
  if (core.length <= 28) return core.slice(0, 80);
  return `${core.slice(0, 26)}…`;
}

/** 粗粒度从描述里猜角色/威胁称呼（无 NLP 依赖）。 */
function guessLabels(prompt: string): {
  player: string;
  hazard: string;
  collectible: string;
} {
  const role =
    /(?:操控|扮演|控制|我是|扮演一只|扮演一个)([^，。！？\s]{1,8})/.exec(prompt)?.[1] ??
    /([\u4e00-\u9fa5]{2,6})(?:在|于)/.exec(prompt)?.[1];
  const hazardGuess =
    /(?:躲避|躲开|避开|躲)([^，。！？\s]{1,8})/.exec(prompt)?.[1] ??
    /(?:陨石|陷阱|敌人|障碍|弹幕|滚木|墨汁)/.exec(prompt)?.[0];

  const collGuess =
    /(?:收集|捡起|吃到|拾取)([^，。！？\s]{1,8})/.exec(prompt)?.[1] ??
    /(?:金币|宝石|水晶|珍珠|蘑菇|包裹|能量)/.exec(prompt)?.[0];

  return {
    player: role ? role.slice(0, 8) : "主角",
    hazard: hazardGuess ? hazardGuess.slice(0, 8) : "障碍",
    collectible: collGuess ? collGuess.slice(0, 8) : "收集物",
  };
}

/** 无 API Key 时的离线推断：关键词 + 轻量抽取，保证可玩且标题更像「游戏名」。 */
export function mockSpecFromPrompt(prompt: string): GameSpec {
  const p = prompt.toLowerCase();
  const seed = hashPrompt(prompt);

  const isRooc =
    /爱如初见|rooc|roocasia|gnjoy|仙境传说|ragnarok|ro\b/.test(prompt) ||
    /rooc/.test(p);

  const isMc = detectMinecraftIntent(prompt);

  const space = /太空|宇宙|星星|陨石|飞船|卫星|银河|空间站/.test(prompt);
  const ocean = /海|洋|鱼|潜水|浪|船|珊瑚|章鱼/.test(prompt);
  const forest = /森|林|树|鹿|精灵|蘑菇|藤蔓/.test(prompt);
  const neonExplicit = /赛博|霓虹|cyber|neon(\b|$)|夜店|数据线|全息|故障艺术|机甲/.test(p) ||
    /赛博|霓虹|全息|数据线|故障/.test(prompt);
  const city = /城市|夜市|街道|高楼|无人机|通勤/.test(prompt);

  let templateId: GameSpec["templateId"] = "avoider";
  if (
    /塔防|保卫萝卜|防御塔|箭塔|炮塔|放置塔|波次防守|tower\s*defen[cs]e|\btd\b|tower\s*defence/i.test(p)
  ) {
    templateId = "towerDefense";
  } else if (
    isMc && /奔跑|跑酷|冲刺|闯关|跳跃|platformer/.test(prompt)
  ) {
    templateId = "platformer";
  } else if (
    /平台跳跃|跳台|横版闯关|横版过关|多层平台|platformer|\bplatform\b|马里奥|恶魔城|关卡|闯关/.test(p)
  ) {
    templateId = "platformer";
  } else if (/生存|血条|生命|多条命|尽量久|扣血|surviv|hp|life|heart/.test(p)) {
    templateId = "survivor";
  } else if (/射击|飞船|太空战|弹幕|战机|消灭敌机|宇宙战|shooter|\bshoot/.test(p)) {
    templateId = "shooter";
  } else if (/收集|捡|金币|宝石|吃豆|拾取|包裹|晶体|珍珠|蘑菇|能量|collect|coin|gem/.test(p)) {
    templateId = "collector";
  } else if (/躲|落下|砸|闪|弹幕|跑酷|坠落/.test(p)) {
    templateId = "avoider";
  }

  const palettesOrganic = [
    {
      backgroundColor: "#141816",
      playerColor: "#89a884",
      hazardColor: "#9d5838",
      collectibleColor: "#c9a66b",
      particleTint: "#69746c",
    },
    {
      backgroundColor: "#18221d",
      playerColor: "#7da396",
      hazardColor: "#8f4f32",
      collectibleColor: "#d4bf94",
      particleTint: "#5e6a61",
    },
    {
      backgroundColor: "#1a1620",
      playerColor: "#9b8cb2",
      hazardColor: "#a85c40",
      collectibleColor: "#c4a882",
      particleTint: "#6f6778",
    },
  ];

  /** 仅在描述里明确要带霓虹/赛博气质时使用 */
  const palettesNeon = [
    {
      backgroundColor: "#0f172a",
      playerColor: "#38bdf8",
      hazardColor: "#fb7185",
      collectibleColor: "#fbbf24",
      particleTint: "#818cf8",
    },
    {
      backgroundColor: "#1e1b4b",
      playerColor: "#c4b5fd",
      hazardColor: "#f472b6",
      collectibleColor: "#fde047",
      particleTint: "#67e8f9",
    },
  ];

  const roocPalette = {
    backgroundColor: "#121a26",
    playerColor: "#e8cfe8",
    hazardColor: "#c97b89",
    collectibleColor: "#7eb6c9",
    particleTint: "#d4cf8f",
  };

  const mcPalette = { ...MINECRAFT_THEME };
  const themePick = isMc
    ? mcPalette
    : neonExplicit
      ? pick(palettesNeon, seed, 99)
      : isRooc
        ? roocPalette
        : pick(palettesOrganic, seed, 0);
  const guessed = isMc
    ? { player: "史蒂夫", hazard: "苦力怕", collectible: "绿宝石" }
    : guessLabels(prompt);

  const title = isRooc
    ? "爱如初见 · 冒险经典"
    : isMc
      ? extractTitle(prompt, seed).includes("方块")
        ? extractTitle(prompt, seed)
        : `方块世界 · ${extractTitle(prompt, seed)}`
      : extractTitle(prompt, seed);

  const speedScale = templateId === "survivor" ? 1.12 : 1;
  const hazardSpeed = Math.round(
    (templateId === "towerDefense"
      ? pick([150, 175, 200, 225], seed, 3)
      : templateId === "shooter"
        ? pick([100, 130, 160, 190], seed, 3)
        : pick([220, 260, 300, 340], seed, 3)) * speedScale,
  );
  const spawnIntervalMs =
    templateId === "towerDefense"
      ? pick([340, 420, 500, 580], seed, 4)
      : templateId === "shooter"
        ? pick([900, 1200, 1500, 1800], seed, 4)
        : pick([520, 640, 760, 880], seed, 4);
  const playerSpeed =
    templateId === "platformer"
      ? pick([240, 280, 320, 360], seed, 5)
      : templateId === "towerDefense"
        ? pick([270, 300, 330, 360], seed, 5)
        : templateId === "shooter"
          ? pick([260, 300, 340, 380], seed, 5)
          : pick([260, 300, 340, 380], seed, 5);
  const jumpStrength =
    templateId === "shooter"
      ? pick([500, 540, 580, 620], seed, 51)
      : pick([380, 410, 440, 470], seed, 51);
  const gravity = pick([880, 930, 980, 1040], seed, 52);

  const hazardLabel = isRooc
    ? "魔物"
    : space
      ? "陨石"
      : ocean
        ? "暗流"
        : forest
          ? "荆棘"
          : city
            ? "碎片"
            : guessed.hazard;

  const collLabel = isRooc ? "Zeny" : guessed.collectible;
  const playerLabel = isRooc ? "冒险者" : guessed.player;

  const spec: GameSpec = {
    version: 1,
    templateId,
    title,
    theme: {
      backgroundColor: themePick.backgroundColor,
      playerColor: themePick.playerColor,
      hazardColor: themePick.hazardColor,
      collectibleColor: themePick.collectibleColor,
      particleTint: themePick.particleTint,
    },
    gameplay: {
      playerSpeed,
      hazardSpeed,
      spawnIntervalMs,
      winScore:
        templateId === "towerDefense"
          ? pick([6, 8, 10, 12], seed, 6)
          : templateId === "platformer"
            ? pick([30, 36, 42, 48], seed, 6)
            : templateId === "collector"
              ? pick([24, 30, 36, 42], seed, 6)
              : templateId === "shooter"
                ? pick([35, 45, 55, 65], seed, 6)
                : pick([35, 45, 55], seed, 6),
      lives:
        templateId === "survivor"
          ? pick([3, 4, 5], seed, 7)
          : templateId === "collector"
            ? pick([3, 4, 5], seed, 7)
            : templateId === "platformer"
              ? pick([3, 4, 5], seed, 7)
              : templateId === "shooter"
                ? pick([3, 4, 5], seed, 7)
                : 1,
      arenaPadding: 36,
      ...(templateId === "platformer" ? { jumpStrength, gravity } : {}),
      ...(templateId === "shooter" ? { jumpStrength } : {}),
      ...(templateId === "towerDefense"
        ? {
            baseHealth: pick([36, 42, 48, 56], seed, 63),
            startingCoins: pick([95, 115, 135, 155], seed, 64),
          }
        : {}),
    },
    labels: {
      player: templateId === "towerDefense" ? "防御塔" : templateId === "shooter" ? (space ? "战机" : "飞船") : playerLabel,
      hazard: templateId === "towerDefense" ? "敌军" : templateId === "shooter" ? (space ? "敌舰" : "入侵者") : hazardLabel,
      collectible: templateId === "towerDefense" ? "金币" : collLabel,
      subtitle: templateId === "towerDefense"
        ? "波次防守 · 构筑火力网"
        : templateId === "shooter"
          ? (space ? "星际截击 · 波次升级与火力窗口" : "空中射击 · 敌群波次迎击")
          : templateId === "platformer"
            ? (forest ? "多段地形 · 收集推进与精英阻截" : "关卡推进 · 平台跳跃与阶段目标")
            : templateId === "collector"
              ? "收集冲刺 · 限时目标与局势变化"
              : templateId === "survivor"
                ? "越撑越险 · 事件升级与生存压力"
          : isMc
            ? "方块草地 · 网易我的世界风奔跑闯关"
            : isRooc
          ? "Q版奇幻 · 职业技能 · 探索与成长"
          : space
            ? "在星尘间穿行"
            : ocean
              ? "逐浪前进"
              : forest
                ? "林间穿行"
                : city && neonExplicit
                  ? "灯海穿行"
                  : city
                    ? "街口穿行"
                    : "一句话生成的小游戏",
    },
  };

  if (spec.templateId === "towerDefense" && !spec.towerDefense) {
    spec.towerDefense = buildTowerDefenseBlueprint({ prompt, spec });
  }
  if (!spec.director) {
    spec.director = buildDirector({ prompt, spec });
  }
  if (!spec.systems) {
    spec.systems = buildSystems({ prompt, spec });
  }

  return withPresentationDefaults(applyMinecraftThemeOverlay(spec));
}
