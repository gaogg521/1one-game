import type { GameSpec } from "@/lib/game-spec";
import { withPresentationDefaults } from "@/lib/cohesive-presentation";
import { buildDirector } from "@/lib/director";
import { buildTowerDefenseBlueprint } from "@/lib/td-blueprint";

/**
 * Phaser / Godot 共用：导出与试玩前补全导演、塔防蓝图、试听与粒子色，
 * 保证双轨从同一份「高质量」GameSpec 起跑。
 */
export function enrichGameSpecForRuntime(spec: GameSpec, promptHint = ""): GameSpec {
  const hint = promptHint || spec.title;
  let next = withPresentationDefaults(spec);

  if (next.templateId === "towerDefense" && !next.towerDefense) {
    next = {
      ...next,
      towerDefense: buildTowerDefenseBlueprint({ prompt: hint, spec: next }),
    };
  }

  if (!next.director?.events?.length) {
    const built = buildDirector({ prompt: hint, spec: next });
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

  return next;
}
