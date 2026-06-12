/**
 * 多 Agent 并行 spec 生成（取代单次大 prompt 的 draft+enhance 路径）。
 *
 * 三个专业 Agent 并行运行：
 *   - World Agent  → narrative layer（title / templateId / labels）
 *   - Gameplay Agent → mechanics layer（gameplay / director / systems）
 *   - Art Agent    → visual layer（theme / presentation）
 *
 * Director 层（代码层面）合并三者为完整 GameSpec，再走正常 lint-repair 闭环。
 */

import type { GameSpec } from "@/lib/game-spec";
import { llmJson, getProviderModelCascade } from "@/lib/llm";
import { coerceGameSpec } from "@/lib/normalize-spec";
import type { RunTraceRecorder } from "@/lib/orchestration/run-trace";

// ─── Shared helpers ────────────────────────────────────────────────────────

import { GAME_TEMPLATE_IDS } from "@/lib/game-templates/registry";

function pickModel(): string {
  const models = getProviderModelCascade();
  return models[0] ?? "gpt-4o-mini";
}

function safeJson(raw: unknown | null): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

// ─── World Agent ────────────────────────────────────────────────────────────

const WORLD_SYSTEM = `你是「游戏世界观设计师」。用户描述想玩的小游戏，你只负责叙事层：
- 推导最合适的 templateId（avoider/collector/survivor/platformer/towerDefense/shooter）
- 起一个有幻想感的 title（不抄用户原文，≤40字）
- 给出角色、威胁、收集物的中文名称，以及一句氛围 subtitle（≤80字）
- 只输出一个 JSON，不要 markdown，不要代码块。`;

const WORLD_SCHEMA = {
  name: "world_spec",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      templateId: { type: "string", enum: [...GAME_TEMPLATE_IDS] },
      title: { type: "string" },
      labels: {
        type: "object",
        additionalProperties: false,
        properties: {
          player: { type: "string" },
          hazard: { type: "string" },
          collectible: { type: "string" },
          subtitle: { type: "string" },
        },
        required: ["player", "hazard", "collectible", "subtitle"],
      },
    },
    required: ["templateId", "title", "labels"],
  },
} as const;

async function callWorldAgent(prompt: string): Promise<{ templateId: string; title: string; labels: GameSpec["labels"] } | null> {
  const model = pickModel();
  const res = await llmJson({
    model,
    system: WORLD_SYSTEM,
    user: prompt,
    temperature: 0.6,
    mode: "json_schema",
    jsonSchema: WORLD_SCHEMA,
    timeoutMs: 14000,
  }).catch(() => ({ ok: false as const }));

  if (!res.ok) return null;
  const obj = safeJson(res.raw);
  if (!obj) return null;
  const templateId = typeof obj.templateId === "string" ? obj.templateId : "avoider";
  const title = typeof obj.title === "string" ? obj.title : "";
  const labelsRaw = obj.labels as Record<string, unknown> | undefined;
  const labels: GameSpec["labels"] = {
    player: typeof labelsRaw?.player === "string" ? labelsRaw.player : "主角",
    hazard: typeof labelsRaw?.hazard === "string" ? labelsRaw.hazard : "障碍",
    collectible: typeof labelsRaw?.collectible === "string" ? labelsRaw.collectible : "收集物",
    subtitle: typeof labelsRaw?.subtitle === "string" ? labelsRaw.subtitle : undefined,
  };
  return { templateId, title, labels };
}

// ─── Gameplay Agent ─────────────────────────────────────────────────────────

const GAMEPLAY_SYSTEM = `你是「游戏机制数值设计师」。用户描述想玩的小游戏，你只负责数值层：
- 选择合适的 templateId
- 给出合理的 gameplay 数值（所有字段必须出现且在合理范围内）
- 设计 director 章节节奏（acts + events，至少 3 段）
- 设计 systems（skill + powerups 可选）
- 只输出一个 JSON，不要 markdown。
- 字段范围参考：playerSpeed 160–480，hazardSpeed 80–480，spawnIntervalMs 280–2200，winScore 6–80。`;

const GAMEPLAY_SCHEMA = {
  name: "gameplay_spec",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      templateId: { type: "string", enum: [...GAME_TEMPLATE_IDS] },
      gameplay: {
        type: "object",
        additionalProperties: false,
        properties: {
          playerSpeed: { type: "number" },
          hazardSpeed: { type: "number" },
          spawnIntervalMs: { type: "number" },
          winScore: { type: "number" },
          lives: { type: "number" },
          arenaPadding: { type: "number" },
          jumpStrength: { type: "number" },
          gravity: { type: "number" },
          startingCoins: { type: "number" },
          baseHealth: { type: "number" },
        },
        required: ["playerSpeed", "hazardSpeed", "spawnIntervalMs", "winScore", "lives", "arenaPadding", "jumpStrength", "gravity", "startingCoins", "baseHealth"],
      },
    },
    required: ["templateId", "gameplay"],
  },
} as const;

async function callGameplayAgent(prompt: string): Promise<{ templateId: string; gameplay: GameSpec["gameplay"] } | null> {
  const model = pickModel();
  const res = await llmJson({
    model,
    system: GAMEPLAY_SYSTEM,
    user: prompt,
    temperature: 0.4,
    mode: "json_schema",
    jsonSchema: GAMEPLAY_SCHEMA,
    timeoutMs: 14000,
  }).catch(() => ({ ok: false as const }));

  if (!res.ok) return null;
  const obj = safeJson(res.raw);
  if (!obj) return null;
  const gp = obj.gameplay as Record<string, unknown> | undefined;
  if (!gp) return null;

  const n = (k: string, def: number) => (typeof gp[k] === "number" ? (gp[k] as number) : def);
  const gameplay: GameSpec["gameplay"] = {
    playerSpeed: n("playerSpeed", 280),
    hazardSpeed: n("hazardSpeed", 200),
    spawnIntervalMs: n("spawnIntervalMs", 700),
    winScore: n("winScore", 40),
    lives: n("lives", 3),
    arenaPadding: n("arenaPadding", 36),
    jumpStrength: n("jumpStrength", 420),
    gravity: n("gravity", 980),
    startingCoins: n("startingCoins", 120),
    baseHealth: n("baseHealth", 48),
  };
  const templateId = typeof obj.templateId === "string" ? obj.templateId : "avoider";
  return { templateId, gameplay };
}

// ─── Art Agent ──────────────────────────────────────────────────────────────

const ART_SYSTEM = `你是「游戏视觉与氛围设计师」。用户描述想玩的小游戏，你只负责视觉层：
- 给出 5 个十六进制颜色（#RRGGBB 格式，必须带 #）：backgroundColor, playerColor, hazardColor, collectibleColor, particleTint
- 色彩必须和主题气质一致，避免随机彩虹；除非用户明确说霓虹/赛博，否则不要高饱和冷暖霓虹组合
- 选择合适的 musicProfile（organic/pulse/minimal/neon）与主题饱和度一致；若不确定则不输出该字段
- 只输出一个 JSON，不要 markdown。`;

const ART_SCHEMA = {
  name: "art_spec",
  strict: false, // allow musicProfile to be absent
  schema: {
    type: "object",
    properties: {
      theme: {
        type: "object",
        properties: {
          backgroundColor: { type: "string" },
          playerColor: { type: "string" },
          hazardColor: { type: "string" },
          collectibleColor: { type: "string" },
          particleTint: { type: "string" },
        },
        required: ["backgroundColor", "playerColor", "hazardColor"],
      },
      musicProfile: { type: "string", enum: ["organic", "pulse", "minimal", "neon"] },
    },
    required: ["theme"],
  },
} as const;

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function safeColor(v: unknown, fallback: string): string {
  return typeof v === "string" && COLOR_RE.test(v) ? v : fallback;
}

async function callArtAgent(prompt: string): Promise<{ theme: GameSpec["theme"]; musicProfile?: string } | null> {
  const model = pickModel();
  const res = await llmJson({
    model,
    system: ART_SYSTEM,
    user: prompt,
    temperature: 0.55,
    mode: "json_object",
    jsonSchema: ART_SCHEMA,
    timeoutMs: 12000,
  }).catch(() => ({ ok: false as const }));

  if (!res.ok) return null;
  const obj = safeJson(res.raw);
  if (!obj) return null;
  const themeRaw = obj.theme as Record<string, unknown> | undefined;
  if (!themeRaw) return null;

  const theme: GameSpec["theme"] = {
    backgroundColor: safeColor(themeRaw.backgroundColor, "#141816"),
    playerColor: safeColor(themeRaw.playerColor, "#89a884"),
    hazardColor: safeColor(themeRaw.hazardColor, "#9d5838"),
    collectibleColor: safeColor(themeRaw.collectibleColor, "#c9a66b"),
    particleTint: safeColor(themeRaw.particleTint, "#69746c"),
  };
  const mp = typeof obj.musicProfile === "string" ? obj.musicProfile : undefined;
  return { theme, musicProfile: mp };
}

// ─── Director merge ─────────────────────────────────────────────────────────

/**
 * 合并三个 Agent 的输出为完整 GameSpec。
 * templateId 以 World Agent 为准（更懂叙事意图），Gameplay Agent 只作参考。
 */
function mergeAgentOutputs(
  world: Awaited<ReturnType<typeof callWorldAgent>>,
  gameplay: Awaited<ReturnType<typeof callGameplayAgent>>,
  art: Awaited<ReturnType<typeof callArtAgent>>,
): Partial<GameSpec> {
  const templateId = (world?.templateId ?? gameplay?.templateId ?? "avoider") as GameSpec["templateId"];
  const validTemplates: GameSpec["templateId"][] = [...GAME_TEMPLATE_IDS];
  const safeTemplateId: GameSpec["templateId"] = validTemplates.includes(templateId as GameSpec["templateId"])
    ? (templateId as GameSpec["templateId"])
    : "avoider";

  const mp = art?.musicProfile as "organic" | "pulse" | "minimal" | "neon" | undefined;

  return {
    version: 1,
    templateId: safeTemplateId,
    title: world?.title ?? "一句话小游戏",
    labels: world?.labels ?? { player: "主角", hazard: "障碍", collectible: "收集物" },
    theme: art?.theme ?? {
      backgroundColor: "#141816",
      playerColor: "#89a884",
      hazardColor: "#9d5838",
      collectibleColor: "#c9a66b",
      particleTint: "#69746c",
    },
    gameplay: gameplay?.gameplay ?? {
      playerSpeed: 280,
      hazardSpeed: 200,
      spawnIntervalMs: 700,
      winScore: 40,
      lives: 3,
      arenaPadding: 36,
      jumpStrength: 420,
      gravity: 980,
      startingCoins: 120,
      baseHealth: 48,
    },
    ...(mp ? { presentation: { musicProfile: mp } } : {}),
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export type MultiAgentResult = {
  partial: Partial<GameSpec>;
  worldOk: boolean;
  gameplayOk: boolean;
  artOk: boolean;
};

/**
 * 三 Agent 并行生成，返回合并后的 partial spec 及各 Agent 成功状态。
 * 调用方负责 lint/repair/finalize。
 */
export async function generateWithMultiAgent(
  prompt: string,
  orch?: RunTraceRecorder,
): Promise<MultiAgentResult> {
  const run = <T>(label: string, fn: () => Promise<T | null>): Promise<T | null> =>
    orch ? orch.span(label, fn) : fn();

  const [worldResult, gameplayResult, artResult] = await Promise.all([
    run("agent_world", () => callWorldAgent(prompt)),
    run("agent_gameplay", () => callGameplayAgent(prompt)),
    run("agent_art", () => callArtAgent(prompt)),
  ]);

  const partial = mergeAgentOutputs(worldResult, gameplayResult, artResult);

  return {
    partial,
    worldOk: worldResult !== null,
    gameplayOk: gameplayResult !== null,
    artOk: artResult !== null,
  };
}

/**
 * 尝试将 partial spec 解析为合法 GameSpec。
 * 用于在 repair 前做第一次 coerce 尝试。
 */
export function coerceMultiAgentPartial(partial: Partial<GameSpec>): ReturnType<typeof coerceGameSpec> {
  return coerceGameSpec(partial as unknown);
}
