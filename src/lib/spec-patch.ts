import { llmJson, getProviderModelCascade } from "@/lib/llm";
import { mockSpecFromPrompt } from "@/lib/mock-spec";
import { coerceGameSpec, overlaySpec } from "@/lib/normalize-spec";
import { sanitizeSpecRaw } from "@/lib/sanitize-spec-raw";
import type { AppLocale } from "@/i18n/routing";
import { buildCanonicalAstrocadeSpec } from "@/lib/astrocade-canonical-spec";
import type { GameSpec } from "@/lib/game-spec";
import { buildDirector } from "@/lib/director";
import { buildSystems } from "@/lib/systems";
import { buildTowerDefenseBlueprint } from "@/lib/td-blueprint";
import { withPresentationDefaults } from "@/lib/cohesive-presentation";
import { applyMinecraftThemeOverlay } from "@/lib/minecraft-franchise";
import { buildFarmingBlueprint } from "@/lib/farming-blueprint";

/** 与 `/api/generate/patch` 共用；修改规则时请同步验收「director / systems 不被无损删掉」。 */
export const SPEC_PATCH_SYSTEM = `你是「游戏规格修改器」。根据用户的一句话修改指令，在现有 GameSpec 基础上做出精准修改。

规则：
- 只输出一个完整 JSON 对象（不要 markdown，不要代码块）。
- templateId 必须保持不变。
- 颜色格式必须是 #RRGGBB（含 #）。
- 只改与指令直接相关的字段，无关字段保持原值。
- **director 与 systems**：若当前规格中已存在，必须保留键结构；不要无故删除整条 director 或 systems。仅当修改指令明确要求调整关卡节奏/事件/技能时再改其内部字段。
- 难度/节奏修改 → 调整 hazardSpeed / spawnIntervalMs / winScore / lives / playerSpeed（可同时微调 director.intensity）。
- 主题/风格修改 → 调整 theme 颜色和 labels 文案。
- gameplay 所有字段必须出现（playerSpeed/hazardSpeed/spawnIntervalMs/winScore/lives/arenaPadding/jumpStrength/gravity/startingCoins/baseHealth）。
- **farming 模板**：若 templateId 为 farming 或现有规格含 farming 对象，修改「起始金币/金币」时必须同步更新 **farming.startingCoins**（运行时以该字段为准），可同时保留 gameplay.startingCoins 一致。`;

/** 保存 / 入库前：收敛 JSON 并补齐塔防蓝图、导演层等缺口；再 canonical enrich（与样品 seed 同源）。 */
export function prepareGameSpecForPersist(
  raw: unknown,
  prompt = "",
  locale: AppLocale = "zh-Hans",
): GameSpec {
  const cleaned = sanitizeSpecRaw(raw);
  const coerced = coerceGameSpec(cleaned);
  const hint = prompt.trim();
  if (coerced.ok) {
    return buildCanonicalAstrocadeSpec(hint || coerced.spec.title, locale, {
      persistedSpec: finalizePatchedSpec(hint || coerced.spec.title, coerced.spec),
    });
  }
  const base = mockSpecFromPrompt(hint || "小游戏");
  const overlaid = overlaySpec(base, cleaned);
  return buildCanonicalAstrocadeSpec(hint || overlaid.title, locale, {
    persistedSpec: finalizePatchedSpec(hint || overlaid.title, overlaid),
  });
}

export function finalizePatchedSpec(prompt: string, spec: GameSpec): GameSpec {
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

/** 种田模板：LLM 常只改 gameplay.startingCoins，运行时读 farming.startingCoins */
export function syncFarmingStartingCoins(spec: GameSpec, instruction: string): GameSpec {
  if (spec.templateId !== "farming" && !spec.farming) return spec;
  if (!/金币|coin/i.test(instruction)) return spec;
  const coins = spec.gameplay?.startingCoins;
  if (typeof coins !== "number") return spec;
  const farm = spec.farming ?? buildFarmingBlueprint({ spec });
  if (farm.startingCoins === coins) return spec;
  return { ...spec, farming: { ...farm, startingCoins: coins } };
}

export type PatchGameSpecResult =
  | { ok: true; spec: GameSpec; mergedPrompt?: string }
  | { ok: false; errorKey: string; status: number };

/**
 * 调用 LLM 对规格打补丁（与 HTTP 路由解耦，供 refine 等多入口复用）。
 */
export async function patchGameSpecWithLlm(params: {
  instruction: string;
  currentSpec: unknown;
  currentPrompt?: string;
}): Promise<PatchGameSpecResult> {
  const prompt = params.instruction.trim();
  if (!prompt) {
    return { ok: false, errorKey: "patchInstructionEmpty", status: 400 };
  }

  const coerced = coerceGameSpec(params.currentSpec);
  if (!coerced.ok) {
    return { ok: false, errorKey: "patchSpecInvalid", status: 400 };
  }

  const models = getProviderModelCascade();
  if (!models.length) {
    return { ok: false, errorKey: "patchNoModel", status: 503 };
  }

  const currentPrompt = (params.currentPrompt ?? "").trim();
  const userMsg = `修改指令：${prompt}\n\n现有游戏规格（请在此基础上修改）：\n${JSON.stringify(coerced.spec).slice(0, 8000)}`;

  for (const model of models) {
    try {
      const res = await llmJson({
        model,
        system: SPEC_PATCH_SYSTEM,
        user: userMsg,
        temperature: 0.3,
        mode: "json_object",
        timeoutMs: 22000,
      });
      if (!res.ok) continue;
      const patched = coerceGameSpec(res.raw);
      if (patched.ok) {
        const finalized = syncFarmingStartingCoins(finalizePatchedSpec(prompt, patched.spec), prompt);
        const mergedPrompt = currentPrompt
          ? `${currentPrompt}\n\n【后续修改】${prompt}`.slice(0, 4000)
          : undefined;
        return { ok: true, spec: finalized, mergedPrompt };
      }
    } catch {
      continue;
    }
  }

  return { ok: false, errorKey: "patchFailed", status: 503 };
}
