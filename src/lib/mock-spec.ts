import type { GameSpec } from "@/lib/game-spec";
import { withPresentationDefaults } from "@/lib/cohesive-presentation";
import { buildTowerDefenseBlueprint } from "@/lib/td-blueprint";
import { buildCoasterBlueprint } from "@/lib/coaster-blueprint";
import { buildFarmingBlueprint } from "@/lib/farming-blueprint";
import { buildCustomizationBlueprint } from "@/lib/customization-blueprint";
import { buildPlatformerBlueprint } from "@/lib/platformer-blueprint";
import { buildPuzzleBlueprint } from "@/lib/puzzle-blueprint";
import { buildChessBlueprint } from "@/lib/chess-blueprint";
import { buildDirector } from "@/lib/director";
import { buildSystems } from "@/lib/systems";
import { applyHardQualityDefaults } from "@/lib/game-quality";
import { inferTemplateFromPrompt, type GameTemplateId } from "@/lib/game-templates";
import { getTemplateDefinition, resolveTemplateRuntime } from "@/lib/game-templates/registry";
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

/** 无 API Key 时的离线推断：registry 关键词 + 轻量抽取。 */
export type MockSpecOptions = {
  templateId?: GameTemplateId;
  title?: string;
  subtitle?: string;
  sampleId?: string;
};

export function mockSpecFromPrompt(prompt: string, opts: MockSpecOptions = {}): GameSpec {
  const p = prompt.toLowerCase();
  const seed = hashPrompt(prompt);

  const templateId =
    opts.templateId ??
    inferTemplateFromPrompt(prompt, { sampleId: opts.sampleId });
  const rt = resolveTemplateRuntime(templateId);
  const def = getTemplateDefinition(templateId);

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

  const isTd = rt.phaser === "towerDefense";
  const isPlatformer = rt.phaser === "platformer";
  const isShooter = rt.phaser === "shooter";
  const isCoaster = rt.phaser === "coaster";
  const isChess = rt.phaser === "chess";
  const arenaMode = rt.arenaMode ?? "avoider";
  const isSurvivor = arenaMode === "survivor";
  const isCollector = arenaMode === "collector";

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

  const title = opts.title
    ? opts.title
    : isRooc
      ? "爱如初见 · 冒险经典"
      : isMc
        ? extractTitle(prompt, seed).includes("方块")
          ? extractTitle(prompt, seed)
          : `方块世界 · ${extractTitle(prompt, seed)}`
        : extractTitle(prompt, seed);

  const speedScale = isSurvivor ? 1.12 : 1;
  const hazardSpeed = Math.round(
    (isTd
      ? pick([150, 175, 200, 225], seed, 3)
      : isShooter
        ? pick([100, 130, 160, 190], seed, 3)
        : pick([220, 260, 300, 340], seed, 3)) * speedScale,
  );
  const spawnIntervalMs = isTd
    ? pick([340, 420, 500, 580], seed, 4)
    : isShooter
      ? pick([900, 1200, 1500, 1800], seed, 4)
      : pick([520, 640, 760, 880], seed, 4);
  const playerSpeed = isPlatformer
    ? pick([240, 280, 320, 360], seed, 5)
    : isTd
      ? pick([270, 300, 330, 360], seed, 5)
      : isShooter
        ? pick([260, 300, 340, 380], seed, 5)
        : pick([260, 300, 340, 380], seed, 5);
  const jumpStrength =
    isShooter
      ? pick([500, 540, 580, 620], seed, 51)
      : pick([380, 410, 440, 470], seed, 51);
  const gravity = pick([880, 930, 980, 1040], seed, 52);

  const baseHazardLabel = isRooc
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

  const collLabel = isRooc
    ? "Zeny"
    : /开心消消乐|消消乐|三消|糖果|动物/.test(prompt)
      ? "糖果"
      : guessed.collectible;
  const playerLabel = isRooc
    ? "冒险者"
    : /中国象棋|楚河|汉界|红黑/.test(prompt)
      ? "红方"
      : /开心消消乐|消消乐|三消|糖果|动物/.test(prompt)
        ? "糖果小队"
        : guessed.player;
  const hazardLabel = /中国象棋|楚河|汉界|红黑/.test(prompt) ? "黑方" : baseHazardLabel;

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
      winScore: isCoaster
        ? 100
        : isTd
          ? pick([10, 12, 14, 16], seed, 6)
          : isPlatformer
            ? pick([42, 50, 56, 64], seed, 6)
            : isCollector
              ? pick([36, 44, 50, 56], seed, 6)
              : isShooter
                ? pick([50, 60, 72, 85], seed, 6)
                : pick([50, 60, 70, 75], seed, 6),
      lives:
        isSurvivor || isCollector || isPlatformer || isShooter
          ? pick([3, 4, 5], seed, 7)
          : 1,
      arenaPadding: 36,
      ...(isPlatformer ? { jumpStrength, gravity } : {}),
      ...(isShooter ? { jumpStrength } : {}),
      ...(isTd
        ? {
            baseHealth: pick([36, 42, 48, 56], seed, 63),
            startingCoins: pick([95, 115, 135, 155], seed, 64),
          }
        : {}),
    },
    labels: {
      player: isTd ? "防御塔" : isShooter ? (space ? "战机" : "飞船") : playerLabel,
      hazard: isTd ? "敌军" : isShooter ? (space ? "敌舰" : "入侵者") : hazardLabel,
      collectible: isTd ? "金币" : collLabel,
      subtitle:
        opts.subtitle ??
        def.defaultSubtitle ??
        (isMc
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
                      : "一句话生成的小游戏"),
    },
  };

  if (rt.blueprint === "towerDefense" && !spec.towerDefense) {
    spec.towerDefense = buildTowerDefenseBlueprint({ prompt, spec });
  }
  if (rt.blueprint === "coaster") {
    spec.theme = {
      backgroundColor: "#38bdf8",
      playerColor: "#ef4444",
      hazardColor: "#854d0e",
      collectibleColor: "#fde047",
      particleTint: "#ffffff",
    };
    spec.coaster = buildCoasterBlueprint({ prompt, spec, sampleId: opts.sampleId });
    spec.presentation = { musicProfile: "pulse" };
  }
  if (rt.blueprint === "puzzle" && !spec.puzzle) {
    spec.puzzle = buildPuzzleBlueprint({ prompt, spec, sampleId: opts.sampleId });
  }
  if (isChess && !spec.chess) {
    spec.chess = buildChessBlueprint({ prompt, spec });
  }
  if (rt.phaser === "platformer" && !spec.platformer) {
    spec.platformer = buildPlatformerBlueprint({ prompt, spec });
  }
  if (rt.blueprint === "farming" && !spec.farming) {
    spec.farming = buildFarmingBlueprint({ prompt, spec });
  }
  if (templateId === "customization" && !spec.customization) {
    spec.customization = buildCustomizationBlueprint({ prompt, spec, sampleId: opts.sampleId });
  }
  if (!spec.director) {
    spec.director = buildDirector({ prompt, spec });
  }
  if (!spec.systems) {
    spec.systems = buildSystems({ prompt, spec });
  }

  return applyHardQualityDefaults(withPresentationDefaults(applyMinecraftThemeOverlay(spec)), prompt);
}
