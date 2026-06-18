import type { GameSpec } from "@/lib/game-spec";
import { PRODUCT } from "@/lib/product-config";
import { shouldSkipTemplateFirstForPrompt } from "@/lib/opengame-skills/complexity-route";

/** 用户试玩路由：专用 Scene（样品同级） vs AgenticScene + OpenGame Skills */
export type AgenticPlayRoute = "dedicated" | "agentic";

export type OpenGameAgenticRouteMode = "complex_only" | "all" | "off";

export function readOpenGameAgenticRouteMode(): OpenGameAgenticRouteMode {
  const raw = (process.env.OPENGAME_AGENTIC_ROUTE ?? "complex_only").trim().toLowerCase();
  if (raw === "all" || raw === "off") return raw;
  return "complex_only";
}

type RouteSpec = Pick<GameSpec, "templateId" | "agenticPlayRoute" | "title" | "labels">;

export type ResolveAgenticPlayRouteOptions = {
  /** 生成/refine 时应为 false，避免旧 agenticPlayRoute 锁死路由 */
  respectPersisted?: boolean;
};

/**
 * 生成 / refine 时决定试玩走 dedicated Scene 还是 Agentic + Skills。
 * 复杂 prompt（OpenGame agentic_complex）默认走 agentic；简单 prompt 仍走样品级专用 Scene。
 */
export function resolveAgenticPlayRoute(
  prompt: string,
  spec: RouteSpec,
  opts?: ResolveAgenticPlayRouteOptions,
): AgenticPlayRoute {
  const respectPersisted = opts?.respectPersisted !== false;
  if (respectPersisted) {
    if (spec.agenticPlayRoute === "agentic") return "agentic";
    if (spec.agenticPlayRoute === "dedicated") return "dedicated";
  }

  if (process.env.AGENTIC_FORCE_LLM === "1") return "agentic";

  const mode = readOpenGameAgenticRouteMode();
  if (mode === "off") return "dedicated";
  if (mode === "all") return "agentic";

  if (shouldSkipTemplateFirstForPrompt(prompt, spec as GameSpec)) return "agentic";

  if (!PRODUCT.game.dedicatedSceneForTemplateFirst) return "agentic";
  const tid = spec.templateId;
  if (!tid) return "agentic";
  if (!PRODUCT.game.agenticTemplateFirst.includes(tid)) return "agentic";

  return "dedicated";
}

/** dedicated 路由：剥离 agenticModule，避免试玩误走 AgenticScene */
export function stripAgenticModuleForDedicatedRoute(spec: GameSpec): GameSpec {
  if (!spec.agenticModule?.source) {
    return spec.agenticPlayRoute === "dedicated" ? spec : { ...spec, agenticPlayRoute: "dedicated" as const };
  }
  const { agenticModule: _removed, ...rest } = spec;
  return { ...rest, agenticPlayRoute: "dedicated" as const };
}

/** 试玩 / normalize 时：是否走 template-first 专用 Scene（剥离 agenticModule） */
export function shouldUseDedicatedSceneForTemplateFirst(
  spec: RouteSpec,
  prompt?: string,
): boolean {
  if (spec.agenticPlayRoute === "agentic") return false;
  if (spec.agenticPlayRoute === "dedicated") return true;
  if (prompt?.trim()) {
    return resolveAgenticPlayRoute(prompt.trim(), spec) === "dedicated";
  }
  if (!PRODUCT.game.dedicatedSceneForTemplateFirst) return false;
  const tid = spec.templateId;
  if (!tid) return false;
  return PRODUCT.game.agenticTemplateFirst.includes(tid);
}

export function stampAgenticPlayRoute(prompt: string, spec: GameSpec): GameSpec {
  const route = resolveAgenticPlayRoute(prompt, spec, { respectPersisted: false });
  if (spec.agenticPlayRoute === route) return spec;
  return { ...spec, agenticPlayRoute: route };
}
