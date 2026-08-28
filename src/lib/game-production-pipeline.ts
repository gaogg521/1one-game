import type { GameSpec } from "@/lib/game-spec";
import type { GameDeliveryReadiness } from "@/lib/game-delivery-readiness";
import type { GameVerticalSliceScorecard } from "@/lib/game-vertical-slice";

export const GAME_PREFLIGHT_STAGE_IDS = [
  "requirements",
  "gameplay_definition",
  "prototype",
  "technical_design",
  "ux_design",
  "development",
  "balance",
] as const;

export const GAME_PRODUCTION_ROLES = [
  "design_director",
  "gameplay_designer",
  "art_director",
  "ux_designer",
  "runtime_engineer",
  "qa_agent",
] as const;

export type GameProductionRole = (typeof GAME_PRODUCTION_ROLES)[number];
export type GameRuntimeStrategy = "dedicated_runtime" | "independent_agentic_module" | "independent_webgl_runtime";
export type GameProductionStageId =
  | (typeof GAME_PREFLIGHT_STAGE_IDS)[number]
  | "asset_production"
  | "mobile_test"
  | "release"
  | "operations";
export type GameProductionStage = {
  id: GameProductionStageId;
  owner: GameProductionRole;
  status: "ready" | "pending" | "blocked";
  objective: string;
  deliverables: string[];
  acceptance: string[];
  dependsOn: GameProductionStageId[];
  evidence: string[];
};

export type GamePlaytestScenario = {
  id: "first_input" | "core_loop" | "failure_recovery" | "win_state" | "mobile_session";
  owner: "qa_agent";
  requiredEvidence: string[];
};

export type GameProductionPipelineReport = {
  version: 1;
  kind: "game_production_pipeline";
  preflightVerdict: "ready" | "blocked";
  runtimeStrategy: GameRuntimeStrategy;
  roleCoverage: GameProductionRole[];
  requiredPlaytests: GamePlaytestScenario[];
  stages: GameProductionStage[];
};

const REQUIRED_PLAYTESTS: GamePlaytestScenario[] = [
  { id: "first_input", owner: "qa_agent", requiredEvidence: ["first_input_registered", "input_feedback_visible"] },
  { id: "core_loop", owner: "qa_agent", requiredEvidence: ["core_action_repeated", "game_state_changed"] },
  { id: "failure_recovery", owner: "qa_agent", requiredEvidence: ["failure_observed", "restart_succeeded"] },
  { id: "win_state", owner: "qa_agent", requiredEvidence: ["win_condition_reached", "completion_feedback_visible"] },
  { id: "mobile_session", owner: "qa_agent", requiredEvidence: ["touch_input_observed", "active_60s", "no_runtime_error"] },
];

/**
 * Immutable, executable hand-off from product intent to a playable build.
 * Observed mobile playtest/release/operations evidence is attached later to
 * the same CreativeRevision; those stages must not be fabricated at compile time.
 */
export function buildGameProductionPipelineReport(input: {
  spec: GameSpec;
  verticalSlice: GameVerticalSliceScorecard;
  delivery: GameDeliveryReadiness;
  sceneCount: number;
  behaviorNodeCount: number;
}): GameProductionPipelineReport {
  const { spec, verticalSlice, delivery } = input;
  const contract = spec.production?.delivery;
  const runtimeStrategy: GameRuntimeStrategy = spec.samplePlayProfile?.showcaseRuntime === "voxel-frontier"
    ? "independent_webgl_runtime"
    : spec.agenticPlayRoute === "agentic"
      ? "independent_agentic_module"
      : "dedicated_runtime";
  const agenticRuntimeReady = runtimeStrategy !== "independent_agentic_module" || Boolean(spec.agenticModule);
  const stages: GameProductionStage[] = [
    {
      id: "requirements",
      owner: "design_director",
      status: contract?.targetDevice === "mobile_h5" && Boolean(contract.primaryInput && contract.playerGoal) ? "ready" : "blocked",
      objective: "把创作意图收敛为一局可验收的玩家体验。",
      deliverables: ["creative_brief", "player_goal", "session_contract"],
      acceptance: ["目标设备明确", "玩家目标可在一句话内说明", "首局时长有上限"],
      dependsOn: [],
      evidence: contract
        ? [`device:${contract.targetDevice}`, `session:${contract.targetSessionSeconds}s`, `input:${contract.primaryInput}`, `goal:${contract.playerGoal}`]
        : ["delivery_contract_missing"],
    },
    {
      id: "gameplay_definition",
      owner: "gameplay_designer",
      status: contract?.winCondition && contract.failCondition && (spec.gameplay.winScore ?? 0) > 0 && (spec.gameplay.lives ?? 0) > 0 ? "ready" : "blocked",
      objective: "定义可重复的核心循环、胜负状态与恢复路径。",
      deliverables: ["game_spec", "core_loop", "win_fail_rules"],
      acceptance: ["至少一个有效核心动作", "胜利条件可触发", "失败后可立即重试"],
      dependsOn: ["requirements"],
      evidence: contract
        ? [`core_action:${verticalSlice.contract.coreAction}`, `win:${contract.winCondition}`, `fail:${contract.failCondition}`]
        : ["win_fail_contract_missing"],
    },
    {
      id: "prototype",
      owner: "gameplay_designer",
      status: verticalSlice.verdict === "blocked" ? "blocked" : "ready",
      objective: "在完整生产前证明首分钟纵切真实可玩。",
      deliverables: ["vertical_slice", "first_minute_beats"],
      acceptance: ["5 秒内理解输入", "20 秒内获得首次奖励", "60 秒内出现高潮或结算"],
      dependsOn: ["gameplay_definition"],
      evidence: [`vertical_slice:${verticalSlice.verdict}`, `vertical_slice_score:${verticalSlice.score}`, `first_minute_beats:${verticalSlice.contract.firstMinute.length}`],
    },
    {
      id: "technical_design",
      owner: "runtime_engineer",
      status: input.sceneCount > 0 && input.behaviorNodeCount > 0 && agenticRuntimeReady ? "ready" : "blocked",
      objective: "选择与玩法复杂度匹配的运行时，而不是把所有创意压进同一模板。",
      deliverables: ["scene_graph", "behavior_graph", "runtime_strategy"],
      acceptance: ["场景图非空", "行为图非空", "独立模块路线必须有可执行模块"],
      dependsOn: ["prototype"],
      evidence: [`template:${spec.templateId}`, `runtime_strategy:${runtimeStrategy}`, `agentic_module:${spec.agenticModule ? "attached" : "absent"}`, `scene_count:${input.sceneCount}`, `behavior_node_count:${input.behaviorNodeCount}`],
    },
    {
      id: "ux_design",
      owner: "ux_designer",
      status: contract?.primaryInput && contract.firstRewardBySecond <= 20 ? "ready" : "blocked",
      objective: "把输入、目标、反馈和重开做成玩家无需猜测的交互路径。",
      deliverables: ["input_contract", "hud_information_hierarchy", "restart_path"],
      acceptance: ["主输入明确", "首次奖励不晚于 20 秒", "胜负反馈和重开入口可见"],
      dependsOn: ["gameplay_definition"],
      evidence: contract ? [`primary_input:${contract.primaryInput}`, `first_reward:${contract.firstRewardBySecond}s`, "restart_path:required"] : ["delivery_contract_missing"],
    },
    {
      id: "development",
      owner: "runtime_engineer",
      status: spec.production?.levelFlow.length === 4 && spec.production.audio.sections.length === 4 ? "ready" : "blocked",
      objective: "交付包含输入、状态、音画反馈和明确终局的可执行构建。",
      deliverables: ["playable_build", "level_flow", "audio_arc", "end_state"],
      acceptance: ["四段首分钟流程完整", "音乐随阶段变化", "运行时存在终局状态"],
      dependsOn: ["technical_design", "ux_design"],
      evidence: [`level_flow:${spec.production?.levelFlow.length ?? 0}`, `music_sections:${spec.production?.audio.sections.length ?? 0}`, "runtime_end_state:required"],
    },
    {
      id: "asset_production",
      owner: "art_director",
      status: "pending",
      objective: "为该游戏生产风格一致、可追溯且与玩法语义对应的独立资产。",
      deliverables: ["asset_manifest", "background", "player_visual", "enemy_visual", "ui_visuals", "audio_assets"],
      acceptance: ["核心角色不使用占位几何", "资产清单记录来源与用途", "封面与实际玩法画面一致"],
      dependsOn: ["requirements", "gameplay_definition"],
      evidence: ["requires_durable_asset_manifest", `asset_style:${verticalSlice.artDirection.visual.assetStyle}`],
    },
    {
      id: "balance",
      owner: "qa_agent",
      status: delivery.verdict === "blocked" || delivery.balance.verdict === "blocked" ? "blocked" : "ready",
      objective: "在真实手玩前排除数值上不可完成或立即失败的构建。",
      deliverables: ["balance_simulation", "delivery_preflight"],
      acceptance: ["场景扫测不阻断", "首局成功率处于可测试区间", "关键数值在安全范围"],
      dependsOn: ["development"],
      evidence: [`delivery:${delivery.verdict}`, `delivery_score:${delivery.score}`, `scenario_pass_rate:${Math.round(delivery.balance.passRate * 100)}%`],
    },
    { id: "mobile_test", owner: "qa_agent", status: "pending", objective: "用真实触屏完成首局、失败、重开和胜利路径。", deliverables: ["game_playtest_delivery", "browser_console_report"], acceptance: REQUIRED_PLAYTESTS.flatMap((scenario) => scenario.requiredEvidence), dependsOn: ["development", "asset_production", "balance"], evidence: ["requires_observed_60s_mobile_session"] },
    { id: "release", owner: "design_director", status: "pending", objective: "只发布通过资产和手玩门槛的不可变版本。", deliverables: ["accepted_revision", "publication_display"], acceptance: ["作者确认版本", "资产门槛通过", "移动手玩证据通过"], dependsOn: ["mobile_test"], evidence: ["requires_author_publish_decision"] },
    { id: "operations", owner: "qa_agent", status: "pending", objective: "用真实玩家数据识别短局流失并驱动下一轮修订。", deliverables: ["session_funnel", "failure_distribution", "retry_metrics"], acceptance: ["统计 0-10/10-30/30-60/60+ 秒会话", "记录首个有效动作", "记录胜负和重试"], dependsOn: ["release"], evidence: ["requires_post_release_aggregate_telemetry"] },
  ];
  const preflightVerdict = stages
    .filter((stage) => GAME_PREFLIGHT_STAGE_IDS.includes(stage.id as (typeof GAME_PREFLIGHT_STAGE_IDS)[number]))
    .some((stage) => stage.status === "blocked")
    ? "blocked"
    : "ready";
  const roleCoverage = GAME_PRODUCTION_ROLES.filter((role) => stages.some((stage) => stage.owner === role));
  return {
    version: 1,
    kind: "game_production_pipeline",
    preflightVerdict,
    runtimeStrategy,
    roleCoverage,
    requiredPlaytests: REQUIRED_PLAYTESTS,
    stages,
  };
}
