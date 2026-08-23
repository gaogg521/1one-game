import type { GameSpec } from "@/lib/game-spec";

export type GameDesignEntity = {
  id: "player" | "hazard" | "collectible" | "goal";
  role: "player" | "threat" | "reward" | "objective";
  label: string;
  properties: Record<string, string | number | boolean>;
};

export type GameSceneGraph = {
  version: 1;
  templateId: GameSpec["templateId"];
  scenes: Array<{
    id: string;
    purpose: "onboard" | "play" | "complete";
    entities: GameDesignEntity["id"][];
    objective: string;
    act?: { at: number; label: string; modifiers: string[] };
  }>;
  entities: GameDesignEntity[];
};

export type GameBehaviorGraph = {
  version: 1;
  templateId: GameSpec["templateId"];
  nodes: Array<{
    id: string;
    kind: "event" | "input" | "scheduler" | "rule" | "state" | "terminal";
    label: string;
    config?: Record<string, string | number | boolean>;
  }>;
  edges: Array<{ from: string; to: string; when: string }>;
};

function goalLabel(spec: GameSpec): string {
  const target = spec.gameplay.winScore;
  const noun = spec.labels.collectible ?? "目标";
  return target ? `收集/得分 ${target} ${noun}` : `完成 ${noun} 目标`;
}

/**
 * A deterministic, inspectable design projection of the executable spec.
 * It is intentionally not a second game runtime: every number is copied from
 * GameSpec, so authors can review versioned scene and behaviour intent without
 * the projection drifting from the playable work.
 */
export function buildGameDesignGraphs(spec: GameSpec): {
  sceneGraph: GameSceneGraph;
  behaviorGraph: GameBehaviorGraph;
} {
  const hasCollectible = Boolean(spec.labels.collectible);
  const target = spec.gameplay.winScore ?? 1;
  const goal = goalLabel(spec);
  const acts = [...(spec.director?.acts ?? [])].sort((a, b) => a.at - b.at);
  const entities: GameDesignEntity[] = [
    {
      id: "player",
      role: "player",
      label: spec.labels.player,
      properties: { speed: spec.gameplay.playerSpeed, lives: spec.gameplay.lives ?? 1 },
    },
    {
      id: "hazard",
      role: "threat",
      label: spec.labels.hazard,
      properties: { speed: spec.gameplay.hazardSpeed, spawnIntervalMs: spec.gameplay.spawnIntervalMs },
    },
    ...(hasCollectible
      ? [{ id: "collectible" as const, role: "reward" as const, label: spec.labels.collectible!, properties: { target } }]
      : []),
    { id: "goal", role: "objective", label: goal, properties: { target } },
  ];

  return {
    sceneGraph: {
      version: 1,
      templateId: spec.templateId,
      entities,
      scenes: [
        { id: "opening", purpose: "onboard", entities: ["player", "goal"], objective: `让玩家理解：${goal}` },
        ...acts.map((act, index) => ({
          id: `act-${index + 1}`,
          purpose: "play" as const,
          entities: (hasCollectible ? ["player", "hazard", "collectible", "goal"] : ["player", "hazard", "goal"]) as GameDesignEntity["id"][],
          objective: act.label,
          act: { at: act.at, label: act.label, modifiers: act.modifiers },
        })),
        {
          id: "main_loop",
          purpose: "play",
          entities: hasCollectible ? ["player", "hazard", "collectible", "goal"] : ["player", "hazard", "goal"],
          objective: goal,
        },
        { id: "resolution", purpose: "complete", entities: ["player", "goal"], objective: "结算并呈现下一步创作反馈" },
      ],
    },
    behaviorGraph: {
      version: 1,
      templateId: spec.templateId,
      nodes: [
        { id: "start", kind: "event", label: "开始试玩" },
        { id: "player_control", kind: "input", label: `${spec.labels.player} 控制`, config: { speed: spec.gameplay.playerSpeed } },
        { id: "spawn_hazard", kind: "scheduler", label: `${spec.labels.hazard} 生成`, config: { everyMs: spec.gameplay.spawnIntervalMs, speed: spec.gameplay.hazardSpeed } },
        { id: "resolve_collision", kind: "rule", label: "碰撞、奖励与容错结算", config: { lives: spec.gameplay.lives ?? 1 } },
        { id: "track_progress", kind: "state", label: goal, config: { target } },
        ...acts.map((act, index) => ({
          id: `director_act_${index + 1}`,
          kind: "event" as const,
          label: act.label,
          config: { at: act.at, modifiers: act.modifiers.join(",") || "none" },
        })),
        { id: "complete", kind: "terminal", label: "完成并写入试玩结果" },
      ],
      edges: [
        { from: "start", to: "player_control", when: "scene_ready" },
        { from: "start", to: "spawn_hazard", when: "scene_ready" },
        { from: "player_control", to: "resolve_collision", when: "contact_or_collect" },
        { from: "spawn_hazard", to: "resolve_collision", when: "hazard_active" },
        { from: "resolve_collision", to: "track_progress", when: "state_changed" },
        ...acts.map((_, index) => ({
          from: "track_progress",
          to: `director_act_${index + 1}`,
          when: `timeline_at_${Math.round(acts[index]!.at * 100)}%`,
        })),
        { from: "track_progress", to: "complete", when: "target_reached" },
      ],
    },
  };
}
