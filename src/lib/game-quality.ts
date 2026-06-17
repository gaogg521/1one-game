import type { AppLocale } from "@/i18n/routing";
import type { GameSpec } from "@/lib/game-spec";
import { buildDirector } from "@/lib/director";
import { buildSystems } from "@/lib/systems";
import { buildFarmingBlueprint } from "@/lib/farming-blueprint";
import { buildPuzzleBlueprint } from "@/lib/puzzle-blueprint";
import { buildChessBlueprint } from "@/lib/chess-blueprint";
import { mixHex, withPresentationDefaults } from "@/lib/cohesive-presentation";
import { resolveQualityTier } from "@/lib/orchestration/context-pack";

type GameplayFloor = Partial<
  Pick<
    GameSpec["gameplay"],
    "playerSpeed" | "hazardSpeed" | "spawnIntervalMs" | "winScore" | "lives" | "jumpStrength" | "gravity" | "startingCoins" | "baseHealth"
  >
>;

const TEMPLATE_FLOORS: Record<string, GameplayFloor> = {
  shooter: { playerSpeed: 300, hazardSpeed: 130, spawnIntervalMs: 900, winScore: 50, lives: 3, jumpStrength: 540 },
  platformer: { playerSpeed: 280, hazardSpeed: 220, spawnIntervalMs: 640, winScore: 42, lives: 3, jumpStrength: 420, gravity: 950 },
  towerDefense: { hazardSpeed: 180, spawnIntervalMs: 420, winScore: 9, startingCoins: 120, baseHealth: 48 },
  collector: { playerSpeed: 300, hazardSpeed: 260, spawnIntervalMs: 520, winScore: 36, lives: 3 },
  survivor: { playerSpeed: 300, hazardSpeed: 300, spawnIntervalMs: 520, winScore: 50, lives: 3 },
  avoider: { playerSpeed: 300, hazardSpeed: 300, spawnIntervalMs: 520, winScore: 50, lives: 1 },
  coaster: { playerSpeed: 260, hazardSpeed: 220, spawnIntervalMs: 640, winScore: 100, lives: 3 },
  puzzle: { playerSpeed: 260, hazardSpeed: 220, spawnIntervalMs: 760, winScore: 20, lives: 3 },
  customization: { playerSpeed: 240, hazardSpeed: 200, spawnIntervalMs: 760, winScore: 18, lives: 3 },
  strategy: { playerSpeed: 260, hazardSpeed: 220, spawnIntervalMs: 700, winScore: 16, lives: 3, startingCoins: 140, baseHealth: 48 },
  farming: { playerSpeed: 260, hazardSpeed: 200, spawnIntervalMs: 760, winScore: 24, lives: 3, startingCoins: 120, baseHealth: 48 },
  chess: { playerSpeed: 220, hazardSpeed: 180, spawnIntervalMs: 900, winScore: 1, lives: 1 },
  physics: { playerSpeed: 280, hazardSpeed: 220, spawnIntervalMs: 760, winScore: 18, lives: 3 },
};

function floorGameplay(spec: GameSpec): GameSpec {
  const floor = TEMPLATE_FLOORS[spec.templateId] ?? {};
  const gp = spec.gameplay;
  return {
    ...spec,
    gameplay: {
      ...gp,
      playerSpeed: Math.max(gp.playerSpeed, floor.playerSpeed ?? gp.playerSpeed),
      hazardSpeed: Math.max(gp.hazardSpeed, floor.hazardSpeed ?? gp.hazardSpeed),
      spawnIntervalMs: Math.max(gp.spawnIntervalMs, floor.spawnIntervalMs ?? gp.spawnIntervalMs),
      winScore: Math.max(gp.winScore ?? 0, floor.winScore ?? 0) || gp.winScore,
      lives: Math.max(gp.lives ?? 0, floor.lives ?? 0) || gp.lives,
      jumpStrength:
        gp.jumpStrength != null ? Math.max(gp.jumpStrength, floor.jumpStrength ?? gp.jumpStrength) : gp.jumpStrength,
      gravity: gp.gravity != null ? Math.max(gp.gravity, floor.gravity ?? gp.gravity) : gp.gravity,
      startingCoins:
        gp.startingCoins != null
          ? Math.max(gp.startingCoins, floor.startingCoins ?? gp.startingCoins)
          : gp.startingCoins,
      baseHealth:
        gp.baseHealth != null ? Math.max(gp.baseHealth, floor.baseHealth ?? gp.baseHealth) : gp.baseHealth,
    },
  };
}

function makeThemeRicher(spec: GameSpec): GameSpec {
  const theme = spec.theme;
  const collectible = theme.collectibleColor ?? mixHex(theme.playerColor, theme.hazardColor, 0.5);
  const particleTint = theme.particleTint ?? mixHex(collectible, theme.backgroundColor, 0.32);
  const hazardColor =
    theme.hazardColor.toLowerCase() === theme.playerColor.toLowerCase()
      ? mixHex(theme.hazardColor, "#ffffff", 0.26)
      : theme.hazardColor;
  return {
    ...spec,
    theme: {
      ...theme,
      hazardColor,
      collectibleColor: collectible,
      particleTint,
    },
  };
}

function syncFarmingEconomy(spec: GameSpec, prompt = ""): GameSpec {
  if (spec.templateId !== "farming" && !spec.farming) return spec;
  const coins = spec.gameplay.startingCoins;
  if (typeof coins !== "number") return spec;
  const farming = spec.farming ?? buildFarmingBlueprint({ prompt, spec });
  if (farming.startingCoins === coins) return spec;
  return {
    ...spec,
    farming: {
      ...farming,
      startingCoins: coins,
    },
  };
}

function ensureCommercialBlueprints(spec: GameSpec, prompt = ""): GameSpec {
  if (spec.templateId === "puzzle" && !spec.puzzle) {
    return { ...spec, puzzle: buildPuzzleBlueprint({ prompt, spec }) };
  }
  if (spec.templateId === "chess" && !spec.chess) {
    return { ...spec, chess: buildChessBlueprint({ prompt, spec }) };
  }
  return spec;
}

function ensureCommercialDirector(spec: GameSpec, prompt: string, locale: AppLocale): GameSpec {
  if ((spec.director?.events?.length ?? 0) >= 3) return spec;
  const rebuilt = buildDirector({
    prompt: `${prompt || spec.title} 成品 复杂 目标 金币 boss 奖励`,
    spec,
    locale,
  });
  if ((rebuilt.events?.length ?? 0) >= 3) {
    return { ...spec, director: rebuilt };
  }

  const events = [...(rebuilt.events ?? [])];
  const addIfMissing = (type: string, at: number) => {
    if (events.some((e) => e.type === type)) return;
    events.push({
      at,
      type,
      strength: 0.72,
      durationMs: 4800,
    });
  };
  addIfMissing("coinRain", 0.34);
  addIfMissing("goalShift", 0.58);
  addIfMissing("miniBoss", 0.82);

  return {
    ...spec,
    director: {
      ...rebuilt,
      events: events.slice(0, 8),
    },
  };
}

/**
 * 硬质量底线：给任意用户生成的 GameSpec 做“成品化”兜底。
 * 目标不是改玩法语义，而是把视觉、音频、节奏与数值拉到更像成品的区间。
 */
export function applyHardQualityDefaults(spec: GameSpec, prompt = "", locale: AppLocale = "zh-Hans"): GameSpec {
  if (resolveQualityTier() === "fast") return spec;
  if (spec.samplePlayProfile?.variantId) return spec;

  let next = withPresentationDefaults(spec);
  next = makeThemeRicher(next);

  if (!next.director?.acts?.length || !next.director.events?.length) {
    next = {
      ...next,
      director: buildDirector({ prompt: prompt || next.title, spec: next, locale }),
    };
  }

  if (!next.systems) {
    next = {
      ...next,
      systems: buildSystems({ prompt: prompt || next.title, spec: next }),
    };
  }

  next = ensureCommercialDirector(next, prompt || next.title, locale);
  next = floorGameplay(next);
  next = syncFarmingEconomy(next, prompt || next.title);
  next = ensureCommercialBlueprints(next, prompt || next.title);

  return next;
}
