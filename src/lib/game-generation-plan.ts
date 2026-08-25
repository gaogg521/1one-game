import type { GameSpec } from "@/lib/game-spec";
import { inferTemplateFromPrompt } from "@/lib/game-templates/infer";
import { resolveTemplateRuntime, type GameTemplateId } from "@/lib/game-templates/registry";
import { mockSpecFromPrompt } from "@/lib/mock-spec";

/**
 * Public game generation is intentionally not a template picker.  This is the
 * small, inspectable compiler contract between a user's sentence and a tested
 * runtime kernel.  Template IDs remain an implementation detail for the
 * runtime and old projects.
 */
export type GameGenerationPlan = {
  version: 1;
  prompt: string;
  kernel: GameTemplateId;
  runtime: ReturnType<typeof resolveTemplateRuntime>["phaser"];
  label: string;
  coreLoop: string;
  controls: string;
  checks: readonly ["goal", "input", "end-state", "mobile-runtime"];
};

const KERNEL_COPY: Partial<Record<GameTemplateId, Pick<GameGenerationPlan, "label" | "coreLoop" | "controls">>> = {
  puzzle: { label: "益智闯关", coreLoop: "观察局面、完成一次有效操作、触发连锁并达成关卡目标", controls: "点击、拖拽或轻触" },
  platformer: { label: "动作闯关", coreLoop: "移动、跳跃、收集并抵达终点", controls: "方向键或触屏按钮" },
  shooter: { label: "即时射击", coreLoop: "移动、瞄准、击退威胁并完成目标", controls: "拖拽或方向键" },
  towerDefense: { label: "策略防守", coreLoop: "布置、升级、应对波次并守住目标", controls: "点击布置与升级" },
  farming: { label: "经营成长", coreLoop: "种植、照料、收获并解锁下一步", controls: "点击地块与物件" },
  chess: { label: "棋盘对局", coreLoop: "选择棋子、执行规则内移动并完成胜负目标", controls: "点击棋子与落点" },
  racing: { label: "竞速挑战", coreLoop: "控制路线、规避碰撞并冲过终点", controls: "方向键或滑动" },
  rhythm: { label: "节奏挑战", coreLoop: "跟随节拍完成输入并保持连击", controls: "点击或轻触" },
};

function defaultCopy(kernel: GameTemplateId): Pick<GameGenerationPlan, "label" | "coreLoop" | "controls"> {
  const runtime = resolveTemplateRuntime(kernel).phaser;
  if (runtime === "arena") {
    return { label: "轻量挑战", coreLoop: "移动、判断风险、完成明确目标", controls: "方向键、滑动或轻触" };
  }
  return { label: "可玩原型", coreLoop: "学习一个核心规则、做出选择并完成一局", controls: "点击、拖拽或触屏操作" };
}

/**
 * Explicit mechanics outrank broad nouns such as “collect”.  This is the
 * product-level guard against a sentence like “横版跳跃收集宝石” becoming a
 * generic collection game merely because that word happened to score higher.
 */
function resolveKernel(prompt: string, hint: "auto" | GameTemplateId): GameTemplateId {
  if (hint !== "auto") return hint;
  if (/(三消|消消乐|match\s*3|match-?three|交换.{0,8}(棋子|方块|宝石))/i.test(prompt)) return "puzzle";
  if (/(横版|平台跳跃|跳跃闯关|二段跳|跑跳)/.test(prompt)) return "platformer";
  if (/(塔防|防守.{0,8}(城堡|基地|家园)|布置.{0,8}(塔|防线))/i.test(prompt)) return "towerDefense";
  if (/(种花|种植|农场|收获|耕种)/.test(prompt)) return "garden";
  if (/(飞机大战|弹幕射击|竖版射击|战机)/.test(prompt)) return "shooter";
  return inferTemplateFromPrompt(prompt, { hint });
}

export function buildGameGenerationPlan(
  prompt: string,
  hint: "auto" | GameTemplateId = "auto",
): GameGenerationPlan {
  const clean = prompt.trim().slice(0, 4000);
  const kernel = resolveKernel(clean, hint);
  const copy = KERNEL_COPY[kernel] ?? defaultCopy(kernel);
  return {
    version: 1,
    prompt: clean,
    kernel,
    runtime: resolveTemplateRuntime(kernel).phaser,
    ...copy,
    checks: ["goal", "input", "end-state", "mobile-runtime"],
  };
}

/** Compile mechanics deterministically; LLMs may enrich copy/assets later but never choose the base interaction. */
export function compileGameGenerationPlan(plan: GameGenerationPlan): GameSpec {
  return mockSpecFromPrompt(plan.prompt, { templateId: plan.kernel });
}

export function validateGameGenerationPlan(plan: GameGenerationPlan, spec: GameSpec): string[] {
  const issues: string[] = [];
  if (spec.templateId !== plan.kernel) issues.push("kernel_mismatch");
  if (!spec.title.trim() || !spec.labels.subtitle?.trim()) issues.push("missing_identity");
  if (!Number.isFinite(spec.gameplay.winScore) || (spec.gameplay.winScore ?? 0) <= 0) issues.push("missing_goal");
  if (!Number.isFinite(spec.gameplay.lives) || (spec.gameplay.lives ?? 0) <= 0) issues.push("missing_recovery");
  if (plan.runtime === "puzzle" && !spec.puzzle) issues.push("missing_puzzle_rules");
  if (plan.runtime === "platformer" && !spec.platformer) issues.push("missing_platform_rules");
  if (plan.runtime === "towerDefense" && !spec.towerDefense) issues.push("missing_defense_rules");
  return issues;
}
