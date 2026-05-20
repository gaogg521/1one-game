import type { GameSpec } from "@/lib/game-spec";
import { buildContextPack, resolveQualityTierFromEnv } from "@/lib/orchestration/context-pack";
import type { OrchestrationRunTrace, RunTraceRecorder } from "@/lib/orchestration/run-trace";
import { lintGameSpecForOrchestration } from "@/lib/orchestration/lint-spec";
import { getComfyBaseUrl, probeComfyHealthDetailed } from "@/lib/orchestration/comfy-gateway";
import { llmJson, getActiveProvider, getProviderModelCascade } from "@/lib/llm";
import { coerceGameSpec, overlaySpec } from "@/lib/normalize-spec";
import { mockSpecFromPrompt } from "@/lib/mock-spec";
import { buildTowerDefenseBlueprint } from "@/lib/td-blueprint";
import { buildDirector } from "@/lib/director";
import { buildSystems } from "@/lib/systems";
import { withPresentationDefaults } from "@/lib/cohesive-presentation";
import { fetchUrlPlainText } from "@/lib/fetch-url-text";
import { tavilySearch } from "@/lib/web-search/tavily";
import { generateWithMultiAgent, coerceMultiAgentPartial } from "@/lib/multi-agent-spec";
import {
  applyMinecraftThemeOverlay,
  detectMinecraftIntent,
  minecraftFranchiseAugment,
} from "@/lib/minecraft-franchise";
import { PRODUCT } from "@/lib/product-config";
import { godotPrefetchTraceDetail, scheduleGodotPrefetch } from "@/lib/godot-prefetch-scheduler";
import { isGodotExportSupported } from "@/lib/godot-spec-bridge-codegen";
import {
  alignSpecThemeFromBrief,
  expandCreativeBrief,
  lintBriefThemeAlignment,
  type ExpandCreativeBriefResult,
} from "@/lib/creative-brief";
import type { CreativeBrief } from "@/lib/creative-brief/types";

const SYSTEM = `你是「一句话小游戏」规格生成器。用户用中文或英文描述想要的极简 2D 网页小游戏（单次会话内可玩）。

你必须只输出一个 JSON 对象（不要 markdown，不要代码块），字段必须可被严格校验：
- **默认审美（重要）**：现代扁平、适度对比与可读优先；palette 取自创意物象色（自然、手工艺、纸本水墨、陶艺、森林、田园等均可以）。除非用户正文或参考摘录**明文**出现霓虹/赛博/夜店/UI 故障/数据线等关键词，否则禁止使用「高饱和大面积青洋红加暗底」这一套典型霓虹 UI 模版；不要随意把 subtitle/title/theme 编成赛博攻防叙事。
- 若创意或【参考素材】中含「参考图编号说明」或「【参考图 图N（用户用途：…）」段落：须按图序与「用户用途」把视觉要点落到 theme（如 hazardColor 贴近怪物参考主色、playerColor 贴近主角/炮塔、backgroundColor 贴近背景参考）、labels（hazard/player/collectible 的称呼贴合各图角色）以及 title/subtitle 氛围；勿混淆图号。
- version 固定为 1
- templateId 只能是 avoider | collector | survivor | platformer | towerDefense | shooter
  · avoider：画面底部横向移动，躲避从上方落下的障碍物（得分来自成功躲避，障碍落出屏幕底部计分直至胜利目标）
  · collector：平面四向移动，收集收集物并躲避危险物
  · survivor：类似 avoider，但有生命值，节奏偏紧张
  · platformer：横版平台跳跃闯关，较长关卡、多层平台、收集物与陷阱尖刺；必须有合理的 jumpStrength（约 320–620）与 gravity（约 720–1180），winScore 表示需收集的收集物数量（建议 22–56），lives 建议 3–5
  · towerDefense：塔防（路径行军 + 塔位建造升级 + 波次）；winScore 表示总波次数（建议 6–12）；baseHealth 表示基地生命（约 24–80）；startingCoins 开局金币（约 80–220）；hazardSpeed 影响敌军沿路径移动快慢；spawnIntervalMs 同波内出兵间隔；playerSpeed 映射炮塔射速；labels.collectible 填金币/能量等货币称呼。**同会话内**创作台可把参考 JPEG/PNG **直接贴入试玩**（背景/敌军/护卫形象按用途），故 theme、hazard/player 色相应与参考图文字描述同色相近，subtitle/title 不得无故写成霓虹赛博防线，除非用户或参考明确要求
  · shooter：俯视角射击，玩家飞船在底部左右移动并自动射击，敌人从上方波次降落并反击；jumpStrength 表示玩家子弹速度（建议 480–680）；hazardSpeed 表示敌人移速（建议 90–200）；spawnIntervalMs 表示敌人射击间隔（建议 800–2000）；winScore 表示需击杀敌人总数（建议 30–80）；lives 建议 3–5；labels.hazard 为敌舰名称，labels.player 为己方飞船名称
- **玩法结构优先（重要）**：不要只做“主题换皮”。优先给出 **2～3 分钟内有明显阶段变化** 的结构：
  · **director.acts**：若模型输出该字段，建议使用 **四幕** label 语义：**开场 / 加速 / 变奏 / 终局**（时间轴仍用 at，取值 0..1）；省略时由服务端 buildDirector 补齐。
  · **director.events**：事件 type 请使用运行时已识别的 **coinRain / goalShift / miniBoss**（必要时配 title / message / durationMs）；省略时由服务端按模板保底生成。
  · **《我的世界》/ Minecraft / mc.163.com（重要）**：若用户或【参考素材】要求网易《我的世界》场景，必须体现**方块草地、泥土、天空、像素角色**气质；含「奔跑/跑酷/冲刺/闯关」时 **优先 platformer**，勿默认做成抽象纯色 avoider；theme 用天空蓝 #6EB5FF、草地绿 #5D9B47、泥土褐 #8B6914；labels 用史蒂夫/苦力怕/方块等称呼，title/subtitle 须点明方块世界而非泛化「别墅冲刺」
  · avoider / survivor / collector：阶段结构由上述 events 支撑
  · platformer：应更像“关卡推进”，让收集目标、地形段落、精英威胁成立，而不是单屏随机跳跃
  · shooter：应有敌群波次、压迫升级、短时间火力窗口，而非单调刷怪
  · towerDefense：应有敌军差异、rush / elite 感、经济与守点压力
- **整体一致性（重要）**：theme 六色是全作 HUD、网页试玩外壳、怪物/粒子与程序化铺底音乐的共同母色，须色相协调、避免随机彩虹。若玩法气质极其明确可附加 presentation.musicProfile：organic（舒缓自然铺底）| pulse（轻微律动倾向）| minimal（几乎静默）| neon（偏亮电子），须与 theme 饱和度及背景亮度一致；不确定则不要输出该字段（由系统从 theme 推断）。
- title：≤80 字，抓住幻想点，不要抄用户全文
- theme：六个十六进制颜色字符串，格式必须是 #RRGGBB（含 #）
  · backgroundColor / playerColor / hazardColor 必填
  · collectibleColor / particleTint：结构化输出会要求键齐全；不适用时可填与背景协调的占位色（如深灰 #334155）
- gameplay：数值必须在合理范围（玩家速度约 180–480；危险速度约 80–480；生成间隔毫秒约 280–2200）
  · winScore：达成胜利所需分数或收集数；platformer 表示关卡内需收集的物体数量，建议 22–56
  · lives：survivor/collector/platformer 可填 2–6；avoider 通常填 1
  · arenaPadding：建议 24–56
  · jumpStrength / gravity：platformer 用合理跳跃手感；其它模板可填中性占位（如 jumpStrength≈420、gravity≈980）
  · startingCoins / baseHealth：towerDefense 用真实策略数值；其它模板可填区间中值占位（如 120 / 48）
  · 注意：网关 strict JSON 要求 gameplay 中列出的每个键都必须出现并给数值，不能用「省略字段」表示可选
- labels：中文优先；player 为操控角色称呼（towerDefense 为防御塔/炮塔）；hazard 为威胁称呼（towerDefense 为敌军）；collector/platformer/towerDefense 时 collectible 为收集物或货币称呼；subtitle 一句氛围话≤120字；不适用 collectible 时可填「—」或「无」
- **可选 director**：若当前服务端网关开启了结构化输出的扩展字段，你可在输出中加入完整的 director（含 intensity、acts；events 可选）。字段语义同上「玩法结构优先」。若不确定网关是否支持，仅输出主体字段即可，由服务端补齐。

示例（语气与饱和度参考——中性自然风，勿照抄内容）：
{"version":1,"templateId":"collector","title":"松径寻宝人","theme":{"backgroundColor":"#1a2220","playerColor":"#8faf8c","hazardColor":"#a65f3f","collectibleColor":"#c9a66b","particleTint":"#6b7468"},"gameplay":{"playerSpeed":305,"hazardSpeed":205,"spawnIntervalMs":740,"winScore":26,"lives":4,"arenaPadding":38,"jumpStrength":430,"gravity":980,"startingCoins":120,"baseHealth":48},"labels":{"player":"旅行者","hazard":"刺藤鼠","collectible":"松鳞果","subtitle":"暮色小径上的收集之旅"}}

若描述含糊：默认 avoider；若强调塔防/保卫萝卜/波次/箭塔/防线→towerDefense；若强调横版跳跃/平台闯关/多层地形→platformer；若强调收集/金币/宝石→collector；强调生存/扣血/多条命→survivor；若强调射击/飞船/太空/弹幕/消灭敌机/波次敌人→shooter。`;

/** LLM json_schema（strict）：可选纳入 director，默认关闭以免部分网关对扩展 schema 不兼容。见 `PRODUCT.game.jsonSchemaIncludeDirector`。 */
const GAME_SPEC_DIRECTOR_SCHEMA_FRAGMENT = {
  type: "object",
  additionalProperties: false,
  properties: {
    intensity: { type: "number", minimum: 0, maximum: 1 },
    acts: {
      type: "array",
      minItems: 1,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          at: { type: "number", minimum: 0, maximum: 1 },
          label: { type: "string", minLength: 1, maxLength: 24 },
          modifiers: {
            type: "array",
            items: { type: "string", minLength: 1, maxLength: 24 },
            maxItems: 6,
          },
        },
        required: ["at", "label", "modifiers"],
      },
    },
    events: {
      type: "array",
      maxItems: 16,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          at: { type: "number", minimum: 0, maximum: 1 },
          type: { type: "string", minLength: 1, maxLength: 24 },
          strength: { type: "number", minimum: 0, maximum: 1 },
          durationMs: { type: "number", minimum: 0, maximum: 30000 },
          title: { type: "string", minLength: 1, maxLength: 32 },
          message: { type: "string", minLength: 1, maxLength: 80 },
        },
        required: ["at", "type"],
      },
    },
  },
  required: ["intensity", "acts"],
} as const;

function getActiveGameSpecJsonSchema() {
  const includeDirector = PRODUCT.game.jsonSchemaIncludeDirector;
  const coreProperties = {
    version: { type: "integer", enum: [1] },
    templateId: {
      type: "string",
      enum: ["avoider", "collector", "survivor", "platformer", "towerDefense", "shooter"],
    },
    title: { type: "string" },
    theme: {
      type: "object",
      additionalProperties: false,
      properties: {
        backgroundColor: { type: "string" },
        playerColor: { type: "string" },
        hazardColor: { type: "string" },
        collectibleColor: { type: "string" },
        particleTint: { type: "string" },
      },
      required: ["backgroundColor", "collectibleColor", "hazardColor", "particleTint", "playerColor"],
    },
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
      required: [
        "arenaPadding",
        "baseHealth",
        "gravity",
        "hazardSpeed",
        "jumpStrength",
        "lives",
        "playerSpeed",
        "spawnIntervalMs",
        "startingCoins",
        "winScore",
      ],
    },
    labels: {
      type: "object",
      additionalProperties: false,
      properties: {
        player: { type: "string" },
        hazard: { type: "string" },
        collectible: { type: "string" },
        subtitle: { type: "string" },
      },
      required: ["collectible", "hazard", "player", "subtitle"],
    },
  } as const;

  const requiredCore = [
    "version",
    "templateId",
    "title",
    "theme",
    "gameplay",
    "labels",
  ] as const;

  if (!includeDirector) {
    return {
      name: "game_spec",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: coreProperties,
        required: [...requiredCore],
      },
    };
  }

  return {
    name: "game_spec",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        ...coreProperties,
        director: GAME_SPEC_DIRECTOR_SCHEMA_FRAGMENT,
      },
      required: [...requiredCore],
    },
  };
}

export type GenerationSource = "llm" | "llm_overlay" | "llm_repair" | "mock";

export type GenerationDebug = {
  model?: string;
  draftModel?: string;
  enhanceModel?: string;
  provider?: ReturnType<typeof getActiveProvider>;
  fallback: boolean;
  /** fallback=true 时给用户可读原因；fallback=false 时可为空。 */
  fallbackReason?: string;
  /** LiteLLM/OpenAI 调用报错（脱敏且截断）。 */
  llmError?: string;
  /** 实际请求格式（部分网关不支持 json_schema）。 */
  llmMode?: "json_schema" | "json_object";
  searchEnhance: boolean;
  enhancedRequested: boolean;
  enhancedApplied: boolean;
  templateHint?: GenerateOptions["templateHint"];
  enhanceWarning?: string;
  /** 一句话深度扩写稿（Creative Brief） */
  creativeBrief?: CreativeBrief;
  briefSummary?: string;
  /** Phase 0 编排：各 DAG 节点耗时快照（SSE / 可调式接口附带）。 */
  orchestrationTrace?: OrchestrationRunTrace;
};

/** LLM 的 strict JSON 通常不含 director/systems；缺口在此用 `buildDirector` / `buildSystems`（及塔防蓝图）补齐 —— 与 `finalizePatchedSpec`（patch/refine）语义一致。 */
function finalizeSpec(prompt: string, spec: GameSpec): GameSpec {
  let next = spec;
  if (spec.templateId === "towerDefense" && !spec.towerDefense) {
    next = { ...next, towerDefense: buildTowerDefenseBlueprint({ prompt, spec: next }) };
  }
  if (!next.director) {
    next = { ...next, director: buildDirector({ prompt, spec: next }) };
  }
  if (!next.systems) {
    next = { ...next, systems: buildSystems({ prompt, spec: next }) };
  }
  return withPresentationDefaults(applyMinecraftThemeOverlay(next));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  const ms = Math.max(1_000, Math.min(90_000, Math.floor(timeoutMs)));
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const timer = setTimeout(() => {
        clearTimeout(timer);
        reject(new Error(`${label} timeout after ${ms}ms`));
      }, ms);
    }),
  ]);
}

function safeErrorSummary(e: unknown): string {
  if (!e) return "unknown error";
  if (typeof e === "string") return e.slice(0, 400);
  if (e instanceof Error) {
    const msg = (e.message || e.name || "Error").replace(/sk-[A-Za-z0-9_-]+/g, "sk-***");
    return msg.slice(0, 600);
  }
  try {
    return JSON.stringify(e).slice(0, 600);
  } catch {
    return "unknown error";
  }
}

async function callPrimaryLLM(
  model: string,
  userPrompt: string,
): Promise<unknown | null> {
  const timeoutMs = Math.max(4_000, Math.min(45_000, PRODUCT.game.genTimeoutMs));
  const res = await llmJson({
    model,
    system: SYSTEM,
    user: userPrompt,
    temperature: 0.55,
    mode: "json_schema",
    jsonSchema: getActiveGameSpecJsonSchema(),
    timeoutMs,
  });
  return res.ok ? res.raw : null;
}

async function callRepairLLM(
  model: string,
  userPrompt: string,
  broken: unknown,
  issues: string[],
): Promise<unknown | null> {
  const timeoutMs = Math.max(4_000, Math.min(45_000, PRODUCT.game.repairTimeoutMs));
  const res = await llmJson({
    model,
    system:
      "你是 JSON 修复器。用户要一个小游戏规格。你只输出一个完整 JSON 对象，符合既定 schema，颜色必须是 #RRGGBB，不要 markdown。",
    user: `原始创意：\n${userPrompt}\n\n校验问题：\n${issues.slice(0, 12).join("\n")}\n\n残缺输出（请修正为合法规格）：\n${JSON.stringify(broken).slice(0, 6000)}`,
    temperature: 0.15,
    mode: "json_schema",
    jsonSchema: getActiveGameSpecJsonSchema(),
    timeoutMs,
  });
  return res.ok ? res.raw : null;
}

/** Phase 1：编排层显式 repair（finalize 闭环 / 脚本可复用）。 */
export async function repairGameSpecFromIssues(
  userPrompt: string,
  broken: unknown,
  issues: string[],
): Promise<GameSpec | null> {
  const clean = userPrompt.trim();
  const models = getProviderModelCascade();
  for (const model of models) {
    try {
      const repairedRaw = await callRepairLLM(model, userPrompt, broken, issues);
      if (!repairedRaw) continue;
      const repaired = coerceGameSpec(repairedRaw);
      if (repaired.ok) {
        return finalizeSpec(clean, repaired.spec);
      }
    } catch {
      /* 下一模型 */
    }
  }
  return null;
}

async function runFinalizeLintRepair(
  userPrompt: string,
  initial: GameSpec,
  orch?: RunTraceRecorder,
  brief?: CreativeBrief | null,
): Promise<GameSpec> {
  const maxRounds = Math.min(4, Math.max(0, Math.floor(PRODUCT.game.maxRepairRounds)));

  const doLint = (s: GameSpec) =>
    orch
      ? orch.span("lint_spec", async () => lintGameSpecForOrchestration(s))
      : Promise.resolve(lintGameSpecForOrchestration(s));

  let current = brief ? alignSpecThemeFromBrief(initial, brief) : initial;

  if (brief) {
    const briefIssues = lintBriefThemeAlignment(brief, current);
    if (briefIssues.length) {
      orch?.note("brief_theme_align", { issues: briefIssues.slice(0, 6) });
      current = alignSpecThemeFromBrief(current, brief);
    }
  }

  let lint = await doLint(current);
  if (lint.ok) return current;
  let lastIssues = [...lint.issues];
  if (brief) {
    lastIssues = [...lintBriefThemeAlignment(brief, current), ...lastIssues];
  }

  for (let round = 0; round < maxRounds; round += 1) {
    const broken: unknown = JSON.parse(JSON.stringify(current)) as unknown;
    const roundLabel = round + 1;
    const next = orch
      ? await orch.span(`spec_repair_${roundLabel}`, () =>
          repairGameSpecFromIssues(userPrompt, broken, lastIssues),
        )
      : await repairGameSpecFromIssues(userPrompt, broken, lastIssues);
    if (!next) {
      orch?.note("spec_repair_aborted", { round: roundLabel, reason: "no_model_or_parse" });
      break;
    }
    current = next;
    lint = await doLint(current);
    if (lint.ok) return current;
    lastIssues = lint.issues;
  }

  if (!lint.ok) {
    orch?.note("lint_spec_remaining", {
      count: lint.issues.length,
      sample: lint.issues.slice(0, 8),
    });
  }
  return current;
}

async function callEnhanceLLM(
  model: string,
  userPrompt: string,
  draft: GameSpec,
): Promise<unknown | null> {
  const timeoutMs = Math.max(4_000, Math.min(45_000, PRODUCT.game.enhanceTimeoutMs));
  const res = await llmJson({
    model,
    system:
      "你是「游戏规格强化器」。输入：用户创意 + 一份初稿 GameSpec。输出：一份更成品、更有系统深度的 GameSpec（严格符合 schema）。\n" +
      "硬约束：\n" +
      "- 只输出一个 JSON 对象，不要 markdown。\n" +
      "- 不要复刻任何专有名词/角色名/剧情名；可学习机制与信息层级。\n" +
      "- 必须保留 templateId 不变（不允许改模板）。\n" +
      "- 强化方向：更清晰的目标与节奏、更强的事件与系统感；director/systems 会由后处理补齐，你只需给出更合理的 title/theme/gameplay/labels。\n" +
      "- 若上文含【参考图】段落或田园/中国风/小清新/写实自然等语义：theme 必须与参考摘录主色靠拢，不要盲目改成霓虹赛博；塔防会与参考像素贴片同屏。\n",
    user: `用户创意：\n${userPrompt}\n\n初稿规格（请在其基础上强化，不要改变 templateId）：\n${JSON.stringify(draft).slice(0, 9000)}\n\n强化清单：\n- 把 winScore/lives/spawnIntervalMs/hazardSpeed 等调到更像“成品关卡”的范围\n- platformer：更长关卡与收集目标（winScore 建议 28–56）、lives 建议 3–5、jumpStrength/gravity 合理\n- towerDefense：startingCoins/baseHealth/winScore（波次）合理，labels.collectible 表达货币\n- theme：**服从用户创意与参考图摘录的主色与氛围**，仅在明确要求「霓虹/赛博/都市夜景」时才强化冷暖霓虹对比\n- subtitle/title：与模板与参考语义一致\n\n请输出强化后的完整 JSON：`,
    temperature: 0.25,
    mode: "json_schema",
    jsonSchema: getActiveGameSpecJsonSchema(),
    timeoutMs,
  });
  return res.ok ? res.raw : null;
}

async function tryGenerateWithModelChain(
  models: string[],
  userContent: string,
  clean: string,
  mock: GameSpec,
): Promise<{ spec: GameSpec; source: GenerationSource; model: string } | null> {
  for (const model of models) {
    let raw: unknown | null = null;
    try {
      raw = await callPrimaryLLM(model, userContent);
    } catch {
      continue;
    }
    if (!raw) continue;

    const direct = coerceGameSpec(raw);
    if (direct.ok) {
      return { spec: finalizeSpec(clean, direct.spec), source: "llm", model };
    }

    const overlaid = overlaySpec(mock, raw);
    if (!specsEqual(overlaid, mock)) {
      return { spec: finalizeSpec(clean, overlaid), source: "llm_overlay", model };
    }

    try {
      const repairedRaw = await callRepairLLM(model, userContent, raw, direct.issues);
      if (repairedRaw) {
        const repaired = coerceGameSpec(repairedRaw);
        if (repaired.ok) {
          return { spec: finalizeSpec(clean, repaired.spec), source: "llm_repair", model };
        }
      }
    } catch {
      /* 换下一个模型 */
    }
  }
  return null;
}

function specsEqual(a: GameSpec, b: GameSpec): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export type GenerateOptions = {
  /** 附在用户消息末尾，用于多套方案差异化（不影响离线 mock 的标题推断基准）。 */
  flavorSuffix?: string;
  /** 是否启用联网检索增强（需要 TAVILY_API_KEY）。默认 false。 */
  searchEnhance?: boolean;
  /** 强制/提示玩法模板。auto 表示按 prompt 自动推断。 */
  templateHint?: "auto" | GameSpec["templateId"];
  /** 是否执行“二次强化（更成品）”pass。默认 true。 */
  enhancePass?: boolean;
  /** Phase 0：记入 web_search / spec_draft / spec_enhance 等步骤耗时。 */
  orchestration?: RunTraceRecorder;
  /** 创作台 session 资产摘要（记入 trace）；不含像素数据 */
  assetManifestSummary?: { schemaVersion: number; revision: number; itemCount: number };
  /** 流式接口已先扩写时传入，避免重复调用 */
  creativeBriefPreExpanded?: ExpandCreativeBriefResult;
};

const VARIANT_FLAVORS = [
  "【方案偏好】节奏偏快，配色对比强，胜利目标可略高；如合适可做 platformer。",
  "【方案偏好】节奏舒缓，配色柔和，突出收集成就感；可偏大关卡平台跳跃。",
  "【方案偏好】紧张压迫感，偏深色氛围与偏高威胁数值；陷阱与收集物错落。",
] as const;

/** 并行生成多套规格（每条带不同风味后缀，便于一眼区分）。 */
export async function generateGameSpecVariantBatch(
  prompt: string,
  count: 2 | 3,
  options?: Pick<GenerateOptions, "searchEnhance" | "templateHint" | "enhancePass">,
): Promise<Array<{ spec: GameSpec; source: GenerationSource; label: string; web?: WebEnhanceMeta | null }>> {
  const labels = ["方案 A", "方案 B", "方案 C"];
  const n = count === 2 ? 2 : 3;
  const items = await Promise.all(
    Array.from({ length: n }, (_, i) =>
      generateGameSpecWithMeta(prompt, {
        flavorSuffix: VARIANT_FLAVORS[i],
        searchEnhance: options?.searchEnhance,
        templateHint: options?.templateHint,
        enhancePass: options?.enhancePass,
      }),
    ),
  );
  return items.map((item, i) => ({
    ...item,
    label: labels[i] ?? `方案 ${i + 1}`,
  }));
}

export type WebEnhanceMeta = {
  enabled: boolean;
  used: boolean;
  query?: string;
  sources?: Array<{ title: string; url: string; score?: number }>;
  warning?: string;
};

function normalizeTemplateHint(hint: GenerateOptions["templateHint"]): "auto" | GameSpec["templateId"] {
  if (!hint) return "auto";
  if (hint === "auto") return "auto";
  if (
    hint === "avoider" ||
    hint === "collector" ||
    hint === "survivor" ||
    hint === "platformer" ||
    hint === "towerDefense" ||
    hint === "shooter"
  ) {
    return hint;
  }
  return "auto";
}

function applyTemplateHint(spec: GameSpec, hint: "auto" | GameSpec["templateId"]): GameSpec {
  if (hint === "auto") return spec;
  if (spec.templateId === hint) return spec;

  const next: GameSpec = { ...spec, templateId: hint };
  if (hint === "platformer") {
    next.gameplay = {
      ...next.gameplay,
      jumpStrength: next.gameplay.jumpStrength ?? 420,
      gravity: next.gameplay.gravity ?? 950,
      lives: next.gameplay.lives ?? 4,
      winScore: next.gameplay.winScore ?? 32,
    };
  }
  if (hint === "towerDefense") {
    next.gameplay = {
      ...next.gameplay,
      startingCoins: next.gameplay.startingCoins ?? 140,
      baseHealth: next.gameplay.baseHealth ?? 50,
      winScore: next.gameplay.winScore ?? 9,
    };
  }
  if (hint === "shooter") {
    next.gameplay = {
      ...next.gameplay,
      jumpStrength: next.gameplay.jumpStrength ?? 560,
      hazardSpeed: next.gameplay.hazardSpeed ?? 130,
      lives: next.gameplay.lives ?? 3,
      winScore: next.gameplay.winScore ?? 45,
    };
  }
  return next;
}

function enhancePromptForProduction(userPrompt: string): string {
  const extra = [
    "【二次强化目标】把规格推向更“成品/3A感”：",
    "- 必须有：清晰目标 + 目标变化（goal shift）+ 小Boss/精英（miniBoss）+ 随机事件（coinRain 等）+ 技能（按键/冷却）+ 道具/增益（掉落/拾取）",
    "- 关卡节奏：至少 3 段（前期教学/中期加速/后期压轴），并在 director 里体现。",
    "- 数值更合理：胜利目标不要太低；platformer/towerDefense 尽量给足策略与关卡空间。",
    "- collector 专属：director.events 里加入 goldenPickup（黄金收集物窗口，高价值限时物件）和 goalShift（限时收集目标）；gameplay.winScore 建议 30-50。",
    "- survivor 专属：director.events 里加入 breathingRoom（喘息窗口，低压补给段）和 miniBoss（精英波）；gameplay.lives 建议 3-5。",
    "- avoider 专属：director.events 里加入 finalBarrage（终局密集弹幕倒计时，撑过即胜）和 miniBoss；gameplay.lives 建议 1-2。",
    "- 风格：学习同类的 UI 信息层级与反馈，但不要复刻专有名词、角色名、剧情名。",
  ].join("\n");
  return `${userPrompt}\n\n${extra}`.slice(0, 4000);
}

async function tryEnhanceWithModelChain(
  models: string[],
  userPrompt: string,
  clean: string,
  draft: GameSpec,
  mock: GameSpec,
): Promise<{ spec: GameSpec; source: GenerationSource; model: string } | null> {
  for (const model of models) {
    let raw: unknown | null = null;
    try {
      raw = await callEnhanceLLM(model, userPrompt, draft);
    } catch {
      continue;
    }
    if (!raw) continue;

    const direct = coerceGameSpec(raw);
    if (direct.ok) {
      const fixed = direct.spec.templateId === draft.templateId ? direct.spec : { ...direct.spec, templateId: draft.templateId };
      return { spec: finalizeSpec(clean, fixed), source: "llm", model };
    }

    const overlaid = overlaySpec(mock, raw);
    if (!specsEqual(overlaid, mock)) {
      const fixed = overlaid.templateId === draft.templateId ? overlaid : { ...overlaid, templateId: draft.templateId };
      return { spec: finalizeSpec(clean, fixed), source: "llm_overlay", model };
    }

    try {
      const repairedRaw = await callRepairLLM(model, userPrompt, raw, direct.issues);
      if (repairedRaw) {
        const repaired = coerceGameSpec(repairedRaw);
        if (repaired.ok) {
          const fixed =
            repaired.spec.templateId === draft.templateId ? repaired.spec : { ...repaired.spec, templateId: draft.templateId };
          return { spec: finalizeSpec(clean, fixed), source: "llm_repair", model };
        }
      }
    } catch {
      /* 换下一个模型 */
    }
  }
  return null;
}

async function resolvePromptWithCreativeBrief(
  prompt: string,
  options?: Pick<GenerateOptions, "templateHint" | "orchestration" | "creativeBriefPreExpanded">,
): Promise<{
  clean: string;
  pipelinePrompt: string;
  briefResult: ExpandCreativeBriefResult | null;
}> {
  const clean0 = minecraftFranchiseAugment(prompt.trim());
  const clean = clean0;

  if (!PRODUCT.game.creativeBriefExpand) {
    return { clean, pipelinePrompt: clean, briefResult: null };
  }

  if (options?.creativeBriefPreExpanded) {
    return {
      clean,
      pipelinePrompt: options.creativeBriefPreExpanded.augmentedPrompt,
      briefResult: options.creativeBriefPreExpanded,
    };
  }

  const briefResult = await expandCreativeBrief({
    prompt: clean,
    templateHint: options?.templateHint,
    orchestration: options?.orchestration,
  });
  return { clean, pipelinePrompt: briefResult.augmentedPrompt, briefResult };
}

function attachBriefToDebug(
  debug: GenerationDebug,
  briefResult: ExpandCreativeBriefResult | null,
): GenerationDebug {
  if (!briefResult) return debug;
  return {
    ...debug,
    creativeBrief: briefResult.brief,
    briefSummary: briefResult.oneLineSummary,
  };
}

export async function generateGameSpecDraftWithMeta(
  prompt: string,
  options?: Omit<GenerateOptions, "enhancePass">,
): Promise<{ spec: GameSpec; source: GenerationSource; web?: WebEnhanceMeta | null; debug: GenerationDebug }> {
  const { clean, pipelinePrompt, briefResult } = await resolvePromptWithCreativeBrief(prompt, options);
  let web: WebEnhanceMeta | null = null;

  let augmented = pipelinePrompt;
  if (options?.searchEnhance) {
    const orch = options.orchestration;
    const bundle = orch
      ? await orch.span("web_search", () => tryWebEnhance(pipelinePrompt))
      : await tryWebEnhance(pipelinePrompt);
    augmented = bundle.prompt;
    web = bundle.meta;
  } else {
    options?.orchestration?.note("web_search_skipped", { reason: "disabled" });
  }

  const hint =
    briefResult?.brief.intent.templateHint && briefResult.brief.intent.templateHint !== "auto"
      ? normalizeTemplateHint(briefResult.brief.intent.templateHint)
      : normalizeTemplateHint(options?.templateHint);
  const mock = mockSpecFromPrompt(clean);
  const base = augmented;
  const userContent = options?.flavorSuffix ? `${base}\n\n${options.flavorSuffix}` : base;

  const provider = getActiveProvider();
  const models = getProviderModelCascade();
  if (!models.length) {
    options?.orchestration?.note("spec_draft_llm_skipped", { reason: "no_models" });
    const hinted = applyTemplateHint(mock, hint);
    return {
      spec: finalizeSpec(clean, hinted),
      source: "mock",
      web,
      debug: attachBriefToDebug(
        {
          fallback: true,
          fallbackReason: "未配置可用模型或 Provider",
          searchEnhance: Boolean(options?.searchEnhance),
          enhancedRequested: false,
          enhancedApplied: false,
          templateHint: hint,
        },
        briefResult,
      ),
    };
  }

  const totalTimeoutMs = Math.max(8_000, Math.min(120_000, PRODUCT.game.totalTimeoutMs));
  let llmError: string | undefined;
  let llmMode: "json_schema" | "json_object" | undefined;
  const runDraftChain = async () =>
    withTimeout(
      tryGenerateWithModelChain(models, userContent, clean, mock),
      totalTimeoutMs,
      "openai total",
    ).catch((e) => {
      llmError = safeErrorSummary(e);
      return null;
    });

  const fromLlm = options?.orchestration
    ? await options.orchestration.span("spec_draft", runDraftChain)
    : await runDraftChain();
  if (fromLlm) {
    const hinted = applyTemplateHint(fromLlm.spec, hint);
    return {
      spec: finalizeSpec(clean, hinted),
      source: fromLlm.source,
      web,
      debug: attachBriefToDebug(
        {
          model: fromLlm.model,
          fallback: false,
          llmMode,
          provider,
          searchEnhance: Boolean(options?.searchEnhance),
          enhancedRequested: false,
          enhancedApplied: false,
          templateHint: hint,
        },
        briefResult,
      ),
    };
  }

  const hinted = applyTemplateHint(mock, hint);
  return {
    spec: finalizeSpec(clean, hinted),
    source: "mock",
    web,
    debug: attachBriefToDebug(
      {
        fallback: true,
        fallbackReason: "模型调用失败或超时，已回退本地规则生成",
        llmError,
        provider,
        searchEnhance: Boolean(options?.searchEnhance),
        enhancedRequested: false,
        enhancedApplied: false,
        templateHint: hint,
      },
      briefResult,
    ),
  };
}

export async function enhanceGameSpecFromDraftWithMeta(params: {
  prompt: string;
  draft: GameSpec;
  draftSource: GenerationSource;
  draftDebug: GenerationDebug;
  web?: WebEnhanceMeta | null;
  options?: Pick<GenerateOptions, "templateHint" | "orchestration">;
}): Promise<{ spec: GameSpec; source: GenerationSource; web?: WebEnhanceMeta | null; debug: GenerationDebug }> {
  const clean0 = params.prompt.trim();
  const clean = clean0;
  const web = params.web ?? null;
  const hint = normalizeTemplateHint(params.options?.templateHint);

  const draft = applyTemplateHint(params.draft, hint);
  const mock = mockSpecFromPrompt(clean);

  const models = getProviderModelCascade();
  const totalTimeoutMs = Math.max(8_000, Math.min(120_000, PRODUCT.game.totalTimeoutMs));
  const orch = params.options?.orchestration;
  const runEnhance = async () =>
    await withTimeout(
      tryEnhanceWithModelChain(models, enhancePromptForProduction(params.prompt), clean, draft, mock),
      totalTimeoutMs,
      "openai enhance total",
    ).catch(() => null);

  const enhanced = orch ? await orch.span("spec_enhance", runEnhance) : await runEnhance();

  if (enhanced) {
    const hinted = applyTemplateHint(enhanced.spec, hint);
    return {
      spec: finalizeSpec(clean, hinted),
      source: enhanced.source,
      web,
      debug: {
        model: enhanced.model,
        draftModel: params.draftDebug.model,
        enhanceModel: enhanced.model,
        fallback: false,
        searchEnhance: false,
        enhancedRequested: true,
        enhancedApplied: true,
        templateHint: hint,
      },
    };
  }

  orch?.note("spec_enhance_fallback", { reason: "timeout_or_models" });

  const hinted = applyTemplateHint(draft, hint);
  return {
    spec: finalizeSpec(clean, hinted),
    source: params.draftSource,
    web,
    debug: {
      ...params.draftDebug,
      enhancedApplied: false,
      templateHint: hint,
      draftModel: params.draftDebug.model,
      enhanceWarning: "二次强化未完成（超时或模型不可用），已保留初稿结果",
    },
  };
}

function extractUrls(text: string): string[] {
  const m = text.match(/https?:\/\/[^\s)]+/g);
  if (!m) return [];
  // 简单去重
  const uniq = Array.from(new Set(m.map((s) => s.replace(/[),.，。]+$/g, ""))));
  return uniq.slice(0, 6);
}

function buildSearchQuery(cleanPrompt: string): string {
  if (detectMinecraftIntent(cleanPrompt)) {
    const core = cleanPrompt.replace(/\s+/g, " ").slice(0, 140);
    return `${core} 网易我的世界 Minecraft 方块 奔跑 沙盒 玩法`;
  }
  const core = cleanPrompt.replace(/\s+/g, " ").slice(0, 180);
  return `${core} 玩法 系统 技能 职业 怪物 经济 掉落 HUD`;
}

function synthesizeWebBlock(params: {
  prompt: string;
  searchQuery: string;
  answer?: string;
  pages: Array<{ title?: string; url: string; text: string; score?: number }>;
}): { block: string; sources: WebEnhanceMeta["sources"] } {
  const sources = params.pages.map((p) => ({
    title: (p.title ?? "").slice(0, 120),
    url: p.url,
    score: p.score,
  }));

  const bullets: string[] = [];
  if (params.answer?.trim()) {
    bullets.push(`- 综述要点：${params.answer.trim().slice(0, 520)}`);
  }
  for (const p of params.pages.slice(0, 6)) {
    const t = (p.text ?? "").replace(/\s+/g, " ").trim();
    if (!t) continue;
    bullets.push(`- 线索（${p.title ?? "来源"}）：${t.slice(0, 520)}`);
  }

  const block = [
    "【联网检索摘要】",
    `查询：${params.searchQuery}`,
    "目标：学习同类游戏的玩法机制/系统节奏/怪物与技能类型/经济循环/界面信息层级；不要复刻专有名词或剧情角色。",
    ...bullets.slice(0, 10),
    "【来源】",
    ...sources.map((s) => `- ${s.title ? `${s.title} ` : ""}${s.url}`),
  ].join("\n");

  return { block, sources };
}

async function tryWebEnhance(cleanPrompt: string): Promise<{ prompt: string; meta: WebEnhanceMeta }> {
  const enabled = true;
  const key = process.env.TAVILY_API_KEY?.trim();
  if (!key) {
    return { prompt: cleanPrompt, meta: { enabled, used: false, warning: "未配置 TAVILY_API_KEY" } };
  }

  try {
    const urlsInPrompt = extractUrls(cleanPrompt);
    const searchQuery = buildSearchQuery(cleanPrompt);

    const pages: Array<{ title?: string; url: string; text: string; score?: number }> = [];
    for (const url of urlsInPrompt.slice(0, 3)) {
      try {
        const { title, text } = await fetchUrlPlainText(url);
        pages.push({ title: title ?? url, url, text, score: 1 });
      } catch {
        /* 用户贴的参考链抓取失败时仍走 Tavily */
      }
    }

    // 先 Tavily 搜索拿到候选来源
    const res = await tavilySearch({ query: searchQuery, maxResults: 6, searchDepth: "basic", includeAnswer: true });
    const picked = res.results
      .filter((r) => r.url && !urlsInPrompt.includes(r.url))
      .slice(0, 5)
      .map((r) => ({ title: r.title, url: r.url, score: r.score }));

    // 再抓取正文（多源并行，缩短联网增强总耗时）
    const fetchJobs = picked.map(async (r) => {
      try {
        const { title, text } = await fetchUrlPlainText(r.url);
        return { ok: true as const, title: title ?? r.title, url: r.url, text, score: r.score };
      } catch {
        return { ok: false as const };
      }
    });
    const settled = await Promise.all(fetchJobs);
    for (const s of settled) {
      if (s.ok && !pages.some((p) => p.url === s.url)) {
        pages.push({ title: s.title, url: s.url, text: s.text, score: s.score });
      }
    }

    const { block, sources } = synthesizeWebBlock({
      prompt: cleanPrompt,
      searchQuery,
      answer: res.answer,
      pages,
    });

    const nextPrompt = `${cleanPrompt}\n\n---\n${block}`.slice(0, 4000);
    return {
      prompt: nextPrompt,
      meta: { enabled, used: true, query: searchQuery, sources },
    };
  } catch (e) {
    return {
      prompt: cleanPrompt,
      meta: { enabled, used: false, warning: e instanceof Error ? e.message : "联网检索失败" },
    };
  }
}

/** 返回规格与来源，便于前端区分「大模型 / 融合纠错 / 离线 mock」。 */
export async function generateGameSpecWithMeta(
  prompt: string,
  options?: GenerateOptions,
): Promise<{ spec: GameSpec; source: GenerationSource; web?: WebEnhanceMeta | null; debug: GenerationDebug }> {
  const orch = options?.orchestration;

  let briefPre = options?.creativeBriefPreExpanded;
  if (!briefPre && PRODUCT.game.creativeBriefExpand) {
    briefPre = await expandCreativeBrief({
      prompt: prompt.trim(),
      templateHint: options?.templateHint,
      orchestration: orch,
    });
  }
  const genOpts: GenerateOptions = { ...options, creativeBriefPreExpanded: briefPre };

  if (orch) {
    const pack = buildContextPack({
      prompt: prompt.trim(),
      templateHint: options?.templateHint ?? "auto",
      searchEnhance: Boolean(options?.searchEnhance),
      enhancePass: options?.enhancePass !== false,
    });
    orch.note("context_pack", {
      locale: pack.locale,
      templateHintEffective: pack.templateHintEffective,
      searchEnhance: pack.searchEnhance,
      enhancePass: pack.enhancePass,
      hasReferenceSnippet: pack.hasReferenceSnippet,
      promptChars: pack.userPromptTrimmed.length,
      qualityTier: pack.qualityTier,
    });
    const am = options?.assetManifestSummary;
    if (am) {
      orch.note("client_asset_manifest", {
        schemaVersion: am.schemaVersion,
        revision: am.revision,
        itemCount: am.itemCount,
      });
    }
  }

  const withTrace = (r: {
    spec: GameSpec;
    source: GenerationSource;
    web?: WebEnhanceMeta | null;
    debug: GenerationDebug;
  }) => {
    const debug = attachBriefToDebug(r.debug, briefPre ?? null);
    return orch ? { ...r, debug: { ...debug, orchestrationTrace: orch.snapshot() } } : { ...r, debug };
  };

  const finish = async (r: {
    spec: GameSpec;
    source: GenerationSource;
    web?: WebEnhanceMeta | null;
    debug: GenerationDebug;
  }) => {
    const spec = await runFinalizeLintRepair(prompt, r.spec, orch, briefPre?.brief ?? null);
    if (orch) {
      if (PRODUCT.godot.enabled && isGodotExportSupported(spec)) {
        scheduleGodotPrefetch(spec);
        orch.note("godot_web_prefetch", godotPrefetchTraceDetail(spec));
      } else {
        orch.note("godot_web_prefetch", { ...godotPrefetchTraceDetail(spec), scheduled: false });
      }
    }
    return withTrace({ ...r, spec });
  };

  const enhancedRequested = options?.enhancePass !== false;
  const isRich = resolveQualityTierFromEnv() === "rich";

  // Rich tier: three specialized agents run in parallel (World / Gameplay / Art).
  // Comfy probe fires at the same time to avoid adding latency.
  if (isRich) {
    const [maResult, comfy] = await Promise.all([
      generateWithMultiAgent(briefPre?.augmentedPrompt ?? prompt.trim(), orch),
      orch ? probeComfyHealthDetailed() : Promise.resolve(null),
    ]);

    if (comfy && orch) {
      orch.note("comfy_probe", {
        reachable: comfy.reachable,
        probeMs: comfy.probeMs,
        timedOut: comfy.timedOut,
        configured: Boolean(getComfyBaseUrl()),
      });
    }

    orch?.note("multi_agent_status", {
      worldOk: maResult.worldOk,
      gameplayOk: maResult.gameplayOk,
      artOk: maResult.artOk,
    });

    const coerced = coerceMultiAgentPartial(maResult.partial);
    if (coerced.ok) {
      const hint = normalizeTemplateHint(options?.templateHint);
      return finish({
        spec: finalizeSpec(prompt.trim(), applyTemplateHint(coerced.spec, hint)),
        source: "llm",
        web: null,
        debug: {
          fallback: false,
          searchEnhance: false,
          enhancedRequested: false,
          enhancedApplied: false,
          templateHint: hint,
        },
      });
    }

    orch?.note("multi_agent_coerce_failed", { fallback: "standard_path" });
    // Multi-agent partial failed coercion — fall through to standard draft+enhance.
  }

  // Standard (fast / standard) path or rich fallback: sequential draft → enhance.
  const draftPromise = generateGameSpecDraftWithMeta(prompt, genOpts);
  const draft = await draftPromise;

  if (!enhancedRequested) {
    orch?.note("spec_enhance_skipped", { reason: "enhance_pass_off" });
    return finish(draft);
  }

  if (draft.source === "mock") {
    orch?.note("spec_enhance_skipped", { reason: "draft_mock_no_llm" });
    return finish({
      ...draft,
      debug: {
        ...draft.debug,
        enhancedRequested: true,
        enhancedApplied: false,
        enhanceWarning: "初稿已回退本地规则生成，已跳过二次强化",
      },
    });
  }

  const enhanced = await enhanceGameSpecFromDraftWithMeta({
    prompt: briefPre?.augmentedPrompt ?? prompt,
    draft: draft.spec,
    draftSource: draft.source,
    draftDebug: { ...draft.debug, enhancedRequested: true },
    web: draft.web ?? null,
    options: { templateHint: genOpts.templateHint, orchestration: orch },
  });

  return finish(enhanced);
}

/** 兼容旧调用：仅返回规格。 */
export async function generateGameSpec(prompt: string): Promise<GameSpec> {
  const { spec } = await generateGameSpecWithMeta(prompt);
  return spec;
}

