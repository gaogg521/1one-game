import { llmJson, getProviderModelCascade } from "@/lib/llm";
import { mockSpecFromPrompt } from "@/lib/mock-spec";
import { coerceGameSpec, overlaySpec } from "@/lib/normalize-spec";
import { sanitizeSpecRaw } from "@/lib/sanitize-spec-raw";
import type { GameSpec } from "@/lib/game-spec";
import { buildDirector } from "@/lib/director";
import { buildSystems } from "@/lib/systems";
import { buildTowerDefenseBlueprint } from "@/lib/td-blueprint";
import { withPresentationDefaults } from "@/lib/cohesive-presentation";
import { applyMinecraftThemeOverlay } from "@/lib/minecraft-franchise";

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
- gameplay 所有字段必须出现（playerSpeed/hazardSpeed/spawnIntervalMs/winScore/lives/arenaPadding/jumpStrength/gravity/startingCoins/baseHealth）。`;

/** 与生成流水线一致：塔防蓝图、导演、系统层缺省时补齐（LLM 可不输出这些键）。 */
/** 保存 / 入库前：收敛 JSON 并补齐塔防蓝图、导演层等缺口。 */
export function prepareGameSpecForPersist(raw: unknown, prompt = ""): GameSpec {
  const cleaned = sanitizeSpecRaw(raw);
  const coerced = coerceGameSpec(cleaned);
  const hint = prompt.trim();
  if (coerced.ok) {
    return finalizePatchedSpec(hint || coerced.spec.title, coerced.spec);
  }
  const base = mockSpecFromPrompt(hint || "小游戏");
  const overlaid = overlaySpec(base, cleaned);
  return finalizePatchedSpec(hint || overlaid.title, overlaid);
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
        const finalized = finalizePatchedSpec(prompt, patched.spec);
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
