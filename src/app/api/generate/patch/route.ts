import { NextResponse } from "next/server";
import { llmJson, getProviderModelCascade } from "@/lib/llm";
import { coerceGameSpec } from "@/lib/normalize-spec";
import type { GameSpec } from "@/lib/game-spec";
import { buildDirector } from "@/lib/director";
import { buildSystems } from "@/lib/systems";
import { buildTowerDefenseBlueprint } from "@/lib/td-blueprint";
import { withPresentationDefaults } from "@/lib/cohesive-presentation";

const PATCH_SYSTEM = `你是「游戏规格修改器」。根据用户的一句话修改指令，在现有 GameSpec 基础上做出精准修改。

规则：
- 只输出一个完整 JSON 对象（不要 markdown，不要代码块）。
- templateId 必须保持不变。
- 颜色格式必须是 #RRGGBB（含 #）。
- 只改与指令直接相关的字段，无关字段保持原值。
- 难度/节奏修改 → 调整 hazardSpeed / spawnIntervalMs / winScore / lives / playerSpeed。
- 主题/风格修改 → 调整 theme 颜色和 labels 文案。
- gameplay 所有字段必须出现（playerSpeed/hazardSpeed/spawnIntervalMs/winScore/lives/arenaPadding/jumpStrength/gravity/startingCoins/baseHealth）。`;

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
  return withPresentationDefaults(next);
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "请求体必须是对象" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const prompt = typeof b.prompt === "string" ? b.prompt.trim() : "";
  const currentSpec = b.currentSpec;

  if (!prompt) {
    return NextResponse.json({ error: "修改指令不能为空" }, { status: 400 });
  }

  const coerced = coerceGameSpec(currentSpec);
  if (!coerced.ok) {
    return NextResponse.json({ error: "当前规格无效，无法修改" }, { status: 400 });
  }

  const models = getProviderModelCascade();
  if (!models.length) {
    return NextResponse.json({ error: "未配置可用模型" }, { status: 503 });
  }

  const userMsg = `修改指令：${prompt}\n\n现有游戏规格（请在此基础上修改）：\n${JSON.stringify(coerced.spec).slice(0, 8000)}`;

  for (const model of models) {
    try {
      const res = await llmJson({
        model,
        system: PATCH_SYSTEM,
        user: userMsg,
        temperature: 0.3,
        mode: "json_object",
        timeoutMs: 22000,
      });
      if (!res.ok) continue;
      const patched = coerceGameSpec(res.raw);
      if (patched.ok) {
        const finalized = finalizeSpec(prompt, patched.spec);
        return NextResponse.json({ spec: finalized });
      }
    } catch {
      continue;
    }
  }

  return NextResponse.json({ error: "修改失败，请稍后重试" }, { status: 503 });
}
