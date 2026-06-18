import type { GameSpec } from "@/lib/game-spec";
import type { AgenticGameModule } from "@/lib/agentic/game-module";
import {
  buildAgenticRepairPrompt,
  buildAgenticSystemPrompt,
} from "@/lib/agentic/agentic-prompts";
import { validateAgenticSource, parseAgenticModule } from "@/lib/agentic/game-module";
import { buildDebugSkillRepairHints } from "@/lib/opengame-skills/debug-skill";
import { runAgenticBrowserBench } from "@/lib/opengame-skills/browser-bench";
import {
  isOpenGameBrowserBenchEnabled,
  isOpenGameBrowserBenchRepairEnabled,
  isOpenGameBrowserBenchRequired,
} from "@/lib/opengame-skills/browser-bench-env";
import { llmJson, getActiveProvider, getProviderModelCascade } from "@/lib/llm";

async function serverReachable(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(baseUrl.replace(/\/$/, ""), { signal: AbortSignal.timeout(6000) });
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

function parseLlmModule(raw: unknown): AgenticGameModule | null {
  const o = raw as { source?: string; entry?: string };
  const source = typeof o?.source === "string" ? o.source : "";
  const entry = typeof o?.entry === "string" ? o.entry : "createGame";
  const check = validateAgenticSource(source);
  if (!check.ok) return null;
  return parseAgenticModule({ version: 1, source, entry });
}

/**
 * 生成管线可选步骤：真浏览器探测 Agentic 模块（OPENGAME_BROWSER_BENCH=1）。
 * 失败且 OPENGAME_BROWSER_BENCH_REPAIR=1 时追加一轮 LLM repair（带 Browser Bench 诊断）。
 */
export async function maybeVerifyAgenticModuleInBrowser(
  prompt: string,
  spec: GameSpec,
  mod: AgenticGameModule,
): Promise<{ module: AgenticGameModule; benchOk: boolean; benchSkipped: boolean }> {
  if (!isOpenGameBrowserBenchEnabled()) {
    return { module: mod, benchOk: true, benchSkipped: true };
  }

  const base =
    process.env.PLAYWRIGHT_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://127.0.0.1:8888";

  if (!(await serverReachable(base))) {
    if (isOpenGameBrowserBenchRequired()) {
      console.warn("[opengame] browser bench required but server unreachable:", base);
    }
    return { module: mod, benchOk: true, benchSkipped: true };
  }

  const { chromium } = await import("@playwright/test");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    let candidate = mod;
    let result = await runAgenticBrowserBench(page, spec, candidate, base);
    if (result.ok) {
      return { module: candidate, benchOk: true, benchSkipped: false };
    }

    if (!isOpenGameBrowserBenchRepairEnabled() || !getActiveProvider()) {
      return { module: candidate, benchOk: false, benchSkipped: false };
    }

    const hints = buildDebugSkillRepairHints(result.checks);
    const model = getProviderModelCascade()[0];
    if (!model) return { module: candidate, benchOk: false, benchSkipped: false };

    const repairResult = await llmJson({
      model,
      system: buildAgenticSystemPrompt(),
      user: buildAgenticRepairPrompt(
        prompt,
        spec,
        candidate.source,
        "browser_bench_failed",
        hints,
      ),
      temperature: 0.32,
      mode: "json_object",
      timeoutMs: 55_000,
    });
    if (!repairResult.ok) {
      return { module: candidate, benchOk: false, benchSkipped: false };
    }
    const repaired = parseLlmModule(repairResult.raw);
    if (!repaired) {
      return { module: candidate, benchOk: false, benchSkipped: false };
    }
    candidate = repaired;
    result = await runAgenticBrowserBench(page, spec, candidate, base);
    return { module: candidate, benchOk: result.ok, benchSkipped: false };
  } finally {
    await browser.close();
  }
}
