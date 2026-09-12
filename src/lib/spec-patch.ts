import { llmJson } from "@/lib/llm";
import { resolveGameModelRoute } from "@/lib/game-model-route";
import { runtimeLocaleGroupForCurrentRequest } from "@/lib/runtime-locale-routing";
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
import { applyHardQualityDefaults } from "@/lib/game-quality";
import { applyMinecraftThemeOverlay } from "@/lib/minecraft-franchise";
import { buildFarmingBlueprint } from "@/lib/farming-blueprint";
import { buildDefaultGameProductionContract } from "@/lib/game-production-contract";
import { getActiveGameSpecJsonSchema } from "@/lib/generate-spec";
import { PRODUCT } from "@/lib/product-config";

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
    const canonical = buildCanonicalAstrocadeSpec(hint || coerced.spec.title, locale, {
      persistedSpec: finalizePatchedSpec(hint || coerced.spec.title, coerced.spec),
    });
    const checked = coerceGameSpec(sanitizeSpecRaw(canonical));
    return checked.ok ? checked.spec : canonical;
  }
  const base = mockSpecFromPrompt(hint || "小游戏");
  const overlaid = overlaySpec(base, cleaned);
  const canonical = buildCanonicalAstrocadeSpec(hint || overlaid.title, locale, {
    persistedSpec: finalizePatchedSpec(hint || overlaid.title, overlaid),
  });
  const checked = coerceGameSpec(sanitizeSpecRaw(canonical));
  return checked.ok ? checked.spec : canonical;
}

export function finalizePatchedSpec(prompt: string, spec: GameSpec): GameSpec {
  let next = spec;
  const production = next.production;
  const productionIncomplete =
    !production ||
    production.levelFlow.length !== 4 ||
    !production.delivery ||
    production.audio.sections.length !== 4 ||
    !production.audio.ambience ||
    (production.audio.mix.maxConcurrentSfx ?? 99) > 4 ||
    production.audio.mobile.startsAfterFirstGesture !== true;
  if (productionIncomplete) {
    next = {
      ...next,
      production: buildDefaultGameProductionContract({ prompt, templateId: next.templateId }),
    };
  }
  if (spec.templateId === "towerDefense" && !spec.towerDefense) {
    next = { ...next, towerDefense: buildTowerDefenseBlueprint({ prompt, spec: next }) };
  }
  if (!next.director) {
    next = { ...next, director: buildDirector({ prompt, spec: next }) };
  }
  if (!next.systems) {
    next = { ...next, systems: buildSystems({ prompt, spec: next }) };
  }
  return applyHardQualityDefaults(withPresentationDefaults(applyMinecraftThemeOverlay(next)), prompt);
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
 * 结构化补丁只覆盖 schema 覆盖到的核心字段，其余（forgeBuild / production /
 * systems / 各模板蓝图）按原值保留。模型物理上无法删掉它没被要求输出的东西。
 */
export function mergePatchedCoreSpec(base: GameSpec, raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const obj = (v: unknown): Record<string, unknown> | null =>
    v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

  const theme = obj(r.theme);
  const gameplay = obj(r.gameplay);
  const labels = obj(r.labels);
  const presentation = obj(r.presentation);
  const director = obj(r.director);

  return {
    ...base,
    // 合同：局部修改不换模板，否则已生成的运行时与蓝图会与规格失配。
    templateId: base.templateId,
    title: typeof r.title === "string" && r.title.trim() ? r.title.trim().slice(0, 80) : base.title,
    theme: theme ? { ...base.theme, ...theme } : base.theme,
    gameplay: gameplay ? { ...base.gameplay, ...gameplay } : base.gameplay,
    labels: labels ? { ...base.labels, ...labels } : base.labels,
    presentation: presentation ? { ...base.presentation, ...presentation } : base.presentation,
    director: director ?? base.director,
  };
}

/** 只保留可诊断的短代码，不带指令、规格或网关地址。 */
function patchFailureCode(reason: string): string {
  const r = reason.toLowerCase();
  if (/timeout|aborted|etimedout/.test(r)) return "timeout";
  if (/not parseable|no parseable|empty json/.test(r)) return "unparseable";
  if (/response[_ ]format|json[_ ]schema|schema/.test(r)) return "schema_unsupported";
  if (/401|403|api key|unauthor/.test(r)) return "auth";
  if (/429|rate/.test(r)) return "rate_limited";
  if (/5\d\d|upstream|bad gateway/.test(r)) return "upstream";
  return "model_failed";
}

/**
 * 调用 LLM 对规格打补丁（与 HTTP 路由解耦，供 refine 等多入口复用）。
 *
 * 生产 `game_text` 模型（deepseek-v4-flash）在 `json_object` 上被实测为不收敛：
 * 每次调用都会耗尽预算而不返回，因此这里与主生成链路统一为 `json_schema`，
 * 并禁止回退到另一种 response_format —— 回退只会把剩余预算烧在同一个死模式里。
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

  const currentPrompt = (params.currentPrompt ?? "").trim();
  const localeGroup = await runtimeLocaleGroupForCurrentRequest();
  const gameRoute = resolveGameModelRoute({
    prompt: `${currentPrompt}\n${prompt}`.trim(),
    localeGroup,
  });
  const models = gameRoute.models;
  if (!models.length) {
    return { ok: false, errorKey: "patchNoModel", status: 503 };
  }

  const baseUser = `修改指令：${prompt}\n\n现有游戏规格（请在此基础上修改）：\n${JSON.stringify(coerced.spec).slice(0, 8000)}`;
  const retryUser = `${baseUser}\n\n上一次回复没有产生可解析的结果。请只输出 schema 要求的核心字段，不要解释、不要 markdown。`;

  let lastReason = "no_attempt";
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const startedAt = Date.now();
      let reason = "";
      try {
        const res = await llmJson({
          model,
          scene: gameRoute.scene,
          localeGroup,
          system: SPEC_PATCH_SYSTEM,
          user: attempt === 0 ? baseUser : retryUser,
          temperature: attempt === 0 ? 0.3 : 0.15,
          mode: "json_schema",
          jsonSchema: getActiveGameSpecJsonSchema(),
          singleModeOnly: true,
          thinking: /^deepseek-v4-/i.test(model) ? { type: "disabled" } : undefined,
          timeoutMs: PRODUCT.game.repairTimeoutMs,
        });
        if (res.ok) {
          const patched = coerceGameSpec(mergePatchedCoreSpec(coerced.spec, res.raw));
          if (patched.ok) {
            const finalized = syncFarmingStartingCoins(finalizePatchedSpec(prompt, patched.spec), prompt);
            const mergedPrompt = currentPrompt
              ? `${currentPrompt}\n\n【后续修改】${prompt}`.slice(0, 4000)
              : undefined;
            return { ok: true, spec: finalized, mergedPrompt };
          }
          reason = "merged spec not parseable";
        } else {
          reason = res.error ?? "model_failed";
        }
      } catch (error) {
        reason = error instanceof Error ? error.message : String(error);
      }
      lastReason = reason;
      console.error(
        `[spec-patch] scene=${gameRoute.scene} model=${model} attempt=${attempt} ok=false code=${patchFailureCode(reason)} ms=${Date.now() - startedAt}`,
      );
    }
  }

  console.error(`[spec-patch] exhausted models=${models.length} code=${patchFailureCode(lastReason)}`);
  return { ok: false, errorKey: "patchFailed", status: 503 };
}
