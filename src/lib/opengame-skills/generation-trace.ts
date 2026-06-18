import type { AppLocale } from "@/i18n/routing";
import { tMessage } from "@/lib/i18n/messages";
import type { OrchestrationRunTrace } from "@/lib/orchestration/run-trace";

export type OpenGameGenerationSummary = {
  tier?: string;
  playRoute?: string;
  attached?: boolean;
  moduleSource?: string;
  browserBenchOk?: boolean;
  browserBenchSkipped?: boolean;
  cliSpikeOk?: boolean;
  cliSpikeSkipped?: boolean;
  cliBridgeOk?: boolean;
};

function tr(locale: AppLocale, key: string, params?: Record<string, string | number | undefined | null>) {
  return tMessage(locale, `createStudioNarrative.stream.${key}`, params);
}

function stepDetail(trace: OrchestrationRunTrace | undefined, name: string): Record<string, unknown> | undefined {
  return trace?.steps.find((s) => s.name === name)?.detail;
}

/** 从 orchestration trace 提取 OpenGame 生成摘要（创作台 / SSE recap） */
export function summarizeOpenGameGeneration(trace?: OrchestrationRunTrace): OpenGameGenerationSummary | null {
  if (!trace) return null;
  const complexity = stepDetail(trace, "opengame_complexity");
  const module = stepDetail(trace, "agentic_module");
  const attach = stepDetail(trace, "agentic_attach_result");
  const gen = stepDetail(trace, "agentic_gen_result");
  const bench = stepDetail(trace, "agentic_browser_bench");
  const cli = stepDetail(trace, "opengame_cli_spike");
  const cliBridge = stepDetail(trace, "opengame_cli_bridge");
  if (!complexity && !module && !attach && !gen && !cli && !cliBridge) return null;

  return {
    tier: typeof complexity?.tier === "string" ? complexity.tier : undefined,
    playRoute:
      typeof module?.playRoute === "string"
        ? module.playRoute
        : typeof complexity?.playRoute === "string"
          ? complexity.playRoute
          : undefined,
    attached: typeof module?.attached === "boolean" ? module.attached : undefined,
    moduleSource:
      typeof attach?.source === "string"
        ? attach.source
        : typeof gen?.source === "string"
          ? gen.source
          : typeof module?.moduleSource === "string"
            ? module.moduleSource
            : undefined,
    browserBenchOk: typeof bench?.ok === "boolean" ? bench.ok : undefined,
    browserBenchSkipped: typeof bench?.skipped === "boolean" ? bench.skipped : undefined,
    cliSpikeOk: typeof cli?.ok === "boolean" ? cli.ok : undefined,
    cliSpikeSkipped: typeof cli?.skipped === "boolean" ? cli.skipped : undefined,
    cliBridgeOk: typeof cliBridge?.ok === "boolean" ? cliBridge.ok : undefined,
  };
}

/** SSE recap 追加行：OpenGame 试玩引擎 + Debug/Agentic 摘要 */
export function buildOpenGameRecapFromTrace(
  locale: AppLocale,
  trace?: OrchestrationRunTrace,
  specFallback?: { agenticPlayRoute?: "dedicated" | "agentic" },
): string[] {
  const summary = summarizeOpenGameGeneration(trace);
  const playRoute = summary?.playRoute ?? specFallback?.agenticPlayRoute;
  if (!summary && !playRoute) return [];

  const lines: string[] = [];
  if (playRoute === "agentic") {
    lines.push(tr(locale, "recapPlayRouteAgentic"));
  } else if (playRoute === "dedicated") {
    lines.push(tr(locale, "recapPlayRouteDedicated"));
  }

  if (summary?.tier) {
    lines.push(tr(locale, "recapOpenGameTier", { tier: summary.tier }));
  }

  if (playRoute === "agentic" && summary) {
    if (summary.attached && summary.moduleSource) {
      lines.push(tr(locale, "recapAgenticModule", { source: summary.moduleSource }));
    } else if (summary.attached === false) {
      lines.push(tr(locale, "recapAgenticModuleMissing"));
    }
    if (summary.browserBenchSkipped === false && summary.browserBenchOk === true) {
      lines.push(tr(locale, "recapBrowserBenchOk"));
    } else if (summary.browserBenchSkipped === false && summary.browserBenchOk === false) {
      lines.push(tr(locale, "recapBrowserBenchFail"));
    }
  }

  return lines;
}

export type GameModelRouteSummary = {
  mode?: "text" | "vision";
  scene?: string;
  models?: string[];
};

/** 从编排 trace 读取 game_model_route 备注（spec 初稿/强化共用最后一次）。 */
export function extractGameModelRoute(trace?: OrchestrationRunTrace): GameModelRouteSummary | null {
  const steps = trace?.steps.filter((s) => s.name === "game_model_route") ?? [];
  const last = steps[steps.length - 1];
  if (!last?.detail) return null;
  const d = last.detail;
  const mode = d.mode === "text" || d.mode === "vision" ? d.mode : undefined;
  const scene = typeof d.scene === "string" ? d.scene : undefined;
  const models = Array.isArray(d.models)
    ? d.models.filter((m): m is string => typeof m === "string" && m.trim().length > 0)
    : undefined;
  if (!mode && !scene && !models?.length) return null;
  return { mode, scene, models };
}

/** SSE / 创作台 recap：展示本次游戏规格使用的模型路由（text vs vision）。 */
export function buildGameModelRecapFromTrace(locale: AppLocale, trace?: OrchestrationRunTrace): string[] {
  const route = extractGameModelRoute(trace);
  if (!route?.models?.length) return [];
  const modeKey =
    route.mode === "vision" ? "recapGameModelModeVision" : "recapGameModelModeText";
  const modeLabel = tr(locale, modeKey);
  const primary = route.models[0] ?? "";
  const fallbacks = route.models.slice(1).join(", ");
  return [
    tr(locale, "recapGameModelRoute", {
      modeLabel,
      scene: route.scene ?? "game",
      primary,
      fallbacks: fallbacks ? ` · 备用 ${fallbacks}` : "",
    }),
  ];
}
