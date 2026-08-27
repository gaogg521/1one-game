# 游戏生成管线：LLM 是作者，内核只校验

> **下一任 AI 必读。** 违反本决策会再次把「护送萤火虫」编成 collector，或把「后台要看模型」实现成「生成必须走内核」。

相关代码：`src/lib/generate-spec.ts`、`src/lib/game-generation-plan.ts`、`src/lib/work-generation-meta.ts`  
决策记录：`PROJECT_MEMORY/DECISIONS.md`（2026-08-27）

---

## 产品事实（不要再辩）

Operone 玩家跑的是 **仓库里有限的 Phaser 模板 + `GameSpec`**，不是 Claude 聊天里当场写出来的任意实现。

所以：

| 角色 | 做什么 | 不做什么 |
|------|--------|----------|
| **LLM** | 默认作者。围着用户提示词选 `templateId`、写文案/关卡/数值 | 不被正则关键词先锁死玩法 |
| **内核** | 校验目标、操作、胜负、手机一局；过不了再按 **LLM 已选的模板**（或 `auto`）编译可玩兜底 | 不当默认作者；不用 `overlaySpec(kernel, llm)` 把玩法扳回关键词核 |
| **采集** | 每次调用记下 `provider` / `model` / `scene` / `fallback` / `kernelFallback`，后台读真实模型 | 不因为「要看模型」去改生成架构；空 debug **不得**推断成 kernel |

Claude 聊天能做出丰富可玩游戏，是因为它**当场写能跑的实现**。这边做不到同一件事的根因是 **运行时模板有限**，不是「模型不够聪明、所以必须先走内核」。

---

## 默认管线（`pipeline` 缺省 = `"llm"`）

1. **不要**先 `buildGameGenerationPlan(prompt)` 用正则锁核。
2. **不要**把 `lockedTemplateHint` 塞进 brief / LLM（除非用户显式指定了 `templateHint`）。
3. **不要**在用户消息前加 `【系统强制】templateId 必须是 "collector"` 这类规则锁（`pipeline=kernel` 除外）。
4. LLM 出 spec → `finalizeSpec` → **按 spec.templateId 编校验计划** → `validateGameGenerationPlan` + `evaluateGameDeliveryReadiness`。
5. 校验失败或根本没调到模型（`source=mock`）→ 内核兜底；`debug.kernelFallback=true`；**已调用过的 provider/model 必须保留**。
6. 校验通过 → 原样使用 LLM spec，禁止 `overlaySpec` 覆盖玩法。

对照实验 / 离线 QA 才用 `pipeline: "kernel"`（正则先锁 + 直接编译，不调 LLM）。见 `scripts/qa-game-generation-kernel.ts`。

---

## 采集（与管线分离）

- SSE `debug` 必须带 `provider`、`model`、`source`、`scene`、`fallback`、`kernelFallback`。
- 创作台 POST `/api/projects` 原样上送 `debug`；**禁止** `source` 缺省写成 `"kernel"`。
- `parseWorkGenerationFromUnknown`：有真实模型 ID 就落模型。`source=kernel` 不得盖掉 `gpt-5.2` / `doubao-*` / `ep-*`。
- 空 body / 无 debug → 后台显示「未记录」，**禁止**按 `spec.templateId` 假装这是内核生成。
- 后台文案：有真实模型 → `provider · model`；仅内核兜底且没有模型 → 「内核编译 · {模板}」。

---

## 反例（已经踩过，不要重演）

1. `generateGameSpecWithMeta` 默认 `pipeline ?? "kernel"`，内核编译后 **提前 return**，大模型根本没调用 → 后台全是「未记录」或「内核编译」。
2. POST `/api/projects` 在 debug 为空时 **推断成 kernel + templateId** → 把采集失败伪装成内核作品。
3. `finish()` 里 `overlaySpec(compiledKernel.spec, spec)` + `applyTemplateHint(..., compiledKernel.plan.kernel)` → LLM 即使被调用，玩法仍被关键词核锁死（护送萤火虫 → collector）。
4. 把「管理员要看每份作品用了哪个模型」理解成「生成架构必须改成固定内核」。采集是埋点，不是玩法作者。
