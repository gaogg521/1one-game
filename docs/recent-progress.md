# 近期进展纪要

> 汇总最近一段时间在产品体验、运行时一致性、编排性能与文档规划上的迭代，便于归档与对外同步。  
> （实现以仓库当前代码为准；若与旧分支不一致，以 `main`/当前分支为准。）

**给其他 AI / 协作者的完整架构 + 接手说明**：见 [`ai-handoff-architecture-cn.md`](ai-handoff-architecture-cn.md)。

**结构化记忆（推荐下一棒先读）**：[`PROJECT_MEMORY/INDEX.md`](../PROJECT_MEMORY/INDEX.md) → `CURRENT_STATUS.md` / `NEXT_ACTION.md`。

---

## 2026-05-16 游戏生成产品升级（Phase 1 起步）

- **创作台共创流程**：`/create` 已从“一句话直接出结果”升级成 **4 步共创**：
  1. 输入创意  
  2. 系统提炼意图  
  3. 提供 2~3 个候选方向  
  4. 确认方向后再生成试玩规格
- **SSE 体验**：日志中新增“当前理解 / 已选方向 / 成品提要”，更接近产品化创作工具，而不是黑盒生成器。
- **项目版本化**：
  - `PATCH /api/projects/[id]` 可直接更新 `prompt + spec`
  - `/create?from=` 可恢复完整项目上下文（而非只回填 prompt）
  - `play/[id]` 支持 **AI patch 后保存**、**快速调参后保存**
- **共享玩法层推进**：
  - `shooter` 已开始真正消费 `systems.skill` 与 `director.events`
  - 支持护盾、减速场、爆发射击、goalShift 演出窗口与 HUD 冷却显示
- **塔防蓝图增强**：
  - `td-blueprint.ts` 波次加入 `rush / elite` 变体，强化中层节奏，不再只是线性堆数量

实现重点：
- `src/app/create/CreateClient.tsx`
- `src/app/play/[id]/PlayGameClient.tsx`
- `src/app/api/projects/[id]/route.ts`
- `src/app/api/generate/patch/route.ts`
- `src/game/engine/ShooterScene.ts`
- `src/lib/td-blueprint.ts`

验证：
- `npm run build` 通过
- 本轮相关文件 `ReadLints` 无新增问题

---

## 2026-05-16 小说 / 漫画：文生图批量与广场删除

- **文生图**：未配置 `COMFY_UI_BASE_URL` 时走 **OpenAI 兼容网关**（`gpt-image-2`）。短篇 ≤4 格支持 **`IMAGE_GEN_BATCH_PANELS=4`** 单次 `n=4`（实测约 4 分半 / 批）。
- **漫画**：`panelCount > 4` 时创建接口 **不内联配图**，由 `POST /api/comic/[id]/panels/stream` 流式补图；SSE 推送每格 **已用时**。
- **小说广场**：列表返回 `isOwner`，本人作品卡片悬停可 **删除**（`DELETE /api/novel/[id]`）。
- **样例**：《煤山崇祯》`cmp7w7381000auz81yisafq0h` → 漫画 `cmp8e84lk0001x6zgo8jrd8jg`（2 页 8 格，配图约 12 分钟）。中篇 8 页分镜单次 LLM 仍可能 502。
- 细节见 [`PROJECT_MEMORY/iterations/2026-05-16.md`](../PROJECT_MEMORY/iterations/2026-05-16.md) §三轮。

---

## 2026-05 游戏画面视觉大升级（全模板）

本次对 Phaser 引擎层做了全面的视觉品质提升，所有改动均作用于**全局渲染管线**，新旧游戏均受益。

### PlayScene（avoider / collector / survivor）角色贴图重写

**之前**：玩家 = 纯色矩形，敌人 = 纯色矩形，收集物 = 纯色圆形——无任何视觉细节。  
**现在**：
- **玩家**：圆角身体 + 高光 + 双眼 + 小脚（类 Kirby 圆润角色感）
- **敌人**：带棘刺冠 + 发光双眼 + 怒眉，传递威胁感
- **收集物（Gem）**：钻石菱形 + 光泽高光
- **道具（Power-up）**：五角星 + 内部闪光

实现：`src/game/engine/PlayScene.ts`（`create()` 内程序化贴图生成区）

### TowerDefenseScene 地图渲染完全重写（`drawGridMap`）

**之前**：深绿纯色底 + 棕色土路，无层次感。  
**现在**（保卫萝卜 / PvZ 风格）：

| 元素 | 变化 |
|------|------|
| **背景草地** | 明亮双色交替（`#4fa832` / `#45982b`），顶部高光条 |
| **草地装饰** | 确定性随机：彩色小花（4 种颜色）+ 草丛 + 圆石 + 灌木 |
| **路径砖块** | 沙色石板（`#d4aa6a`），2px 勾缝（`#9c7040`），顶左白色高光 + 底右阴影 + 内部裂纹纹理 |
| **路径边缘** | 路径砖块向草地方向投 5px 阴影，增加深度感 |

实现：`src/game/engine/TowerDefenseScene.ts` → `drawGridMap()`

### 建造指示器改为绿色指示针

**之前**：半透明灰色圆角矩形 + 细加号——像 UI 组件。  
**现在**：绿色圆形底座（外晕 + 深色描边）+ 白色加号 + 向上绿色箭头针，风格与《保卫萝卜》完全一致。

实现：`src/game/engine/TowerDefenseScene.ts` → `resumeCreateAfterReferences()` 槽位绘制段

### 炮塔贴图卡通化（3 类各异外形 + 眼睛表情）

**之前**：三种炮塔共用同一机械炮台纹理，只有颜色不同。  
**现在**：每种炮塔均为独立设计的卡通角色，48×52 画布：

| 类型 ID | 外形 | 特色 |
|---------|------|------|
| `dart`（箭塔）| 植物系绿色圆体 | 侧叶 + 向上尖箭 + 开心大眼 + 红晕 |
| `splash`（炸弹塔）| 火焰系暖色圆体 | 橙黄火焰花瓣 + 顶部火苗 + 怒眉发光眼 |
| `frost`（寒霜塔）| 冰晶系冷色圆体 | 冰晶棘刺 + 雪花顶饰 + 半闭慵懒眼 |

所有炮塔底部共用灰色石质底座，建塔后槽位改为绿色草地圆形，融入地图风格。  
移除了之前 `s.gfx.setTint()` 的强制染色，让纹理细节得以正确显示。

实现：`src/game/engine/TowerDefenseScene.ts` → `ensureTowerTextureForId()`

### 敌人贴图恢复真实颜色

**之前**：update 循环每帧对敌人调用 `setTint(hazardColor)`，把已有的耳朵、眼睛、高光全部覆盖为单色。  
**现在**：只在减速状态时施加蓝色 tint，平时调用 `clearTint()` 让纹理细节显示。

实现：`src/game/engine/TowerDefenseScene.ts` → `update()` 末尾染色区块

### 终点守护目标始终可见

**之前**：无参考图时终点仅有一个小 ▶ 橙色圆圈标记，用户不知道在守护什么。  
**现在**：无论是否上传参考图，路径终点都绘制程序化守护物：
- 识别「萝卜」→ 橙色三角 + 绿叶胡萝卜形
- 识别「水晶/核心」→ 六边形冰晶
- 通用 → 带核心宝石的盾形基地
均带发光圆环和名称标签。

实现：`src/game/engine/TowerDefenseScene.ts` → `resumeCreateAfterReferences()` 终点标记段

### 塔防路径多样化（4 种模板，由标题 hash 决定性选择）

**之前**：所有塔防游戏使用同一条硬编码 Z 形路径。  
**现在**：内置 4 种模板，由 `hashString(prompt + title) % 4` 选取，保证同一游戏每次渲染路径相同：

| 模板 | 特征 |
|------|------|
| A（Z 形） | 经典 S/Z 折返，中间宽阔防御空间 |
| B（双 U 形）| 左右两次折返，更多路径转角 |
| C（宽螺旋形）| 大开大合，适合慢速/溅射型炮塔布防 |
| D（波浪形）| 三段折返，节奏均匀 |

实现：`src/lib/td-blueprint.ts` → `PATH_TEMPLATES`

### 塔位分布改善（每段各取、最小间距过滤）

**之前**：10 个塔位按 `i % (段数)` 顺序分配，导致部分段落获得 2～3 个相邻槽位，视觉上聚集。  
**现在**：每段各取 2 个候选位（两侧），再按最小相对距离 0.13 过滤，确保间距均匀且覆盖全路径。

实现：`src/lib/td-blueprint.ts` → 塔位生成段

### PlatformerScene 背景主题化

**之前**：统一用低透明度光点（starfield），与游戏主题无关联。  
**现在**：根据游戏标题/副标题关键词自动选择背景风格：

| 关键词 | 背景元素 |
|--------|----------|
| 太空 / 星 / galaxy | 密集星点 + 远景行星 |
| 海 / 珊瑚 / 水下 | 气泡轮廓 + 远景珊瑚剪影 |
| 森林 / 树 / 草地 | 远景树木轮廓 + 地面雾气层 |
| 赛博 / 霓虹 / 数字 | 网格线 + 数据节点光点 |
| 通用 | 远景山丘剪影 |

实现：`src/game/engine/PlatformerScene.ts` → `addStarfield()`

---

## 试听与视觉一致性（GameSpec → Phaser → 试玩外壳）

- **`presentation.musicProfile`**（`organic` · `pulse` · `minimal` · `neon`）写入 **`GameSpec`**（可选）；未给出时由 **`withPresentationDefaults`** 根据主题饱和度与背景亮度推断。
- **`src/lib/cohesive-presentation.ts`**：由 `theme` 六色推导 **HUD 文案色**、**HudBanner** 底/描边/字色、**塔防**塔位圈与底部选择条、**平台关卡**平台贴图三色；并为 **`GamePlayerInner`** 提供 **`chrome`**（映射 `--gc-accent`、`--gc-text`、`--gc-cta-*` 等），使试玩卡片外壳与画布内气质一致。
- **`GameSoundscape`**（`src/game/audio/gameSoundscape.ts`）：Web Audio 程序化铺底；`prefers-reduced-motion` 时不播放铺底。
- **`webBleeps`**：**`setBleepTemperament`** 按主题色相微调拾取/受击/胜利蜂鸣音高。

## 参考图与会话像素管线（浏览器侧）

- **透明通道**：带 Alpha 的格式在透明画布上绘制，优先 **WebP/PNG** 进入会话。
- **贴片规范化**：识别怪/敌/主角/塔等用途时在方格内 **contain**。
- **塔防模板**参考图按用途驱动试玩：背景类作全屏底图，怪物类作敌军，主角/萝卜/水晶等作路径终点守护形象。

## 生成与编排性能

- **联网增强**：多 URL **`Promise.all`** 并行抓取正文。
- **Rich 编排**：Comfy 探活与初稿 draft `Promise.all` 并行。

## 相关源码索引

| 主题 | 路径 |
|------|------|
| 塔防地图渲染 | `src/game/engine/TowerDefenseScene.ts` → `drawGridMap()` |
| 塔防炮塔贴图 | `src/game/engine/TowerDefenseScene.ts` → `ensureTowerTextureForId()` |
| 塔防路径模板 | `src/lib/td-blueprint.ts` |
| PlayScene 贴图 | `src/game/engine/PlayScene.ts` → `create()` 贴图生成段 |
| 平台背景 | `src/game/engine/PlatformerScene.ts` → `addStarfield()` |
| 一致性推导 | `src/lib/cohesive-presentation.ts` |
| 规格字段 | `src/lib/game-spec.ts`、`src/lib/normalize-spec.ts`、`src/lib/generate-spec.ts` |
| 环境音 | `src/game/audio/gameSoundscape.ts`、`audio-context.ts`、`webBleeps.ts` |
| 引擎入口 | `src/game/engine/createPhaserGame.ts` |
| 试玩外壳 | `src/components/GamePlayerInner.tsx` |


- **`presentation.musicProfile`**（`organic` · `pulse` · `minimal` · `neon`）写入 **`GameSpec`**（可选）；未给出时由 **`withPresentationDefaults`** 根据主题饱和度与背景亮度推断。
- **`src/lib/cohesive-presentation.ts`**：由 `theme` 六色推导 **HUD 文案色**、**HudBanner** 底/描边/字色、**塔防**塔位圈与底部选择条、**平台关卡**平台贴图三色；并为 **`GamePlayerInner`** 提供 **`chrome`**（映射 `--gc-accent`、`--gc-text`、`--gc-cta-*` 等），使试玩卡片外壳与画布内气质一致。
- **`GameSoundscape`**（`src/game/audio/gameSoundscape.ts`）：/Web Audio 程序化铺底；与 **`buildCohesivePresentation`** 的 `musicProfile`、**`thematicRootFrequencyHz`**、`director.intensity` 挂钩；首次 **`pointerdown`** 启动（合规自动播放）；`Phaser` **`DESTROY`** 时释放；**`prefers-reduced-motion`** 时不播放铺底。
- **`audio-context.ts`**：蜂鸣与环境音 **共用 `AudioContext`**。
- **`webBleeps`**：**`setBleepTemperament`** 按主题色相微调拾取/受击/胜利蜂鸣音高。
- **HudBanner**：构造函数接收 **`CohesiveHudBannerStyle`**；描边使用 **`setStrokeStyle(线宽, 颜色, alpha)`**。

## 参考图与会话像素管线（浏览器侧）

- **透明通道**：带 Alpha 的格式在透明画布上绘制，优先 **WebP/PNG** 进入会话；避免「铺白底再转 JPEG」毁掉透明导致游戏里白框/粉块。
- **贴片规范化**：识别怪/敌/主角/塔等用途时在方格内 **contain**（常量 **`REFERENCE_SPRITE_CELL_PX`**，见 `reference-image-payloads.client.ts`）。
- **模型提示**：视觉参考链路要求落地建议（透明底、方格贴片等），输出上限拉长（见 `vision-reference` 相关实现）。
- **产品边界**：不做服务端 AI 抠复杂背景；实拍 JPEG 不会自动变透明底。

## 生成与编排性能

- **联网增强**：`tryWebEnhance` 中对多条搜索结果 URL 使用 **`Promise.all`** **并行抓取**正文（原串行 `for`）。
- **Rich 编排**：当存在 **`RunTraceRecorder`** 且 **`ORCHESTRATION_QUALITY_TIER=rich`** 时，**Comfy 探活**与 **`generateGameSpecDraftWithMeta`（检索 + 初稿 LLM）** **`Promise.all` 并行**，减少无谓等待。
- **规格提示**：系统提示中强调 **theme 六色为全作母色**，并可附加 **`presentation.musicProfile`**（见 `generate-spec.ts`）。

## Phaser / 塔防稳健性（节选）

- 场景 bootstrap / shutdown：**纹理就绪后再 resume**；卸载后 **`tdDisposed`** 等标记避免异步回调写已销毁场景。
- 敌军纹理：**仅当纹理可用才绑定用户 key**，否则回退内置贴片。
- 防御塔占位：**程序生成兜底纹理**，降低「整块荧光占位」误判。

## 工程修复

- **`createPhaserGame.ts`**：曾因 **`return game` 后缺少函数闭合 `}`** 导致 Turbopack 解析失败（`Expected '}', got '<eof>'`）；需保证文件末尾函数括号完整。

## 路线图文档（仓库根）

- **`ai_game_generation_platform_architecture_cn.md`**：Astrocade 类「AI 游戏工业化平台」愿景——多 Agent、资产协议、DSL Runtime、QA 闭环等。**当前本仓库**仍为「一句话 → GameSpec → Phaser」的轻量落地；该文档用于对齐中长期架构，不要求与现状逐条等价。

## 相关源码索引

| 主题 | 路径 |
|------|------|
| 一致性推导 | `src/lib/cohesive-presentation.ts` |
| 规格字段 | `src/lib/game-spec.ts`、`src/lib/normalize-spec.ts`、`src/lib/generate-spec.ts` |
| 环境音 | `src/game/audio/gameSoundscape.ts`、`src/game/audio/audio-context.ts`、`src/game/audio/webBleeps.ts` |
| 引擎入口 | `src/game/engine/createPhaserGame.ts` |
| 场景 HUD | `src/game/engine/PlayScene.ts`、`PlatformerScene.ts`、`TowerDefenseScene.ts`、`HudBanner.ts` |
| 试玩外壳 | `src/components/GamePlayerInner.tsx` |
| 快速调试 | `src/components/SpecQuickTunePanel.tsx` |
| 参考图 | `src/lib/assets/reference-image-payloads.client.ts` |
| 编排说明 | `docs/architecture-orchestration.md` |
