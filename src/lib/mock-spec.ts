import type { GameSpec } from "@/lib/game-spec";
import { buildTowerDefenseBlueprint } from "@/lib/td-blueprint";
import { buildDirector } from "@/lib/director";
import { buildSystems } from "@/lib/systems";

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

  const space = /太空|宇宙|星星|陨石|飞船|卫星|银河|空间站/.test(prompt);
  const ocean = /海|洋|鱼|潜水|浪|船|珊瑚|章鱼/.test(prompt);
  const forest = /森|林|树|鹿|精灵|蘑菇|藤蔓/.test(prompt);
  const city = /城市|夜市|霓虹|街道|高楼|无人机/.test(prompt);

  let templateId: GameSpec["templateId"] = "avoider";
  if (
    /塔防|保卫萝卜|防御塔|箭塔|炮塔|放置塔|波次防守|tower\s*defen[cs]e|\btd\b|tower\s*defence/i.test(p)
  ) {
    templateId = "towerDefense";
  } else if (
    /平台跳跃|跳台|横版闯关|横版过关|多层平台|platformer|\bplatform\b|马里奥|恶魔城|关卡|闯关/.test(p)
  ) {
    templateId = "platformer";
  } else if (/收集|捡|金币|宝石|吃豆|拾取|包裹|晶体|珍珠|蘑菇|能量|collect|coin|gem/.test(p)) {
    templateId = "collector";
  } else if (/生存|血条|生命|多条命|尽量久|扣血|surviv|hp|life|heart/.test(p)) {
    templateId = "survivor";
  } else if (/躲|落下|砸|闪|弹幕|跑酷|坠落/.test(p)) {
    templateId = "avoider";
  }

  const palettes = [
    {
      backgroundColor: "#0b1020",
      playerColor: "#7ee787",
      hazardColor: "#ff6b6b",
      collectibleColor: "#ffd93d",
      particleTint: "#6bcbff",
    },
    {
      backgroundColor: "#1a1a2e",
      playerColor: "#e94560",
      hazardColor: "#f9f871",
      collectibleColor: "#00fff5",
      particleTint: "#ff77ff",
    },
    {
      backgroundColor: "#14213d",
      playerColor: "#fca311",
      hazardColor: "#e63946",
      collectibleColor: "#2a9d8f",
      particleTint: "#a8dadc",
    },
    {
      backgroundColor: "#1e1b4b",
      playerColor: "#c4b5fd",
      hazardColor: "#fb7185",
      collectibleColor: "#fde047",
      particleTint: "#67e8f9",
    },
  ];

  const roocPalette = {
    backgroundColor: "#0b1222",
    playerColor: "#f5d0fe",
    hazardColor: "#fb7185",
    collectibleColor: "#67e8f9",
    particleTint: "#fde047",
  };

  const themePick = isRooc ? roocPalette : pick(palettes, seed, 0);
  const guessed = guessLabels(prompt);

  const title = isRooc ? "爱如初见 · 冒险经典" : extractTitle(prompt, seed);

  const speedScale = templateId === "survivor" ? 1.12 : 1;
  const hazardSpeed = Math.round(
    (templateId === "towerDefense"
      ? pick([150, 175, 200, 225], seed, 3)
      : pick([220, 260, 300, 340], seed, 3)) * speedScale,
  );
  const spawnIntervalMs =
    templateId === "towerDefense"
      ? pick([340, 420, 500, 580], seed, 4)
      : pick([520, 640, 760, 880], seed, 4);
  const playerSpeed =
    templateId === "platformer"
      ? pick([240, 280, 320, 360], seed, 5)
      : templateId === "towerDefense"
        ? pick([270, 300, 330, 360], seed, 5)
        : pick([260, 300, 340, 380], seed, 5);
  const jumpStrength = pick([380, 410, 440, 470], seed, 51);
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
              : pick([35, 45, 55], seed, 6),
      lives:
        templateId === "survivor"
          ? pick([3, 4, 5], seed, 7)
          : templateId === "collector"
            ? pick([3, 4, 5], seed, 7)
            : templateId === "platformer"
              ? pick([3, 4, 5], seed, 7)
              : 1,
      arenaPadding: 36,
      ...(templateId === "platformer" ? { jumpStrength, gravity } : {}),
      ...(templateId === "towerDefense"
        ? {
            baseHealth: pick([36, 42, 48, 56], seed, 63),
            startingCoins: pick([95, 115, 135, 155], seed, 64),
          }
        : {}),
    },
    labels: {
      player: templateId === "towerDefense" ? "防御塔" : playerLabel,
      hazard: templateId === "towerDefense" ? "敌军" : hazardLabel,
      collectible: templateId === "towerDefense" ? "金币" : collLabel,
      subtitle: templateId === "towerDefense"
        ? "波次防守 · 构筑火力网"
        : isRooc
          ? "Q版奇幻 · 职业技能 · 探索与成长"
          : space
            ? "在星尘间穿行"
            : ocean
              ? "逐浪前进"
              : forest
                ? "林间穿行"
                : city
                  ? "霓虹之下"
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

  return spec;
}
