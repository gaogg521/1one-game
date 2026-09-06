# GameForge：多 Agent 游戏生产架构

> **取代** `docs/game-generation-pipeline.md` 里的单次调用模型。那份文档描述的三层运行时与 Phaser 专用 Scene 已在 `8e5eead0` 删除，不要按它改代码。

更新时间：**2026-09-05**

---

## 为什么重构

旧管线是：**一次 LLM 调用 → 12,288 token 上限 → 一个 JS blob → 直接发布**。

实测根因（代码级）：

| 问题 | 位置 | 后果 |
|---|---|---|
| JSON 路径写死 token 上限，忽略 `maxTokens` | `llm/provider-openai-compatible.ts` | 不只是限流，是**筛选器**：复杂输出被截断 → JSON 解析失败 → 重试 → 只有短实现存活 |
| 无引擎层，`ctx` 只有 5 个字段 | `IndependentGameRuntime.tsx` | 每款游戏重写循环/DPI/输入/碰撞/粒子，样板吃掉全部预算 |
| BGM 生成了但没人播 | `GamePlayerInner.tsx` 零音频引用 | 所有游戏静音 |
| 素材锁死 5 张静态图，`boss` 生成后不投递 | `game-sprite-gen.ts` | 无帧动画、无 tileset |
| 设计稿 95% 未传给代码模型 | `agentic-prompts.ts` | director/blueprint/brief 白生成 |
| 「六个 Agent」是纯函数台账 | `game-production-orchestrator.ts` 246 行，0 次 LLM 调用 | 没有 Agent 真的改交付物 |
| `/refine` 不传旧源码 | `refine/route.ts` | 每次修改都是整款重摇，反馈无法累积 |

竞品对照（见 `docs/competitor-research/super-power-x-minecraft.md`）：单款样本 **1.128 MB 代码**、**137 项 Asset Map**、平台注入桥接层、**多轮围绕截图的对话式打磨**。

---

## 新架构

```
Layer 0  Runtime SDK          手写引擎，注入 iframe，零 token 成本
Layer 1  多 Agent 生产链       每个 pass 真调模型、真改交付物
Layer 2  模块化代码            N 个模块各拿满预算，结构性突破 token 上限
```

### Layer 0 — Runtime SDK

`src/lib/game-forge/runtime-sdk.ts`（~45 KB，作为字符串注入 srcDoc）。

提供：固定步长循环（60Hz + 插值 + 失焦暂停）、虚拟分辨率 + DPI 画布 + 自动 resize、
键鼠触控统一输入（含自动虚拟摇杆 / 滑动 / 屏幕按钮）、**程序化音效**（13 种，无需音频文件）、
BGM 播放、粒子 / 震屏 / 顿帧 / 闪白 / 飘字、实体池 + 圆形碰撞、HUD / 进度条 / 横幅 / 提示条 /
胜负结算卡 + 重开按钮、缓动 / 定时器、带种子 RNG、**遥测上报**。

两个关键设计：

1. **资产永远可绘制**。`g.assets.image(url, kind, color)` 在 404 或缺槽时返回生成的占位图，
   所以素材管线部分失败不会让游戏变空白。
2. **虚拟分辨率**。游戏只在 960×540（或设计指定值）里写逻辑，SDK 负责映射到设备，
   一份实现同时在桌面和手机正确。

`src/lib/game-forge/sdk-reference.ts` 是交给代码 Agent 的 API 契约，
`sdk-surface.ts` 是精确成员表——用于判定模型有没有幻觉出不存在的 API。

### Layer 1 — Agent 链路

`src/lib/game-forge/forge.ts` 编排，每个 pass 都产生 `provenance.passes` 记录：

| Agent | 文件 | 输入 → 输出 |
|---|---|---|
| Design Director | `design-agent.ts` | prompt + brief → `GameDesignDoc`（玩法/机制/控制/节奏/资产槽/**模块计划**） |
| Runtime Engineers ×N | `code-agent.ts` | 设计 + SDK 契约 + 本模块 brief → 模块源码 |
| QA | `qa-agent.ts` | 设计 + 模块 → `QaReport`（确定性检查 + 模型评审） |
| Repair | `forge.ts` 内 | QA findings → **只重写受影响的模块** |

**并行**：config → systems（全部并发，受 `moduleConcurrency` 限制）→ main。
systems 之间可以并发，因为跨模块引用通过 `G` 命名空间**晚绑定**，只有顶层语句需要排序，
而排序由装配器负责。

### Layer 2 — 模块化装配

`assemble.ts`。每个模块是一个函数体，装配成：

```js
function mountGame(root, ctx) {
  var G = { ctx: ctx, design: {...} };
  function MOD_config(G) { ... }
  function MOD_spawner(G, g) { ... }
  function MOD_main(G, g) { ... }        // 赋值 G.main
  MOD_config(G);
  var g = GameForge.create(root, { ...G.config });
  MOD_spawner(G, g);
  MOD_main(G, g);
  G.main(g);                              // 内部调用 g.start({...})
}
```

这是突破 token 上限的地方：**5 个模块 × 16,384 token ≫ 1 次调用 × 12,288 token**。
也是让「改一处不动全局」成为可能的地方。

---

## QA：确定性事实 + 模型判断，分开

旧门禁是正则，能被变量名骗过、被注释骗过，所以被整体降级为 advisory。新做法把两者拆开：

**确定性**（`auditStatic`，可在无模型环境跑）
- `stripCommentsAndStrings` 后扫禁用 API —— 注释里的 `fetch(` 不算违规
- 括号平衡 → 检测截断的补全
- **SDK 表面校验** —— `g.physics.step()` / `g.input.onSwipeLeft()` 这类幻觉 API 判 blocker，
  这是能预测运行时崩溃的检查，正则门禁从来没有
- 构建形态：有无胜利路径 / 失败路径 / 用到美术 / 有音效 / 有触屏输入 / 有 HUD
- 角色契约：config 必须赋 `G.config`，main 必须赋 `G.main` 且调 `g.start`

**模型判断**（QA review agent）
- 设计里的机制是否真的变成了运行行为
- 胜负是否可达、首帧是否说清怎么玩、有没有等着崩的写法
- 明确要求：只报能指到具体代码的缺陷，无问题就返回空数组

**诚实边界**：`QaReport.observed` 在没有引擎真跑过之前一律 `false`，报告里写明。

---

## 用户迭代：补丁，不是重摇

`bridge.ts` 的 `editForgeBuild`：

1. Edit Planner Agent 读设计 + 模块清单 + 用户诉求 → 决定**改哪几个模块、各改什么**
2. 只对这些模块跑 Repair，其余模块原样保留
3. 重新装配 + 确定性 QA

`spec.forgeBuild` 持久化设计文档与模块切分（不含已装配源码，源码在 `agenticModule.source`），
这是能做模块级补丁的前提。没有 `forgeBuild` 的历史作品自动回退到整款重建。

---

## 配置

`PRODUCT.gameForge`（`src/lib/product-config.ts`）：

```
enabled            GAME_FORGE=0 关闭，回退旧单次调用路径
designMaxTokens    8_192
moduleMaxTokens    16_384      // 每模块预算
moduleConcurrency  3           // 并发模块数
maxRepairRounds    2
moduleAttempts     3
```

---

## 验证

```bash
npm run qa:game-forge                    # 确定性回归：装配/排序/SDK 表面/形态门禁
npx tsx scripts/qa-game-forge-browser.ts # 产出可在真实浏览器打开的参考构建
```

`qa-game-forge-browser.ts` 手写一个 5 模块真实游戏，走完整装配，输出与线上 srcDoc 同形状的
HTML。**必须在真实浏览器里打开验证**，不能只看静态断言——重构过程中正是这一步抓到了
「装配器声明了 main 模块的函数却从不调用」这个静态检查抓不到的 bug。

已验证（真实 Chromium）：boot 成功、首帧 18.9ms、零运行时错误、失败路径 `won:false`、
胜利路径 `won:true`、键盘与合成触控均触发 `forge-first-input`、结算卡重开生效、
contain 比例保持 1.775、**零真实素材下占位图正常渲染**。

---

## 反模式（禁止）

- 不要把 QA 门禁改回正则匹配机制关键词
- 不要退回模板 / 通用 Scene
- 不要在 `refine` 里整款重生成（除非 `forgeBuild` 缺失）
- 不要在 `llmJson` 调用里省略 `maxTokens` 然后抱怨模型写不长
- 不要新增「只写台账不改交付物」的 Agent
