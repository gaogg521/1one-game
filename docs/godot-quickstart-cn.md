# Godot 速成与 AI 工厂接入指南

> **用途**：团队与 AI 协作者快速掌握 Godot，并把本仓库的 **GameSpec** 路线延伸到可版本化、可多 Agent 协作的 **Godot 工程**。  
> **官方文档**：[Godot Docs 4.6（stable）](https://docs.godotengine.org/en/stable/)  
> **官方 Demo**：[godot-demo-projects](https://github.com/godotengine/godot-demo-projects)（浏览器试玩：[GitHub Pages](https://godotengine.github.io/godot-demo-projects/)）

本文按 **步骤 1～9** 组织（不按真实天数拆分）；每步都可由人或 AI 连续完成。

---

## 产品定位：为什么必须「深度做好 Godot」

我们与 Godot 官方能力对齐的长期判断：

| 维度 | Phaser（浏览器即时轨） | Godot（专业轨） |
|------|------------------------|-----------------|
| 目标 | **秒开试玩**、迭代快、零安装 | **浏览器在线试玩**（Web wasm）+ 可选下载 PC/APK/工程 |
| 编辑器 | 无（纯代码场景） | **有** — 母版 `ai-mother-universal` 可打开改场景/脚本 |
| 跨平台 | Web only | Web 已接；桌面/移动导出为 **同一母版** 延伸 |
| 2D / 3D | 2D | 当前产线 **2D 六模板**；3D 走 **新母版 + GameSpec 扩展**（非替换 Phaser） |

**双轨不是二选一**：用户 **先在浏览器里玩 Godot 在线版**，觉得好玩再展开导出 Windows / 工程 / APK；Phaser 负责秒开预览。平台在生成、预取（仅 Web 在线包）、参考图、导演事件、手感上 **共用 GameSpec**。

**工程承诺（与本文步骤对应）**：

1. **可重复导出**：本机 `godot:install` + `qa:godot-export`；CI `godot-export` job 跑 **六模板矩阵**（`qa:godot-export:matrix`）。
2. **全入口预取**：创作台 / 试玩 / 样品馆 / 发现 / 工作室 / `GameRuntimeTabs` 后台 `prefetchGodotExport`。
3. **可协作**：步骤 9 多 Agent 文件所有权；母版场景树稳定，数值与主题走 bridge / `.tres`。
4. **可演进**：步骤 3 官方 demo 库 + 步骤 8 映射表；未来 3D 模板 = 新 `templateId` + 新 runtime，不推翻现有 JSON 协议。

---

## 步骤 1：安装 Godot

### 本仓库一键安装（推荐，已在本机验证）

```bash
npm run godot:install      # 下载 4.4.1 便携版 → tools/godot/
npm run godot:import       # 导入母版工程
npm run godot:run          # 打开编辑器并运行母版（GUI）
npm run godot:export:mother  # 导出 Web → public/godot-builds/mother-platformer/
```

引擎二进制：

| 平台 | 路径 / 命令 |
|------|-------------|
| Windows | `tools/godot/Godot_v4.4.1-stable_win64_console.exe`（headless）；GUI 版同目录 |
| Linux / CI | `npm run godot:install:ci` → `tools/godot/Godot_v4.4.1-stable_linux.x86_64` |
| 覆盖 | 环境变量 `GODOT_BIN` |

导出模板：Windows 见 `godot:export:mother`；Linux/CI 见 `godot:install:templates:linux`（安装到 `~/.local/share/godot/export_templates/4.4.1.stable/`）。

| 项 | 说明 |
|----|------|
| 手动下载 | [godotengine.org/download](https://godotengine.org/download) → **Standard** |
| winget | `winget install GodotEngine.GodotEngine`（本机若已装 4.6.2 亦可，但母版按 4.4.1 工具链对齐） |
| 文档 | [Godot Docs 4.6 stable](https://docs.godotengine.org/en/stable/) |

验证：`npm run godot:import` 无报错；或项目管理器 Scan `godot-templates/ai-mother-platformer` 后 **F5**。

---

## 步骤 2：四个核心概念（2D 优先）

| 概念 | 一句话 | AI 协作含义 |
|------|--------|-------------|
| **Node** | 功能最小单元（碰撞、精灵、脚本） | Agent 的修改粒度 |
| **Scene** | 节点树，存为 `.tscn`，可实例化 | 分文件、可 diff、可 patch |
| **Script** | 挂在节点上的 `.gd`（GDScript） | LLM 最常生成/修补 |
| **Signal** | 事件，松耦合连接 | 模块间不写死引用 |

**最小动手**（建议跟官方 [Step by step](https://docs.godotengine.org/en/stable/getting_started/step_by_step/index.html) 前两课）：

1. 新建 2D 项目 → 添加 `CharacterBody2D` → 挂脚本，`_physics_process` 里 `move_and_slide()`。
2. **另存场景** `player.tscn`，在主场景 **实例化（Instance Child Scene）**。
3. 理解：**场景 = 预制件**，主场景只组装实例。

---

## 步骤 3：用官方 Demo 当模板库

### 3.1 导入 demo

1. Clone 或下载 ZIP：[godot-demo-projects](https://github.com/godotengine/godot-demo-projects)。
2. Godot 项目管理器 → **Scan（扫描）** → 选 demo 根目录。
3. 双击打开项目 → **F5** 运行。

> **版本**：仓库 `master` 对应当前 4.x 开发线；若打不开，用 [Releases](https://github.com/godotengine/godot-demo-projects/releases) 里与编辑器匹配的标签。

### 3.2 与本平台相关的 demo 优先级

| 路径（在仓库内） | 学什么 | 对应 `GameSpec.templateId` |
|------------------|--------|------------------------------|
| `2d/kinematic_character` 或平台类 demo | `CharacterBody2D`、碰撞 | `platformer` |
| `2d/dodge_the_creeps` 类完整小循环 | 刷怪、计分、UI、结束 | `avoider` / `collector` |
| `gui/` 下控件 demo | Label、Button、血条 | 全局 HUD / 塔防 UI |
| `loading/` | 场景切换、异步加载 | 多场景关卡（后期） |

**学习方法（每个 demo 15～30 分钟）**：

1. F5 玩一遍 → Scene 面板看节点树。
2. 点开带脚本的节点，读 `.gd`（通常短）。
3. FileSystem 看 `.tscn` / `.tres` 如何组织。

---

## 步骤 4：练习「文本化工程」

本仓库已提供 **AI 母版项目**（见步骤 7）：

```text
godot-templates/ai-mother-universal/
  project.godot
  scenes/main.tscn
  scripts/runtime_router.gd
  scripts/runtimes/*.gd
  spec/gamespec.json          # 导出时写入
  spec/references.json        # 参考图清单（可选）
```

**练习清单**（母版已具备六模板运行时，可按需扩展）：

- [x] 改 `platformer` 场景内 `gameplay` 相关逻辑或 Spec 数值，F5 / 导出验证。
- [x] 用 VS Code 改 `.gd` 后 Godot 自动重载。
- [x] `git diff` 小改动 + `npm run qa:godot-export` 冒烟。
- [ ] 自行 clone 官方 demo 对照学习（步骤 3，非阻塞产品路径）。

原则：**能文本化的就不只活在检查器里**；命名稳定（`Player`、`HUD`、`Combat`）便于多 Agent 分工。

---

## 步骤 5：一周小目标 → 本仓库「最小可玩」清单

不必做大作，完成下列即算「用起来」：

| 项 | 母版中状态 | 你要做的扩展 |
|----|------------|--------------|
| 主场景 `Main` | `runtime_router` + 六模板 | 已实现 |
| 平台/塔防等 | `*_runtime.gd` | 程序化美术 + 导演 |
| 输入移动 | 各模板内实现 | 读 `GameSpecData` |
| UI | `main.tscn` HUD | 标题/分数/横幅 |
| Web 导出 | `POST /api/godot/export` | `npm run qa:godot-export` |

### 5.1 Web 导出（创作台 iframe 试玩的前置）

1. Editor → **Export** → **Add…** → **Web**。
2. 若提示下载模板，按向导安装 Export Templates。
3. Export Project → 得到 `index.html` + `.pck` / `.wasm`。
4. 用本地静态服务器或托管到 `public/godot-builds/<id>/`（产品接入时再做）。

**Headless（后续 CI）**：

```bash
godot --headless --path godot-templates/ai-mother-platformer --export-release "Web" ./dist/web
```

详见 [Exporting tutorials](https://docs.godotengine.org/en/stable/tutorials/export/index.html)。

---

## 步骤 6：GDScript 速成（LLM 友好子集）

```gdscript
extends CharacterBody2D

@export var speed: float = 280.0
@export var jump_velocity: float = -420.0

var gravity: float = ProjectSettings.get_setting("physics/2d/default_gravity")

func _physics_process(delta: float) -> void:
	if not is_on_floor():
		velocity.y += gravity * delta
	if Input.is_action_just_pressed("ui_accept") and is_on_floor():
		velocity.y = jump_velocity
	var direction := Input.get_axis("ui_left", "ui_right")
	velocity.x = direction * speed
	move_and_slide()
```

| 语法 | 用途 |
|------|------|
| `extends` | 脚本挂在哪种节点上 |
| `@export` | 检查器可调 → **AI 只改数值不改逻辑** |
| `_ready` / `_process` / `_physics_process` | 生命周期 |
| `signal` + `connect` | 模块通信 |

延伸阅读：[GDScript 文档](https://docs.godotengine.org/en/stable/tutorials/scripting/gdscript/index.html)。

---

## 步骤 7：本仓库 AI 母版项目（专业全品类）

路径：**[`godot-templates/ai-mother-universal/`](../godot-templates/ai-mother-universal/)**

```text
scripts/
  autoload/game_spec_data.gd    # 读取 spec/gamespec.json（导出时写入）
  runtime_router.gd             # 按 templateId 挂载运行时
  runtimes/
    platformer_runtime.gd       # 横版关卡 + 收集 + 尖刺
    arena_runtime.gd            # avoider / collector / survivor
    shooter_runtime.gd          # 弹幕射击 + 波次
    tower_defense_runtime.gd    # 路径/塔位/波次/建塔/弹道/基地 + 导演
    td_map_draw.gd              # 石板路 + 草地/萝卜基地
    range_preview_layer.gd      # 建塔射程预览
  shared/
    path_math.gd                # 敌军路径插值
    procedural_units.gd         # 卡通塔/敌/槽位程序化绘制
    unit_visual.gd              # Node2D _draw 包装
    game_director.gd            # 导演全事件类型
    game_hud.gd                 # 统一 HUD + 横幅
    game_juice.gd               # 震屏/闪屏/爆散
    runtime_reference_registry.gd  # 参考图 → 塔/怪/基地
    runtime_reference_backdrop.gd
```

| templateId | 运行时 |
|------------|--------|
| `platformer` | 滚动平台关卡 |
| `avoider` / `collector` / `survivor` | 竞技场 + 技能/导演强度 |
| `shooter` | 俯视角射击 |
| `towerDefense` | 完整塔防（读 `towerDefense` 蓝图） |

### 7.1 塔防程序化美术（保卫萝卜向）

- **塔**：`dart`（速射）、`splash`（溅射）、`frost`（减速）— `procedural_units.gd` 用 `_draw` 画卡通炮塔，无需外部贴图。
- **敌人**：`grunt` / `runner` / `tank`，带护甲、减速状态色。
- **地图**：`td_map_draw.gd` 草地花纹 + 立体路；标题/标签含「萝卜」时显示萝卜基地主题。
- **交互**：左键建塔、数字键 1–3 选塔型、右键升级、悬停显示射程圈。

### 7.2 导演事件 `director.events`

导出前 `prepareSpecForGodotExport`（`src/lib/godot-export-spec.ts`）会调用 `buildDirector`，自动补全与 Phaser 同源的事件表。Godot 侧 `GameDirector` 支持：

| `type` | 塔防 | 竞技场 | 射击 |
|--------|------|--------|------|
| `coinRain` | 额外金币 tick | 收集模式加分 | — |
| `miniBoss` | 刷精英怪 | 大型威胁 ×3 | 高 HP 敌舰 |
| `goalShift` | 守点横幅 | 限时收集目标 | — |
| `timeSlow` | — | 威胁减速 | 刷怪加速缓解 |
| `finalBarrage` | 终局弹幕 | avoider 高压 | — |
| `goldenPickup` | — | collector 黄金物 | — |
| `breathingRoom` | — | survivor 低压段 | — |

本地验证：`npm run qa:godot-export -- "保卫萝卜塔防，多种炮塔和精英波"`

### 7.3 双轨品质对齐（Phaser + Godot）

| 能力 | Phaser | Godot |
|------|--------|-------|
| 规格补全 | `enrichGameSpecForRuntime` | 同函数（`prepareSpecForGodotExport`） |
| 导演事件 | `HudBanner` + 场景 tick | `GameDirector`（含上表扩展类型） |
| 手感反馈 | `gameJuice.ts`（Play/Platformer/Shooter 等） | `game_juice.gd` |
| 试听 | `GameSoundscape` | `GameAudio` + `GameBleeps` |
| 参考图 | session 多用途贴图 | `spec/refs/` + 背景/塔/怪/基地（`RuntimeReferenceRegistry`） |
| 预导出 | — | 创作台/试玩/工作室 `prefetchGodotExport` + 生成后 `scheduleGodotPrefetch` |
| E2E | Playwright 场景试玩 | `e2e/godot-runtime.smoke.spec.ts`（切换 Godot 标签） |
| 编排 trace | — | `godot_web_prefetch` 步（`generate-spec` 完成时） |

**原则**：同一 `GameSpec` 先 enrich，再分别进 Phaser 秒开或 Godot 导出。

本地双轨冒烟：

```bash
npm run qa:godot-export -- "保卫萝卜塔防"
# 创作台：同 prompt 切换 Phaser | Godot；生成后看编排 JSON 含 godot_web_prefetch
```

设计目标：

- 节点树清晰，对应「Player → 子节点」协作模型。
- `game_spec_bridge.gd` 用 `@export` 暴露与 **GameSpec** 同名的主题/玩法字段（手写填入或后续 codegen）。
- 与 Phaser 路线 **并行**：Phaser = 浏览器秒开；Godot = 可导出的工程真相。

**打开方式**：`npm run godot:run` 或项目管理器 Scan → `godot-templates/ai-mother-universal/` → F5。

---

## 步骤 8：GameSpec ↔ Godot 映射表

当前平台 **单一真相** 仍是 JSON **GameSpec**（`src/lib/game-spec.ts`）。Godot 层建议是 **下游落地**，不要一开始就让 LLM 手写全套 `.tscn`。

### 8.1 模板级映射

| `GameSpec.templateId` | Godot 母版 / demo 参考 | 主要场景文件（建议） |
|-----------------------|------------------------|----------------------|
| `platformer` | `ai-mother-platformer` | `scenes/main.tscn`, `player.tscn` |
| `avoider` | dodge 类 2d demo | `scenes/play.tscn` |
| `collector` | 同上 + 收集物节点 | `scenes/collectibles.tscn` |
| `survivor` | 生存刷怪 demo | `scenes/spawner.tscn` |
| `towerDefense` | gui + 自定义网格 | `scenes/td_map.tscn`, `td_ui.tscn` |
| `shooter` | 俯视角射击 demo | `scenes/shooter.tscn` |

### 8.2 字段级映射（平台跳跃母版）

| GameSpec 字段 | Godot 落点 | 说明 |
|---------------|------------|------|
| `title` | 窗口标题 / HUD Label | `ProjectSettings` 或 UI |
| `theme.backgroundColor` | `CanvasModulate` 或 Camera2D 背景色 | 母版 `Main` 可挂 `game_spec_bridge` |
| `theme.playerColor` | `Player/Visual` 的 modulate | 色块或 Sprite modulate |
| `theme.hazardColor` | 敌人/陷阱节点 | |
| `gameplay.playerSpeed` | `@export var speed` | `player.gd` |
| `gameplay.jumpStrength` | `@export var jump_velocity` | 取负值为向上 |
| `gameplay.gravity` | `@export var gravity_scale` 或覆盖重力 | |
| `gameplay.winScore` | `GameState` 单例或 `main.gd` | |
| `labels.*` | `Label` 文本 | |
| `director` | `Director.gd` 读 acts/events | 对标 Phaser `HudBanner` |
| `towerDefense.*` | 专用 `TdBlueprint.gd` | 对标 `td-blueprint.ts` |

### 8.3 目标流水线（与 Phaser 双轨）

```text
用户 Prompt
  → LLM：GameSpec JSON（现有 /api/generate）
  → [新] godot-codegen：GameSpec → 补丁母版工程（.tscn / .gd / .tres）
  → godot --headless --export-release Web
  → 创作台 iframe 或「下载 Godot 工程」
```

**第一阶段 codegen 范围（建议）**：只改 `@export` 与 `Label.text`、主题色，不改场景树结构 → 稳定、可 lint。

---

## 步骤 9：多 Agent 分工契约

与 [`ai-handoff-architecture-cn.md`](ai-handoff-architecture-cn.md) 中「愿景 vs 现状」对齐：在 Godot 落地前先约定 **文件所有权**，避免并行改同一 `.tscn` 冲突。

| Agent | 拥有路径（示例） | 禁止 |
|-------|------------------|------|
| **Map** | `scenes/main.tscn`（地形/实例放置） | 改 `player.gd` 输入逻辑 |
| **Combat** | `scenes/enemies/*`, `scripts/combat/*` | 改 UI 场景 |
| **UI** | `scenes/hud.tscn`, `scripts/ui/*` | 改碰撞层 |
| **NPC** | `scenes/npcs/*` | 改 `project.godot` |
| **Integrator** | 合并、跑 Export、修冲突 | — |

**合并规则**：

1. 每个 Agent 输出 **unified diff** 或 **单文件全文**，禁止一次改整个工程 zip。
2. 场景树变更由 **Integrator** 统一做 Instance 挂载。
3. 数值类优先写 **`spec_overlay.tres`** 或 `game_spec_bridge.gd` 的 export，减少动 `.tscn` 结构。

---

## 常见坑

| 问题 | 处理 |
|------|------|
| Demo 版本不匹配 | 换 [Releases](https://github.com/godotengine/godot-demo-projects/releases) 或升级编辑器 |
| Web 包体大、首屏慢 | 保留 Phaser 作「秒开预览」，Godot Web 作「完整版」 |
| `.tscn` merge 冲突 | 结构变更串行；数值走 `.tres` / `@export` |
| 让 LLM 直接写复杂 `.tscn` | 先用 GameSpec → codegen，母版场景树固定 |

---

## 与本仓库文档的关系

| 文档 | 关系 |
|------|------|
| [`ai-handoff-architecture-cn.md`](ai-handoff-architecture-cn.md) | 当前 Phaser + GameSpec 运行时真相 |
| **本文** | Godot 学习路径 + 母版 + Spec 映射 + Agent 契约 |
| [`architecture-orchestration.md`](architecture-orchestration.md) | 生成编排；未来可加 `godot_export` trace 阶段 |
| [`../ai_game_generation_platform_architecture_cn.md`](../ai_game_generation_platform_architecture_cn.md) | 中长期多 Agent 愿景 |

---

## 下一步（产品 / 工程）

1. ~~**验证母版**~~：`godot:import`、headless、`godot:export:mother`。
2. ~~**PoC codegen + API**~~：`POST /api/godot/export` 按 GameSpec patch bridge 并导出 Web。
3. ~~**创作台 / 试玩**~~：`GameRuntimeTabs` + **六模板** Godot 运行时。
4. ~~**编排 trace + 全入口预取**~~：`scheduleGodotPrefetch`、`prefetchGodotExport`、样品馆/发现/工作室。
5. ~~**CI 真导出**~~：`godot-export` job + `qa:godot-export:matrix` + E2E Godot 标签（需引擎与模板缓存）。
6. **进行中 / 后续**：编辑器内一键「在 Godot 中打开母版副本」；桌面/Android 导出 preset；3D 母版与 `GameSpec` 扩展字段；下载 `.pck` / 工程 zip 给高级用户。

### API

```http
POST /api/godot/export
Content-Type: application/json

{ "spec": { ...GameSpec }, "projectId": "可选", "referencePayloads": [ { "ordinal": 0, "purpose": "背景", "dataUrl": "data:image/png;base64,..." } ] }
```

响应：`{ "buildUrl": "/godot-builds/<id>/index.html", "cached": true|false }`

本地冒烟：`npm run qa:godot-export`

### PC / 移动端导出（已实现）

| 目标 | API `target` | 本机命令 | 说明 |
|------|----------------|----------|------|
| 浏览器试玩 | `web`（默认） | `npm run qa:godot-export` | `public/godot-builds/<id>/` |
| **Windows PC** | `windows` | `npm run godot:export:desktop -- "你的 prompt"` | **仅 Windows** headless 打 exe zip |
| **Godot 工程** | `project` | `npm run godot:export:project` | 任意 OS，zip 后用 `npm run godot:run` 打开改 |
| **Android APK** | `android` | 试玩页点「Android APK」 | 需 Android SDK；未装则下工程在编辑器导出 |

试玩页 **Godot 导出** 区有三个按钮（Windows / 工程 / Android）。产物 URL：`/godot-artifacts/<exportId>/*.zip`。

**Android 后续**：母版已含 `Android` preset（`arm64-v8a`，minSdk 24）；等平台接 SDK 流水线后可 headless 出 APK zip。

---

*维护：母版或映射变更时同步更新本文 §7～§8。*
