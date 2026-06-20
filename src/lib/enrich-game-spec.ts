import type { AppLocale } from "@/i18n/routing";
import type { GameSpec } from "@/lib/game-spec";
import { withPresentationDefaults, withVisualDefaults } from "@/lib/cohesive-presentation";
import { buildCoasterBlueprint } from "@/lib/coaster-blueprint";
import { buildFarmingBlueprint } from "@/lib/farming-blueprint";
import { buildPlatformerBlueprint } from "@/lib/platformer-blueprint";
import { buildPuzzleBlueprint } from "@/lib/puzzle-blueprint";
import { buildShooterBlueprint } from "@/lib/shooter-blueprint";
import { buildCollectorBlueprint } from "@/lib/collector-blueprint";
import { buildSurvivorBlueprint } from "@/lib/survivor-blueprint";
import { buildAvoiderBlueprint } from "@/lib/avoider-blueprint";
import { buildCustomizationBlueprint } from "@/lib/customization-blueprint";
import { buildStrategyBlueprint } from "@/lib/strategy-blueprint";
import { buildRhythmBlueprint } from "@/lib/rhythm-blueprint";
import { buildSportsBlueprint } from "@/lib/sports-blueprint";
import { buildCardBlueprint } from "@/lib/card-blueprint";
import { buildFightingBlueprint } from "@/lib/fighting-blueprint";
import { buildMobaBlueprint } from "@/lib/moba-blueprint";
import { buildHorrorBlueprint } from "@/lib/horror-blueprint";
import { buildMahjongBlueprint } from "@/lib/mahjong-blueprint";
import { buildTetrisBlueprint } from "@/lib/tetris-blueprint";
import { buildEndlessRunnerBlueprint } from "@/lib/endless-runner-blueprint";
import { buildFruitNinjaBlueprint } from "@/lib/fruit-ninja-blueprint";
import { buildDirector } from "@/lib/director";
import { buildTowerDefenseBlueprint } from "@/lib/td-blueprint";
import { applyHardQualityDefaults } from "@/lib/game-quality";
import { resolveTemplateRuntime } from "@/lib/game-templates/registry";
import { fingerprintPrompt } from "@/lib/prompt-fingerprint";
import { injectThemeLabels } from "@/lib/theme-injection";
import { adaptThemeFromFingerprint, applyThemeAdaptation } from "@/lib/prompt-theme-adapter";
import {
  applySamplePlayProfile,
  inferSampleIdFromPrompt,
  reapplySamplePlayProfileByVariant,
  sampleIdFromProjectId,
} from "@/lib/sample-play-profiles";

export type EnrichGameSpecOptions = {
  projectId?: string;
  sampleId?: string;
};

/**
 * Phaser / Godot 共用：导出与试玩前补全导演、塔防蓝图、试听与粒子色，
 * 保证双轨从同一份「高质量」GameSpec 起跑。
 */
export function enrichGameSpecForRuntime(
  spec: GameSpec,
  promptHint = "",
  locale: AppLocale = "zh-Hans",
  opts: EnrichGameSpecOptions = {},
): GameSpec {
  const hint = promptHint || spec.title;
  let next = withPresentationDefaults(spec);
  next = withVisualDefaults(next);

  // 千人千面：尽早注入 prompt fingerprint（seed + mood + themeWords）到 samplePlayProfile
  // 让后续 blueprint builder 能读 seed 做数值微调（同模板不同 prompt 出不同游戏）
  if (!next.samplePlayProfile?.seed) {
    const fp = fingerprintPrompt(hint);
    next = {
      ...next,
      samplePlayProfile: {
        ...(next.samplePlayProfile ?? { variantId: `fp-${fp.seedInt.toString(36)}` }),
        seed: fp.seed,
        mood: fp.mood,
        themeWords: fp.themeWords,
      },
    };
  }

  const rt = resolveTemplateRuntime(next.templateId);

  if (rt.blueprint === "coaster") {
    next = {
      ...next,
      coaster: buildCoasterBlueprint({ prompt: hint, spec: next }),
    };
  }

  if (rt.blueprint === "puzzle") {
    next = {
      ...next,
      puzzle: buildPuzzleBlueprint({ prompt: hint, spec: next }),
    };
  }

  if (rt.blueprint === "farming") {
    next = {
      ...next,
      farming: buildFarmingBlueprint({ prompt: hint, spec: next }),
    };
  }

  if (rt.blueprint === "strategy") {
    next = {
      ...next,
      strategy: buildStrategyBlueprint({ prompt: hint, spec: next }),
    };
  }

  if (rt.blueprint === "rhythm" && !next.rhythm) {
    next = {
      ...next,
      rhythm: buildRhythmBlueprint({ prompt: hint, spec: next }),
    };
  }

  if (rt.blueprint === "sports" && !next.sports) {
    next = {
      ...next,
      sports: buildSportsBlueprint({ prompt: hint, spec: next }),
    };
  }

  if (rt.blueprint === "card" && !next.card) {
    next = {
      ...next,
      card: buildCardBlueprint({ prompt: hint, spec: next }),
    };
  }

  if (rt.blueprint === "fighting" && !next.fighting) {
    next = {
      ...next,
      fighting: buildFightingBlueprint({ prompt: hint, spec: next }),
    };
  }

  if (rt.blueprint === "moba" && !next.moba) {
    next = {
      ...next,
      moba: buildMobaBlueprint({ prompt: hint, spec: next }),
    };
  }

  if (rt.blueprint === "horror" && !next.horror) {
    next = {
      ...next,
      horror: buildHorrorBlueprint({ prompt: hint, spec: next }),
    };
  }

  // 4 个真玩法独立模板（按 templateId 检测，不依赖 rt.blueprint 因为 definitions 未标 blueprint 字段）
  if (next.templateId === "mahjong" && !next.mahjong) {
    next = { ...next, mahjong: buildMahjongBlueprint({ prompt: hint, spec: next }) };
  }
  if (next.templateId === "tetris" && !next.tetris) {
    next = { ...next, tetris: buildTetrisBlueprint({ prompt: hint, spec: next }) };
  }
  if (next.templateId === "endless-runner" && !next.endlessRunner) {
    next = { ...next, endlessRunner: buildEndlessRunnerBlueprint({ prompt: hint, spec: next }) };
  }
  if (next.templateId === "fruit-ninja" && !next.fruitNinja) {
    next = { ...next, fruitNinja: buildFruitNinjaBlueprint({ prompt: hint, spec: next }) };
  }

  if (rt.blueprint === "towerDefense") {
    next = {
      ...next,
      towerDefense: buildTowerDefenseBlueprint({ prompt: hint, spec: next }),
    };
  }

  if (next.templateId === "shooter" && !next.shooter) {
    next = {
      ...next,
      shooter: buildShooterBlueprint({ prompt: hint, spec: next }),
    };
  }

  if (next.templateId === "collector" && !next.collector) {
    next = {
      ...next,
      collector: buildCollectorBlueprint({ prompt: hint, spec: next }),
    };
  }

  if (next.templateId === "survivor" && !next.survivor) {
    next = {
      ...next,
      survivor: buildSurvivorBlueprint({ prompt: hint, spec: next }),
    };
  }

  if (next.templateId === "avoider" && !next.avoider) {
    next = {
      ...next,
      avoider: buildAvoiderBlueprint({ prompt: hint, spec: next }),
    };
  }

  if (next.templateId === "customization") {
    next = {
      ...next,
      customization: buildCustomizationBlueprint({ prompt: hint, spec: next }),
    };
  }

  if (!next.director?.events?.length) {
    const built = buildDirector({ prompt: hint, spec: next, locale });
    next = {
      ...next,
      director: next.director
        ? {
            ...built,
            intensity: next.director.intensity ?? built.intensity,
            acts: next.director.acts?.length ? next.director.acts : built.acts,
            events: built.events,
          }
        : built,
    };
  } else if (!next.director) {
    next = {
      ...next,
      director: {
        intensity: 0.55,
        acts: [{ at: 0, label: "开局", modifiers: [] }],
      },
    };
  }

  if (!next.director?.events?.length) {
    const fallbackActs = next.director?.acts?.length
      ? next.director.acts
      : [{ at: 0, label: "开局", modifiers: [] as string[] }];
    next = {
      ...next,
      director: {
        intensity: next.director?.intensity ?? 0.55,
        acts: fallbackActs,
        events: [
          {
            at: 0.52,
            type: "coinRain" as const,
            strength: 0.58,
            durationMs: 4400,
            title: "奖励窗口",
            message: "短时间内把握节奏，收益更高",
          },
        ],
      },
    };
  }

  if (!next.theme.particleTint && next.theme.collectibleColor) {
    next = {
      ...next,
      theme: {
        ...next.theme,
        particleTint: next.theme.collectibleColor,
      },
    };
  }

  if (rt.phaser === "platformer") {
    const platBp = buildPlatformerBlueprint({ prompt: hint, spec: next });
    const winScore = Math.max(next.gameplay.winScore ?? 0, platBp.suggestedWinScore ?? 0);
    next = {
      ...next,
      platformer: platBp,
      gameplay: { ...next.gameplay, winScore },
    };
  }

  const sampleId =
    opts.sampleId ??
    sampleIdFromProjectId(opts.projectId) ??
    inferSampleIdFromPrompt(hint) ??
    spec.samplePlayProfile?.variantId;
  if (sampleId) {
    next = applySamplePlayProfile(next, sampleId, hint);
  } else if (next.samplePlayProfile?.variantId) {
    next = reapplySamplePlayProfileByVariant(next, hint);
  }

  // 千人千面 B：主题深度注入——若 labels 仍是通用占位词，用 prompt 主题词派生替换
  next = injectThemeLabels(next, hint);

  // 先跑 applyHardQualityDefaults（数值保底）
  next = applyHardQualityDefaults(next, hint, locale);

  // 千人千面深度适配：最后一步强制覆盖（主题适配是用户意图最高优先级）
  // 自动适配背景色相、musicProfile、bgmTag、敌人/收集物颜色
  if (next.samplePlayProfile?.seed !== undefined) {
    const fp = fingerprintPrompt(hint);
    const adaptation = adaptThemeFromFingerprint(fp);
    next = applyThemeAdaptation(next, adaptation);
  }

  return next;
}
