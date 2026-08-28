import type { GameSpec } from "@/lib/game-spec";

export type GameEditControl = {
  id: string;
  group: "identity" | "gameplay" | "pacing" | "visual" | "audio";
  label: string;
  path: string;
  kind: "text" | "color" | "slider" | "select";
  value: string | number;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  gameplayImpact: string;
};

export type GameEditSchema = {
  version: 1;
  kind: "game_edit_schema";
  templateId: GameSpec["templateId"];
  runtimeStrategy: "dedicated_runtime" | "independent_agentic_module" | "independent_webgl_runtime";
  controls: GameEditControl[];
};

function slider(
  id: string,
  group: GameEditControl["group"],
  label: string,
  path: string,
  value: number,
  min: number,
  max: number,
  step: number,
  gameplayImpact: string,
): GameEditControl {
  return { id, group, label, path, kind: "slider", value, min, max, step, gameplayImpact };
}

/**
 * Build the custom edit surface for one immutable game revision. Controls are
 * derived from the authored spec; they never select or author a template.
 */
export function buildGameEditSchema(spec: GameSpec): GameEditSchema {
  const controls: GameEditControl[] = [
    { id: "title", group: "identity", label: "游戏标题", path: "title", kind: "text", value: spec.title, gameplayImpact: "修改作品身份，不改变规则。" },
    { id: "player_color", group: "visual", label: "玩家主色", path: "theme.playerColor", kind: "color", value: spec.theme.playerColor, gameplayImpact: "改变玩家辨识度。" },
    { id: "hazard_color", group: "visual", label: "威胁主色", path: "theme.hazardColor", kind: "color", value: spec.theme.hazardColor, gameplayImpact: "改变危险目标辨识度。" },
    slider("player_speed", "gameplay", "移动速度", "gameplay.playerSpeed", spec.gameplay.playerSpeed ?? 280, 100, 900, 10, "直接改变操控响应和躲避窗口。"),
    slider("hazard_speed", "gameplay", "威胁速度", "gameplay.hazardSpeed", spec.gameplay.hazardSpeed ?? 180, 20, 800, 10, "直接改变追逐压力。"),
    slider("spawn_interval", "pacing", "生成间隔", "gameplay.spawnIntervalMs", spec.gameplay.spawnIntervalMs ?? 700, 200, 3500, 50, "越低则单位时间内压力越高。"),
    slider("win_score", "pacing", "胜利目标", "gameplay.winScore", spec.gameplay.winScore ?? 20, 1, 500, 1, "决定单局长度和目标密度。"),
    slider("lives", "gameplay", "生命数量", "gameplay.lives", spec.gameplay.lives ?? 3, 1, 8, 1, "决定容错和失败节奏。"),
  ];

  if (spec.production) {
    controls.push(
      slider("first_reward", "pacing", "首次奖励时间", "production.delivery.firstRewardBySecond", spec.production.delivery?.firstRewardBySecond ?? 20, 3, 20, 1, "控制 time-to-fun。"),
      slider("music_gain", "audio", "音乐音量", "production.audio.mix.musicGain", spec.production.audio.mix.musicGain, 0, 1, 0.05, "调整音乐与操作反馈的混音层级。"),
      slider("sfx_gain", "audio", "音效音量", "production.audio.mix.sfxGain", spec.production.audio.mix.sfxGain, 0, 1, 0.05, "调整动作反馈的清晰度。"),
    );
  }

  return {
    version: 1,
    kind: "game_edit_schema",
    templateId: spec.templateId,
    runtimeStrategy: spec.samplePlayProfile?.showcaseRuntime === "voxel-frontier"
      ? "independent_webgl_runtime"
      : spec.agenticPlayRoute === "agentic"
        ? "independent_agentic_module"
        : "dedicated_runtime",
    controls,
  };
}
