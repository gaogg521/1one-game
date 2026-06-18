## 2026-06-18 — 迭代一百零四 · Staging Bench + Comfy 精灵 + BGM ✅

Completed:

- `browser-bench-env.ts`：staging 默认 `OPENGAME_BROWSER_BENCH=1` + repair。
- `comfy-game-sprite-gen.ts`：Comfy 256 → sharp 512；staging/`GAME_SPRITE_COMFY=1`。
- `seed:game-bgm-slots`：5 款模板 loop；部署 `OPERONE_STAGING=1` 文档 + install.sh 钩子。
- `qa:opengame-staging-env` · `qa:comfy-game-sprite` · `qa:opengame-cli-live` · build ✅。

---

## 2026-06-18 — 迭代一百零三 · Phase D 视听 + 三阶段缺口 ✅

Completed:

- Phase D：`game-asset-pipeline` Brief 对齐背景/精灵/封面；并行文生图；创作台等 core 3 精灵。
- BGM：`game-bgm-presets` + `GameSoundscape` 模板 loop 槽与 BPM 微调。
- Phase A：E2E `platform-complex-agentic.smoke`。
- Phase C：`qa:sample-behavior-signoff`。
- QA：brief-asset-cohesion ✅ · build ✅。

---

## 2026-06-18 — 迭代一百零二 · 平台测试生成闭环 ✅

Completed:

- `qa-platform-test-generate.ts`：模拟用户 generate → persist → 试玩链接（owner=`platform-test-user`）。
- 修复 `coerceGameSpec` 丢弃 `agenticModule`/`agenticPlayRoute` 导致复杂 prompt 入库后变 dedicated。
- `qa:agentic-persist-coerce` + `qa:platform-test-generate` **全绿**（简单 PhysicsScene + 复杂 AgenticScene）。

---

## 2026-06-17 — 迭代一百零一 · Phaser.Scene bridge + P0 polish ✅

Completed:

- `wrapPhaserSceneAsCreateGame` + phaser-scene fixture；cli-bridge **3/3** ✅。
- 消消乐关间 ⭐ 飞入；神庙死亡 3s 倒计时 + `templeDeathCountdown` QA 状态。
- `qa:temple-death-flow` ✅ · build ✅。

---

## 2026-06-17 — 迭代一百 · CLI→Agentic bridge ✅

Completed:

- `opengame-cli-bridge.ts`：workDir JS 合并 + createGame 桥接 + forbidden 校验。
- `OPENGAME_CLI_BRIDGE=1` 接入 `generateAgenticGameModule`（Debug Skill + 可选 Browser Bench）。
- Fixtures + `qa:opengame-cli-bridge` ✅；orch `opengame_cli_bridge` trace。
- QA + build ✅。

---

## 2026-06-17 — 迭代九十九 · Phase C 全量 hook + Phase B CLI spike ✅

Completed:

- Phase C：4 款棋类 Scene hook；**14/14** 样品 hook 试点全覆盖。
- Phase B：`opengame-cli.ts` + `qa:opengame-cli-spike`；复杂 prompt orch `opengame_cli_spike`。
- `.env.example` OPENGAME_CLI_* 文档；astrocade-pipeline 接入 cli-spike QA。
- QA + build ✅。

---

## 2026-06-17 — 迭代九十八 · Phase C 扩展 + dedicated Debug lint ✅

Completed:

- `generation-trace.ts`：OpenGame recap（tier / playRoute / browser bench）；i18n 5 语言。
- `template-sample-parity.ts` + `qa:sample-template-skill-parity` **14/14**；10 款 Scene hook 试点。
- `lintDedicatedRouteDebugSkill` + orch `opengame_dedicated_debug_lint`（Phase A dedicated 门禁）。
- 修复 build：`tMessage` 参数类型；`TemplateArchetypeId` 从 types 导入；barrel 不再 re-export fs 模块。
- QA + build ✅。

---

## 2026-06-17 — 迭代九十七 · refine 路由重算 + 创作台试玩引擎提示 ✅

Completed:

- `respectPersisted`：生成/refine 重算路由；patch 复杂迭代可升级 agentic。
- `stripAgenticModuleForDedicatedRoute`；attach 对齐。
- SSE recap + refine API `agenticPlayRoute`；QA + build ✅。

---

## 2026-06-17 — 迭代九十六 · OpenGame 试玩路由接入用户管线 ✅

Completed:

- `play-route.ts`：`resolveAgenticPlayRoute` / `agenticPlayRoute` 持久化；复杂 prompt 走 Agentic+Skills。
- `attachAgenticModuleIfEnabled` + `normalizeAstrocadePlaySpec` 对齐；简单 prompt 仍 dedicated Scene。
- `browser-bench-generate.ts`：可选 `OPENGAME_BROWSER_BENCH=1` 生成后真浏览器验证。
- QA + build ✅。

---

## 2026-06-17 — 迭代九十五 · OpenGame Browser Bench 闭环 ✅

Completed:

- 修复 `decodeAgenticBenchPayload`：client 侧 base64url 解码（不再依赖 Node `Buffer`）。
- 修复 `AgenticBenchClient`：`sceneKey` 改在 boot 后用 `getScenes(true)` 探测，消除误报 `MODULE_LOAD_FAILED`。
- `AgenticBenchShell` 无效 payload 增加 `data-testid="agentic-bench-error"`。
- `qa:opengame-browser-bench` **2/2**；`qa:opengame-skills` + `qa:agentic-template-matrix` **16/16** ✅。
- `qa:astrocade-pipeline` 接入 browser bench（dev server @8888）。

---

## 2026-06-17 — 迭代六十五 · 神庙 near-miss + 连击 + 视差 ✅

Completed:

- 神庙擦边 near-miss、金币 streak 连击与 bonus 分。
- 藤蔓视差、萤火虫、车道柔光。
- build + QA + 封面 + seed ✅。

---

## 2026-06-17 — 迭代六十四 · 目标引导 + 神庙 v5 ✅

Completed:

- `scene-goal-guidance.ts`：`racing/coaster` 模板（神庙 endless / 轨道竞速）。
- `CoasterScene`：`HudGoalPanel`、统一 banner/bottomHint。
- `temple-run-visual.ts`：车道虚线、金币 spin、猿猴追兵。
- QA 扩展 CoasterScene；build + 神庙 QA ✅。

---

## 2026-06-17 — 迭代六十三 · 样品馆 UX + 神庙 v4 + 封面刷新 ✅

Completed:

- `samples.ts`：6 款展示样品 `photoCover: true`。
- `temple-run-visual.ts`：SideRuins / SunVignette / DustPuffs；跑者 v4 纹理。
- `CoasterScene`：尘土/夕阳/弯道 lean；金币串生成。
- `capture:sample-covers`：棋盘/2048 预热；6 款 PNG 重截。
- 验证：23/23 互动 QA · board QA · build ✅。

---

## 2026-06-17 — 迭代六十二 · seed + 封面 + 神庙 polish ✅

Completed:

- `CoasterScene`：`scorePopT` / `camPulseT`；弯道 `roadCurvePhase` 加速；得分与金币 HUD 脉冲。
- `temple-run-visual.ts`：弯道振幅略增。
- 新增 `scripts/capture-sample-covers.ts` + `npm run capture:sample-covers`。
- 重生成 `public/samples/temple-relic-runner.png`。
- `seed:samples` 23 projects · `qa:sample-gallery-db-sync` 23/23 · build ✅ · 神庙 QA ✅。

---

## 2026-06-17 — 迭代六十一 · QA 闭环 + 神庙 v3 视觉 ✅

Completed:

- `PuzzleScene`：`color-bloom` flood 消除补 `addMove()`；中心 4 连块；去掉重复 `const h`。
- `TowerDefenseScene`：gun-merge 合成加 `juiceShake`/`juiceFlash`；成功 merge 额外 `bumpQaTouch`。
- `temple-run-visual.ts`：`drawTempleWaterMoat`、`drawTempleScorePanel`。
- `CoasterScene`：分数面板接入 `templeRunScore`。
- 验证：`qa:sample-gameplay-interaction` **23/23** ✅、`qa:board-showcase-samples` ✅、`npm run build` ✅。

---

## 2026-06-17 — 迭代六十 · 神庙重做 + 统一 WASD/鼠标 ✅

Completed:

- 神庙 v2→可玩：`temple-run-visual.ts` 透视跑道、8 帧跑者、障碍/金币/chaser；CoasterScene 无敌窗/单障碍/1 命重开/无尽。
- 统一输入：`phaser-input.ts` + 各 Scene WASD/鼠标；五语系 HUD 文案。
- 验证：build ✅、神庙 QA ✅。

---

## 2026-06-17 — 迭代五十九 · 神庙逃亡 v2 机制 ✅

Completed:

- `CoasterScene` 神庙模式 v2（仅 `templeRunMode`）：
  - 金币拾取 `roadPickups` / `drawTempleCoin` / `coasterCoins` QA 状态。
  - 跳跃（↑/W/Space）与滑铲（↓/S）；三种障碍 `rock`/`pillar`/`beam` 对应换道/跳/滑。
  - 弯道透视 `laneCenterX` + `roadCurvePhase`；跑者 `runAnimPhase` 摆腿与跳/滑姿态。
  - HUD `hudTempleRunControls` / `hudTempleRunScore`；五语系 i18n。
  - 结算金币 bonus ×50、神庙专属 banner。
- QA：`qa:board-showcase-samples` 增加 v2 contract；temple 互动 QA 仍用 `coasterDistance`。
- 验证：`qa:board-showcase-samples` ✅、`temple-relic-runner` interaction ✅、`npm run build` ✅。

---

## 2026-06-17 — 迭代五十八 · 六款小游戏真实试玩 + 神庙逃亡样品 ✅

Completed:

- 复核用户要求的 5 款小游戏是否达到“人类能玩”：
  - 自动化：5 款聚焦 `qa:sample-gameplay-interaction` 全绿。
  - 肉眼截图：2048/围棋/斗兽棋达到可试玩底线。
  - 修复中国象棋：从普通棋盘格改成真实线盘、楚河汉界、宫格斜线、红黑圆棋子。
  - 修复国际象棋：从 6 子 demo 改为 32 子完整初始盘，补 Q/R/B/N/K/P 基础走法。
- 新增类似“神庙逃亡”的样品：
  - `temple-relic-runner`，路由为 `racing` / `CoasterScene` / `endlessRoad`。
  - 三线石板跑酷、左右换道、滚石/石柱障碍、丛林遗迹背景、距离得分。
  - 生成 `public/samples/temple-relic-runner.png`。
- 扩展 QA：
  - `qa:board-showcase-samples` 增加中国象棋线盘、国际象棋完整后排、神庙 runner runtime/profile/cover 断言。
  - `sample-gameplay-interaction` / `gameplay-depth` / `competitor-clone-playability-checks` 加入 `temple-relic-runner`。

Changed Files:

- `src/game/engine/ChessScene.ts`
- `src/game/engine/CoasterScene.ts`
- `src/lib/samples.ts`
- `src/lib/sample-play-profiles/registry.ts`
- `src/lib/coaster-blueprint.ts`
- `src/lib/game-templates/definitions.ts`
- `src/lib/qa/sample-gameplay-interaction.ts`
- `src/lib/qa/gameplay-depth.ts`
- `src/lib/qa/competitor-clone-playability-checks.ts`
- `scripts/qa-board-showcase-samples.ts`
- `public/samples/temple-relic-runner.png`
- `PROJECT_MEMORY/*`

Test Results:

- `npm run qa:board-showcase-samples`：**通过**
- `npm run seed:samples`：**通过**（23 projects）
- `npm run qa:sample-gallery-db-sync`：**通过**（23/23）
- `SAMPLE_AUDIT_IDS=temple-relic-runner npm run qa:sample-gameplay-interaction`：**通过**（1/1，首轮 retry 后 OK）
- `SAMPLE_AUDIT_IDS=number-merge-2048,classic-xiangqi-board,classic-international-chess,zen-go-board,jungle-animal-chess,temple-relic-runner npm run qa:sample-gameplay-interaction`：**通过**（6/6）
- Playwright canvas 截图：神庙 runner `coasterDistance` 7 → 14，`coasterLives=3`
- `npm run build`：**通过**
- Edited-file lints：无错误

Quality Notes:

- 6 款均达到“可打开、能看懂规则、可操作且状态变化可观测”的试玩底线。
- `temple-relic-runner` 当前是可玩原型，不是商业级 Temple Run；商业级下一步应补金币拾取、跳跃/滑铲、连续弯道、角色动画帧、失败重开节奏和更强 3D 透视。

Next:

- 部署后生产执行 `npm run seed:samples`，确认 `/games` / `/samples` 生产 DB 也有 23 个样品。
- 若继续提升跑酷质量，优先做金币拾取 + 跳跃/滑铲 + 道路弯道。

---

## 2026-06-17 — 迭代五十七 · 五款棋盘/益智样品可见 + 封面/围棋/抖动修复 ✅

Completed:

- 根据用户截图反馈闭环修复：
  - 最新发布只看到 3 款：新增 `classic-xiangqi-board`、`classic-international-chess`，seed 后 DB 最新 5 款为 International Chess / Chinese Xiangqi / Jungle Animal Chess / Zen Go Board / 2048 Neon Merge。
  - 游戏封面缺失/破图：五款棋盘/益智样品改用 PNG 封面并生成 `public/samples/*.png`。
  - 围棋棋子太小：`ChessScene` 增加 `drawGoStone()`，Go 棋子使用图形圆盘、高光、阴影，半径 `cell * 0.43`。
  - 2048 背景抖动：`PuzzleScene.move2048()` 从 `juiceCombo()` 改为局部 `juiceBurst()`，避免每步 camera shake。
- 修复国际象棋中文 prompt 推断：`inferChessRuleset()` 优先识别 `国际象棋` / `international chess` 为 `international`，避免被其它棋类关键词误判。
- 扩展防回退 QA：
  - `qa:board-showcase-samples` 覆盖 5 个样品、PNG 封面文件存在、Xiangqi/International ruleset、Go 大棋子、2048 不使用整屏抖动。
  - sample gameplay / clone playability / depth 期望增加中国象棋和国际象棋。

Changed Files:

- `src/lib/samples.ts`
- `src/lib/chess-blueprint.ts`
- `src/lib/sample-play-profiles/registry.ts`
- `src/game/engine/ChessScene.ts`
- `src/game/engine/PuzzleScene.ts`
- `src/lib/qa/sample-gameplay-interaction.ts`
- `src/lib/qa/gameplay-depth.ts`
- `src/lib/qa/competitor-clone-playability-checks.ts`
- `scripts/qa-board-showcase-samples.ts`
- `public/samples/number-merge-2048.png`
- `public/samples/classic-xiangqi-board.png`
- `public/samples/classic-international-chess.png`
- `public/samples/zen-go-board.png`
- `public/samples/jungle-animal-chess.png`
- `PROJECT_MEMORY/*`

Test Results:

- `npm run qa:board-showcase-samples`：**通过**
- `npm run qa:sample-gallery-db-sync`：**通过**（22/22）
- `npm run seed:samples`：**通过**（22 projects）
- DB 最新样品查询：**通过**（前 5：International Chess / Chinese Xiangqi / Jungle / Go / 2048，coverPath 均为 PNG）
- `npm run build`：**通过**
- Edited-file lints：无错误
- `npm run qa:sample-gameplay-interaction`：**本次相关 5 款均通过**；全量 22 款仍 **2/22 failed**：
  - `color-bloom`：`gameplay depth puzzleMoves: 0 → 0`
  - `gun-merge-3d-zombie-apocalypse`：interaction diff `0.011 <= idle+0.004`

Next:

- 若继续质量闭环，先修上述两个旧样品互动 QA 失败。
- 部署生产后执行 `npm run seed:samples` 或访问 `/samples` 触发 ensure，确认生产 DB 也有 22 个样品。
- 生产 `/games?sort=latest` 肉眼确认 5 个卡片封面和试玩不抖动。

---

## 2026-06-17 — 迭代五十六 · 斗兽棋棋子可读性修复 ✅

Completed:

- 根据用户截图反馈修复斗兽棋棋子可读性：
  - `ChessScene` 的 jungle 棋子不再直接画纯汉字。
  - 新增 `jungleAnimalIcon()`：象/狮/虎/豹/狼/狗/猫/鼠映射到动物 emoji。
  - 新增 `junglePieceText()`：组合动物 icon + 汉字标签。
  - `redraw()` 中对 jungle 棋子绘制高对比圆形底与描边，再绘制双行 icon/文字。
- 更新防回退 QA：
  - `scripts/qa-board-showcase-samples.ts` 增加动物 icon、icon+label、圆形棋子底断言。

Changed Files:

- `src/game/engine/ChessScene.ts`
- `scripts/qa-board-showcase-samples.ts`
- `PROJECT_MEMORY/*`

Test Results:

- `npm run qa:board-showcase-samples`：**通过**
- `SAMPLE_AUDIT_IDS=jungle-animal-chess PLAYWRIGHT_BASE_URL=http://127.0.0.1:8888 npm run qa:sample-gameplay-interaction`：**通过**（1/1）
- `npm run build`：**通过**
- Edited-file lints：无错误

Next:

- 若目标设备 emoji 字体表现不稳定，改为本地 SVG/PNG 动物 icon 资产。

---

## 2026-06-17 — 迭代五十五 · 样品馆真实可见与控制台复制 ✅

Completed:

- 复盘用户反馈：
  - 上一轮验证覆盖代码、离线 QA、构建，但未 seed/验证真实 DB 可见性。
  - `/samples` 页面之前依赖静态 `SAMPLES` 列表，控制台复制 DB 项目到样品馆不会自动显示。
- 修复样品馆同步：
  - `ensureSampleGalleryProjects()` 改为每次幂等 upsert，避免代码样品更新不落 DB。
  - 新增 `/api/samples`，从 DB 中 `ownerKey=__sample-gallery__` 的公开 Project 返回 catalog。
  - `/samples` 页面改为 ensure 后读取 DB catalog 渲染。
- 修复控制台复制能力：
  - 新增 `src/lib/sample-gallery-copy.ts`。
  - 新增 `POST /api/admin/samples/copy-project`，super admin 可把任意 game project 复制成 `sample-*` 项目。
  - 运营控制台 Works 表 game 行新增“复制到样品馆”按钮。
  - 新增 CLI `npm run sample:copy-project -- <projectId> [sampleId]`，并用 CLI/QA 专用 wrapper 生成本地 public 资产。
- 修复 2048 schema bug：
  - `PuzzleBlueprint.targetScore` / `objectives.target` 上限从 999 放宽到 4096，避免 `targetScore: 2048` 从 DB parse 失败。

Changed Files:

- `src/lib/sample-gallery-seed.ts`
- `src/lib/sample-gallery-copy.ts`
- `src/lib/sample-gallery-copy-assets.ts`
- `src/app/api/samples/route.ts`
- `src/app/api/admin/samples/copy-project/route.ts`
- `src/app/samples/page.tsx`
- `src/components/admin/AdminConsolePage.tsx`
- `src/lib/game-spec.ts`
- `scripts/qa-sample-gallery-db-sync.ts`
- `scripts/qa-sample-gallery-copy.ts`
- `scripts/copy-project-to-sample-gallery.ts`
- `package.json`
- `PROJECT_MEMORY/*`

Test Results:

- `npm run seed:samples`：**通过**（20 projects）
- `npm run qa:sample-gallery-db-sync`：**通过**（20/20）
- `npm run qa:sample-gallery-copy`：**通过**
- `npm run qa:board-showcase-samples`：**通过**
- HTTP `GET /api/samples`：**通过**（20，含 2048 / Go / Jungle）
- `agent-browser open /zh-Hans/samples`：**通过**（页面可见三款新样品）
- `GET /api/projects/sample-number-merge-2048`：**通过**（`isSampleGallery=true`，`puzzle.mode=merge2048`）
- `SAMPLE_AUDIT_IDS=number-merge-2048,zen-go-board,jungle-animal-chess npm run qa:sample-gameplay-interaction`：**通过**（3/3）
- `npm run qa:b-tier-smoke`：**通过**（47/47）
- `npm run build`：**通过**
- Edited-file lints：无错误

Next:

- 生产部署后 seed/ensure 生产 DB；用生产控制台测试“复制到样品馆”按钮。
- 继续肉眼试玩三款棋盘/2048，看色彩、交互和棋盘可读性。

---

## 2026-06-17 — 迭代五十四 · 彩色棋盘与 2048 样品扩展 ✅

Completed:

- 按用户要求新增 3 个色彩鲜明小游戏样品：
  - `number-merge-2048`：2048 数字合成。
  - `zen-go-board`：围棋 19x19。
  - `jungle-animal-chess`：斗兽棋 7x9。
- 扩展规格层：
  - `PuzzleBlueprint.mode` 支持 `merge2048`。
  - `ChessBlueprint.ruleset` 支持 `go` / `jungle`。
  - 修复斗兽棋关键词误伤中国象棋的推断问题。
- 扩展运行时：
  - `PuzzleScene` 实现 2048 彩色数字块、滑动合并、新块生成、QA 状态。
  - `ChessScene` 实现围棋落子 + 简单白子回应、斗兽棋动物棋子 + 河流/陷阱/兽穴地形。
- 样品体系补齐：
  - `SAMPLES`、`SAMPLE_PLAY_PROFILES`、`EXPECTED_SCENE_BY_SAMPLE`、`GAMEPLAY_DEPTH_BY_SAMPLE`、`SAMPLE_GAMEPLAY_CASES`。
  - 新增 3 张 SVG 封面与基础 PNG sprite/bg 资产。
  - 新增 `scripts/qa-board-showcase-samples.ts`，并纳入 `qa:b-tier-smoke`。

Changed Files:

- `src/lib/samples.ts`
- `src/lib/game-spec.ts`
- `src/lib/puzzle-blueprint.ts`
- `src/lib/chess-blueprint.ts`
- `src/lib/game-templates/definitions.ts`
- `src/lib/sample-play-profiles/registry.ts`
- `src/lib/qa/competitor-clone-playability-checks.ts`
- `src/lib/qa/gameplay-depth.ts`
- `src/lib/qa/sample-gameplay-interaction.ts`
- `src/game/engine/PuzzleScene.ts`
- `src/game/engine/ChessScene.ts`
- `src/game/engine/template-theme-visual.ts`
- `scripts/qa-board-showcase-samples.ts`
- `scripts/qa-b-tier-smoke.ts`
- `package.json`
- `public/samples/number-merge-2048.svg`
- `public/samples/zen-go-board.svg`
- `public/samples/jungle-animal-chess.svg`
- `public/game-sprites/sample-number-merge-2048/*`
- `public/game-sprites/sample-zen-go-board/*`
- `public/game-sprites/sample-jungle-animal-chess/*`
- `public/game-bg/sample-number-merge-2048.png`
- `public/game-bg/sample-zen-go-board.png`
- `public/game-bg/sample-jungle-animal-chess.png`
- `PROJECT_MEMORY/*`

Test Results:

- `npm run qa:board-showcase-samples`：**通过**
- `npm run qa:template-matrix`：**通过**（13 templates + 20 samples）
- `npm run qa:non-sample-game-quality`：**通过**
- `npm run qa:commercial-game-design-contracts`：**通过**
- `npm run qa:xiangqi-commercial-runtime`：**通过**
- `npm run qa:competitor-clone-checks-offline`：**通过**（20/20）
- `npm run qa:gameplay-depth-offline`：**通过**（depth=20 assets=20）
- `npm run qa:sample-gameplay-interaction:offline`：**通过**
- `npm run qa:b-tier-smoke`：**通过**（47/47）
- `npm run build`：**通过**

Next:

- 部署后跑真实生产 URL 样品审计。
- 肉眼试玩 2048 / 围棋 / 斗兽棋，重点看色彩、棋盘可读性和交互反馈。

---

## 2026-06-17 — 迭代五十三 · 商业精品生成门禁与双样例落地 ✅

Completed:

- 新增商业精品专项 contract
  - `scripts/qa-commercial-game-design-contracts.ts`
  - `scripts/qa-match3-commercial-runtime.ts`
  - `scripts/qa-xiangqi-commercial-runtime.ts`
- 扩展规格层
  - `GameSpec.puzzle` 增加 `matchMechanic`、`objectives`、`boosters`、`specialTiles`、`levelCount`
  - 新增 `GameSpec.chess`
  - 新增 `src/lib/chess-blueprint.ts`
  - `mockSpecFromPrompt()` / `finalizeSpec()` / `applyHardQualityDefaults()` 补齐 puzzle/chess 商业蓝图
  - `lintGameSpecForOrchestration()` 增加 puzzle/chess 模板感知检查
- 开心消消乐式三消
  - `PuzzleScene` 支持 `matchMechanic: "swap"`
  - 相邻交换后形成三连才结算
  - 四/五连记录特殊块状态，QA 暴露 `match3Specials` / `specialTilesCreated`
  - 保留旧 flood 点击消除路径，兼容已有样品
- 中国象棋运行时
  - `ChessScene` 支持 `ruleset: "xiangqi"`
  - 9x10 棋盘、楚河汉界、红黑完整子力
  - 基础合法走法、合法落点高亮、吃子优先黑方 AI
  - QA 暴露 `boardRows` / `boardCols` / `pieceCount` / `ruleset`
- 新 QA 已接入 `package.json` 与 `qa:b-tier-smoke`
- 更新 `NEXT_ACTION.md`、`CURRENT_STATUS.md`

Test Results:

- `npx tsx scripts/qa-commercial-game-design-contracts.ts` RED：缺少 `puzzle.matchMechanic === "swap"` ✅
- `npx tsx scripts/qa-match3-commercial-runtime.ts` RED：缺少 `selectedMatch3Cell` / swap runtime ✅
- `npx tsx scripts/qa-xiangqi-commercial-runtime.ts` RED：缺少 `ruleset === "xiangqi"` runtime ✅
- `npm run qa:commercial-game-design-contracts`：通过
- `npm run qa:match3-commercial-runtime`：通过
- `npm run qa:xiangqi-commercial-runtime`：通过
- `npm run qa:non-sample-game-quality`：通过
- Edited-file lints：无错误
- `npm run qa:b-tier-smoke`：通过 **46/46**
- `npm run build`：通过
- `npm run qa:sample-play-extended`：通过 **7/7**
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:8888 npm run qa:prod-sample-play-audit`：通过 **17/17**

Next:

- 当前改动部署后，对真实生产 URL 跑 `PLAYWRIGHT_BASE_URL=<prod> npm run qa:prod-sample-play-audit`。
- 产品肉眼抽测：重点看 swap 三消手感、特殊块演出强度、中国象棋棋盘可读性与 AI 回应。

---

## 2026-06-17 — 迭代五十二 · 次级入口 HUD/资产下限补齐 ✅

Completed:

- 扩展 `qa:hud-goal-panel`：从 4 个核心 Scene 扩展到 7 个 Phaser Scene。
- 扩展 `qa:asset-visibility-floor`：从 4 个核心 Scene 扩展到 7 个 Phaser Scene。
- `FarmingScene`
  - 新增 `preload()` 加载 `bgTex`
  - 文生图背景用 `assetBackgroundAlpha(projectId, cohesive.qualityTier)`
  - 开场 banner 和常驻目标卡接入 `buildSceneGoalGuidance()` / `HudGoalPanel`
- `PuzzleScene`
  - 新增 `preload()` 加载 `bgTex`
  - 文生图背景用共享可见度下限
  - 接入统一目标卡
- `PhysicsScene`
  - 新增 `preload()` 加载 `bgTex`
  - 文生图背景用共享可见度下限
  - 接入统一目标卡
- Bugfix：修复 `PuzzleScene` 文生图背景层级低于不透明 puzzle backdrop，导致背景“加载但不可见”的问题；背景图 depth 改为 `-7`，并在 `qa:asset-visibility-floor` 增加回归断言。
- 清理 `FarmingScene` / `PuzzleScene` / `PhysicsScene` 不再使用的 `hudReady` import。
- 更新 `NEXT_ACTION.md`、`CURRENT_STATUS.md`

Test Results:

- `npm run qa:hud-goal-panel` RED：`FarmingScene should mount HudGoalPanel` ✅
- `npm run qa:asset-visibility-floor` RED：`FarmingScene should use shared background visibility floor` ✅
- `npm run qa:hud-goal-panel`：通过
- `npm run qa:asset-visibility-floor`：通过
- Edited-file lints：无错误
- `npm run qa:b-tier-smoke`：通过 **43/43**
- `npm run build`：通过
- `npm run qa:sample-play-extended`：通过 **7/7**
- `npm run qa:sample-gameplay-interaction:offline`：通过
- `npm run qa:gameplay-depth-offline`：通过 `depth=17 strictVisual=5 seed=17 assets=17`
- `npm run qa:non-sample-game-quality`：通过
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:8888 npm run qa:prod-sample-play-audit`：通过 **17/17**，报告 `qa-output/prod-sample-play-audit/REPORT.md`

Next:

- 当前改动部署后，对真实生产 URL 跑 `PLAYWRIGHT_BASE_URL=<prod> npm run qa:prod-sample-play-audit`。
- 继续肉眼抽测/截图审查，重点看 HUD 是否遮挡 Farming / Puzzle / Physics 的关键交互区。

---

## 2026-06-17 — 迭代五十一 · Systems 技能/道具可观察层 ✅

Completed:

- 新增 `qa:systems-observable-impact`，先红灯确认缺少 `systemImpact`。
- 新增 `src/game/engine/systemImpact.ts`：统一 `skill` / `powerup` 的可见反馈入口。
- `applySystemImpact()` 映射：bomb → boss；dash / doubleScore → combo；shield / timeSlow / heal → pickup。
- `PlayScene`、`PlatformerScene` 的 `applyPowerup(kind)` 接入共享 systems 冲击层。
- `PlayScene`、`ShooterScene`、`PlatformerScene`、`TowerDefenseScene` 的 `tryCastSkill()` 接入共享 systems 冲击层。
- 保留各 Scene 原有数值副作用：护盾、倍率、磁铁、回血、炸弹清场、dash、timeSlow 等。
- 新 contract 已接入 `package.json` 与 `qa:b-tier-smoke`。
- 更新 `NEXT_ACTION.md`、`CURRENT_STATUS.md`。

Test Results:

- `npx tsx scripts/qa-systems-observable-impact.ts` RED：`systemImpact` 不存在 ✅
- `npm run qa:systems-observable-impact`：通过
- Edited-file lints：无错误
- `npm run qa:b-tier-smoke`：通过 **43/43**
- `npm run build`：通过

Next:

- 分阶段做样品与非样品游戏路径验证，重点看 director / skill / powerup 的实际运行时观感。
- 后续扩展目标面板与资产下限到 Farming / Puzzle / Physics 等次级入口。

---

## 2026-06-17 — 迭代五十 · Director 事件运行时冲击层 ✅

Completed:

- 新增 `qa:runtime-depth-observable`，先红灯确认缺少 `runtimeEventImpact`。
- 新增 `src/game/engine/runtimeEventImpact.ts`：按 director event 类型统一触发语义反馈。
- `applyRuntimeEventImpact()` 映射：coinRain / goldenPickup / breathingRoom → pickup；goalShift → combo；miniBoss / finalBarrage → boss；其它事件 → hit。
- `PlayScene`、`ShooterScene`、`PlatformerScene`、`TowerDefenseScene` 的 `startEvent(ev)` 接入共享事件冲击层。
- 保留各 Scene 原有运行时副作用：倍率、刷 boss/精英、目标窗口、奖励/护盾等。
- 新 contract 已接入 `package.json` 与 `qa:b-tier-smoke`。

Test Results:

- `npx tsx scripts/qa-runtime-depth-observable.ts` RED：`runtimeEventImpact` 不存在 ✅
- `npm run qa:runtime-depth-observable`：通过
- Edited-file lints：无错误
- `npm run qa:b-tier-smoke`：通过 **42/42**
- `npm run build`：通过

Next:

- 继续 runtime-depth：把 systems skill / powerup 的状态变化做成更统一的可观察层。
- 后续扩展目标面板与资产下限到 Farming / Puzzle / Physics 等次级入口。

---

## 2026-06-17 — 迭代四十九 · 用户生成资产可见度下限 ✅

Completed:

- 新增 `qa:asset-visibility-floor`，先红灯确认 `assetBackgroundAlpha()` 未实现。
- `phaser-loaded-sprites.ts` 新增 `assetBackgroundAlpha(projectId, qualityTier)`，为用户生成背景建立可见透明度下限；`sampleBackgroundAlpha()` 改走新 helper。
- `phaser-loaded-sprites.ts` 新增 `visibleSpriteTargetSize(role, qualityTier)`，为 player / hazard / collectible / power / boss 提供 tier 化尺寸下限。
- `PlayScene`、`ShooterScene`、`PlatformerScene`、`TowerDefenseScene` 的文生图背景透明度改用 `assetBackgroundAlpha(projectId, qualityTier)`。
- 清除核心 Scene 背景 `0.1` / `0.12` 低透明度硬编码，减少“空模板/水印背景”观感。
- 新 contract 已接入 `package.json` 与 `qa:b-tier-smoke`。

Test Results:

- `npx tsx scripts/qa-asset-visibility-floor.ts` RED：`assetBackgroundAlpha` 不存在 ✅
- `npm run qa:asset-visibility-floor`：通过
- Edited-file lints：无错误
- `npm run qa:b-tier-smoke`：通过 **41/41**
- `npm run build`：通过

Next:

- 继续 runtime-depth：让 director/systems 的阶段、技能、道具和高潮事件更明显地改变运行时体验。
- 后续扩展目标面板与资产下限到 Farming / Puzzle / Physics 等次级入口。

---

## 2026-06-17 — 迭代四十八 · HUD 目标任务卡 ✅

Completed:

- 新增 `src/game/engine/HudGoalPanel.ts`：基于 `SceneGoalGuidance` 与 `CohesivePresentation` 绘制统一 HUD 任务卡。
- 任务卡展示目标、操作、风险/节奏提示；开场完整展示，数秒后按 `qualityTier` 半透明常驻。
- `PlayScene`、`ShooterScene`、`PlatformerScene`、`TowerDefenseScene` 挂载 `goalPanel` 并在 update 循环驱动。
- `TowerDefenseScene` 的目标面板下移，避免覆盖基地/波次 HUD。
- 新增 `qa:hud-goal-panel` 并接入 `package.json` 与 `qa:b-tier-smoke`。

Test Results:

- `npx tsx scripts/qa-hud-goal-panel.ts` RED：`HudGoalPanel` 不存在 ✅
- `npm run qa:hud-goal-panel`：通过
- `npm run qa:scene-goal-guidance`：通过
- Edited-file lints：无错误
- `npm run qa:b-tier-smoke`：通过 **40/40**
- `npm run build`：首次失败于 `HudGoalPanel` `GameObject` 类型宽化；收窄为 Rectangle/Text 后通过

Next:

- 扩展目标面板到 Farming / Puzzle / Physics 等次级入口。
- 继续推进用户生成资产可见度下限与 director/systems 运行时深度。

---

## 2026-06-17 — 迭代四十七 · 目标引导层第一步 ✅

Completed:

- 新增 `src/lib/scene-goal-guidance.ts`：从 `GameSpec` 生成 `title` / `objective` / `controls` / `stakes` / `banner` / `bottomHint`。
- 新增 `qa:scene-goal-guidance`：断言 collector / shooter / platformer / towerDefense 的目标引导必须包含游戏标题、明确目标、操作说明，且不能退回 `Ready/debug/template` 类文案。
- `PlayScene`、`ShooterScene`、`PlatformerScene`、`TowerDefenseScene` 的底部提示接入 `guidance.bottomHint`。
- 四个核心入口的开场 banner 接入 `guidance.banner`，首屏直接说明目标、操作和风险节奏。
- 新 contract 已接入 `package.json` 与 `qa:b-tier-smoke`。

Test Results:

- `npx tsx scripts/qa-scene-goal-guidance.ts` RED：缺少 `scene-goal-guidance` 模块 ✅
- `npm run qa:scene-goal-guidance`：通过
- Edited-file lints：无错误
- `npm run qa:b-tier-smoke`：通过 **39/39**
- `npm run build`：通过

Next:

- 阶段三继续：把文案层升级为可复用 HUD 目标面板/任务卡，而不只是 banner 与底部 hint。
- 后续继续资产可见度下限与 director/systems 运行时深度。

---

## 2026-06-17 — 迭代四十六 · TowerDefense 语义反馈收口 ✅

Completed:

- 新增 `qa:tower-defense-semantic-juice`，先红灯确认 `TowerDefenseScene` 尚未接入语义 feedback，再实施替换。
- `TowerDefenseScene`：合成格选择/合成、开波、建塔/升级、击杀、基地护盾/受击、全局技能、coinRain、胜负结算改走 `juicePickup` / `juiceHit` / `juiceCombo` / `juiceBoss` / `juiceWin` / `juiceFail`。
- 新增 `baseFxPoint()`，统一用路径终点定位基地反馈，避免在受击/护盾/失败分支重复硬编码坐标。
- 清空塔防内旧式 `juiceShake` / `juiceFlash` / `juiceBurst` / `juiceFloater` 直接调用。
- 新 contract 已接入 `package.json` 与 `qa:b-tier-smoke`。

Test Results:

- `npx tsx scripts/qa-tower-defense-semantic-juice.ts` RED：缺少 `juicePickup` ✅
- `npm run qa:tower-defense-semantic-juice`：通过
- Edited-file lints：无错误
- `npm run qa:b-tier-smoke`：通过 **38/38**
- `npm run build`：通过

Next:

- 阶段三：统一 HUD/目标引导层，解决“看起来像调试模板”的问题。
- 之后继续用户生成资产可见度下限与 director/systems 运行时深度。

---

## 2026-06-17 — 迭代四十五 · 语义化 Juice 横向推广 ✅

Completed:

- 新增 `qa:platformer-semantic-juice`、`qa:farming-semantic-juice`、`qa:puzzle-semantic-juice`，先红灯确认 Platformer / Farming / Puzzle 尚未接入语义 feedback，再实施替换。
- `PlatformerScene`：收集、受伤、护盾、boss/炸弹技能、章节切换、胜负结算接入 `juicePickup` / `juiceHit` / `juiceBoss` / `juiceWin` / `juiceFail`；宝箱胜利交给 `finish()` 统一反馈，避免重复爆屏。
- `FarmingScene`：播种、浇水、金币不足、收获连击、丰收结算改走 pickup / hit / combo / win 语义反馈，保留 harvest streak 对连击强度的影响。
- `PuzzleScene`：match3、找不同、记忆翻牌、拼图落位、胜负结算改走语义反馈；找不同开场装饰粒子仍保留为纯视觉装饰。
- 三个新 contract 已接入 `package.json` 与 `qa:b-tier-smoke`。

Test Results:

- `npm run qa:platformer-semantic-juice`：通过
- `npm run qa:farming-semantic-juice`：通过
- `npm run qa:puzzle-semantic-juice`：通过
- Edited-file lints：无错误
- `npm run qa:b-tier-smoke`：通过 **37/37**
- `npm run build`：通过

Next:

- 阶段二剩余：单独处理 `TowerDefenseScene`，把造塔、击杀、漏怪、波次、胜负反馈收敛到语义 feedback。
- 阶段三：统一 HUD/目标引导层，解决“看起来像调试模板”的问题。

---

## 2026-06-17 — 迭代四十四 · 语义化 Juice 试点 ✅

Completed:

- `gameJuice.ts` 新增 `resolveJuicePreset()`，定义 pickup / hit / combo / boss / win / fail 的语义化反馈参数。
- 新增 `juicePickup`、`juiceHit`、`juiceCombo`、`juiceBoss`、`juiceWin`、`juiceFail` 封装，Scene 只表达事件语义，不再手填一组 shake/burst/flash 数字。
- `PhysicsScene`：命中、连击、胜利接入语义反馈。
- `PlayScene`：收集、受伤、护盾、boss 入场/阶段/受击/击杀、胜负结算接入语义反馈。
- `ShooterScene`：敌人受击、爆炸、玩家受伤、护盾、炸弹技能、胜负结算接入语义反馈。
- 新增并接入 b-tier：`qa:juice-semantic-presets`、`qa:physics-semantic-juice`、`qa:play-scene-semantic-juice`、`qa:shooter-semantic-juice`。

Verification:

- `npx tsx scripts/qa-juice-semantic-presets.ts` RED：`resolveJuicePreset` 不存在 ✅
- `npm run qa:juice-semantic-presets` ✅
- `npm run qa:physics-semantic-juice` ✅
- `npm run qa:play-scene-semantic-juice` ✅
- `npm run qa:shooter-semantic-juice` ✅
- `npm run qa:b-tier-smoke` ✅ 34/34
- `npm run build` ✅
- Edited-file lints：无错误。

Notes:

- 这轮解决“反馈是参数拼装，不是语义事件”的问题，首批覆盖 Physics / Play / Shooter 三个高频体验入口。
- 下一轮建议横向迁移 Platformer / TowerDefense / Farming / Puzzle，并开始抽统一 HUD/目标引导层。
- 未 commit / push / deploy。

---

## 2026-06-17 — 迭代四十三 · 游戏质量跃迁第一阶段 ✅

Completed:

- 确认核心问题：现有 QA 强在样品 parity 和工程闭环，弱在非样品用户 prompt 的商业小游戏体验。
- 新增 `qa:non-sample-game-quality`，用五类普通用户 prompt 断言非样品 spec 的质量下限：orchestration lint、4 幕、3 个运行时事件、主动技能、4 个 powerup、商业表现档。
- `GameSpec.presentation` 增加 `qualityTier: minimal | standard | showcase`。
- `withPresentationDefaults()` 对用户新建默认 `qualityTier=standard`；`describeCohesiveExperience()` 展示 tier。
- `game-quality.ts` 增加 commercial director 兜底，确保非样品路径至少有奖励窗 / 限时目标 / 高压段这类运行时事件。
- `systems.ts` 保底 4 个 powerup，避免非样品局内道具密度太低。
- `gameJuice.ts` 新增 `resolveSharedJuiceStyle()`，将 `qualityTier` 映射到 shake / burst / floater / flash 强度。
- 新增 `qa:juice-quality-tier`，并把 `qa:non-sample-game-quality`、`qa:juice-quality-tier` 接入 `qa:b-tier-smoke`。

Verification:

- `npx tsx scripts/qa-non-sample-game-quality.ts` RED：缺少 commercial presentation tier ✅
- `npm run qa:non-sample-game-quality` ✅
- `npx tsx scripts/qa-juice-quality-tier.ts` RED：`resolveSharedJuiceStyle` 不存在 ✅
- `npm run qa:juice-quality-tier` ✅
- `npm run qa:game-quality-contracts` ✅
- `npm run qa:b-tier-smoke` ✅ 30/30
- `npm run build` ✅
- Edited-file lints：无错误。

Notes:

- 这轮先解决“非样品生成也必须有成品质量底线”和“表现档真正影响 juice 参数”。
- 尚未进入 Scene 内语义化反馈接入；下一轮优先做 `hit/pickup/combo/boss/win/fail` preset 并接入 `PlayScene` / `PhysicsScene` / `ShooterScene` 试点。
- 未 commit / push / deploy。

---

## 2026-06-17 — 迭代四十二 · 构建追踪治理 ✅

Completed:

- 新增 `src/lib/public-path.ts`，统一本地 `public/` 运行时资产路径。
- 替换封面、小说封面、漫画角色参考、漫画资源 GC、游戏背景/sprite、程序化资产、Godot 导出、blob-store 等模块里的直接 `process.cwd()/public` / `repoRoot()/public` 拼接。
- `next.config.ts` 增加 `outputFileTracingExcludes`，排除运行时/QA 大目录：`public/**/*`、`qa-output/**/*`、`workspaces/**/*`、`data/**/*.log`。
- 新增 `qa:next-trace-config` 与 `qa:public-path-contracts`，并接入 `qa:b-tier-smoke`。
- 继续补充 `/*turbopackIgnore: true*/` 到运行时动态文件访问：封面字体读取、小说/漫画/游戏生成资产、Godot workspace、AI sprite 引用读取。

Verification:

- `npm run qa:next-trace-config` ✅
- `npm run qa:public-path-contracts` ✅
- `npm run qa:b-tier-smoke` ✅ 28/28
- `npm run build` ✅；Turbopack broad-pattern warnings 从 39 → 19 → **0**。
- `npm run qa:next-trace-config` ✅（复验）
- `npm run qa:public-path-contracts` ✅（复验）
- `npm run qa:b-tier-smoke` ✅ 28/28（复验）
- Edited-file lints：无错误。

Notes:

- `npx tsc --noEmit` 仍被既有 `e2e/*.spec.ts` 类型问题挡住（agenticModule / Page / APIRequestContext 等），非本轮改动引入。
- `npm run lint` 长时间无输出，已停止；后续建议单独治理 ESLint 扫描范围或 ignore 本地生成产物。
- 工作区仍未 commit / push / deploy，`git status` 输出超过 1MB；下一步应先筛选提交范围。

---

## 2026-06-17 — 迭代四十一 · 三线风险修复 ✅

Completed:

- **游戏线**：新增 `qa:game-quality-contracts`；修复 `game-quality.ts` farming 经济双轨同步；`qa:competitor-gates` 改为结合 clone batch `summary.json` 兜底，避免 Windows 子进程假失败。
- **小说线**：新增 `literary-safety` 与 `qa:literary-safety-contracts`；公开列表/详情仅暴露 `public+ready`；生成中草稿默认 hidden；`resumeNovelId` 不重复扣首次生成额度。
- **漫画线**：新增 `comic-safety` 与 `qa:comic-safety-contracts`；同步 panels API 补 `comicPanels` quota；emergency 分镜返回 warning；部分配图返回 resumeHint。
- **复审修复**：只读复审发现 panels quota gate 早于归属校验/完成态 no-op，已移动到 owner + no-op 之后；契约测试补顺序断言。
- **报告收口**：修复单线 `qa:product-lines:*` 覆盖三线 `summary.json` 的误导性行为；新增 `qa:product-lines-summary-contracts`，仅全量 `qa:product-lines` 写 aggregate summary。
- **门禁接入**：三个契约 QA 已加入 `package.json`、`qa:b-tier-smoke`、`qa:product-lines` 三线步骤。

Verification:

- `npm run qa:game-quality-contracts` ✅
- `npm run qa:literary-safety-contracts` ✅
- `npm run qa:comic-safety-contracts` ✅
- `npm run qa:product-lines:game` ✅（含 E2E）
- `npm run qa:product-lines:novel` ✅（含 E2E）
- `npm run qa:product-lines:comic` ✅（含 E2E）
- `npm run qa:product-lines` ✅（game/novel/comic 三线全绿，summary 包含三条线）
- `npm run qa:b-tier-smoke` ✅ 26/26
- `npm run build` ✅
- Edited-file lints：无错误

Notes:

- 未 commit / push / deploy。
- 工作区仍包含迭代四十的大量贴图、Scene/表现层、QA 产物与本轮改动；提交前需确认哪些 QA 截图/报告要纳入。

---

## 2026-06-15 — 迭代三十 · 宋辽满格+精选 ✅

- 分镜 **396s** + lib 配图 **775s** → **32/32** · comicId `cmqekk1ft000113f3f5y8qke8`
- `seed:comic-featured-songliao` → 发现页精选（与煤山并列）
- `qa:product-lines:novel` / `:comic` 离线+E2E 全绿（`PW_EXTERNAL=1`）
- 产物：`full-medium-summary.json` · `panels-resume-summary.json`

---

- **`qa:competitor-clone-checks-offline`**：17/17 样品 Scene + profile 离线断言 · 接入 CI + b-tier **20/20**
- **`qa:competitor-clone-batch`**：实机 smoke 8/8 · 全量 **17/17**（动画 burst 截图）
- **`qa:pm-handtest-signoff`**：六模板 + 竞品 PM 自动化签收 6/6 → `qa-output/pm-handtest-signoff/`
- **`qa:competitor-gates`**：接入 batch all=17 · nightly artifact 含 batch 报告
- **文档**：HISTORICAL #27–29 · CURRENT_STATUS · TASK_QUEUE 清空阻断项

仍须用户：**git commit** · **Console SSO 生产 IdP 密钥** · 可选肉眼抽测

---

## 2026-06-14 — 四档小说 + 中篇 8 页全量实机 ✅

Completed:

- **四档小说**（~32min）：short 2709字 · medium 11662字 · long 87423字 · children 671字
- **中篇 8 页漫画**：light 分镜 267s · **lib 配图 32/32**（~7.7min）
- **`qa-songliao-literary-regression`**：补 `QA_PANEL_RENDER_MODE=lib`（与 DATABASE_URL 同源，不依赖 dev HTTP）
- **根因**：`DATABASE_URL` 须 `file:./dev.db`（勿 `file:./prisma/dev.db`）；dev 若绑 `ci.sqlite` 则 HTTP panels/stream 404
- **roster**：raw SQL 优先，消除 Prisma Client 滞后噪音

---


- **`qa:product-lines`**：游戏 / 小说 / 漫画 离线 + E2E 独立验收（报告 `qa-output/product-lines/`）
- **`qa:literary-user-journey`**：中篇四宫格断言对齐迭代十八
- **`qa-novel-comic-smoke`**：补 `prisma.$disconnect()` 防挂起
- **`fix-dev-db-migrations`**：缺 User 表时 `db push` + failed migration rollback
- **`novel-character-roster-db`**：Prisma 优先 + raw SQL 回退（Client 未 generate 时）
- **实机**：短篇宋辽小说 3343 字 + 漫画 light 4 页 252s ✅

Test Results:

- 游戏：离线 6/6 + E2E **15/15**
- 小说：离线 3/3 + E2E **3/3**
- 漫画：离线 5/5 + E2E **4/4**
- `npm run qa:product-lines`：**全绿**

---


- **`novel-character-roster-db.ts`**：移除 raw SQL，统一 Prisma `characterRosterJson`
- **`qa:comic-director-pipeline`**：断言中篇 8 页轻量 / Brief 跳过 / 蓝图阈值；接入 `qa:b-tier-smoke` + `qa:deploy-preflight`
- **`qa:songliao-literary-regression`**：补 npm script
- **记忆**：`CURRENT_STATUS` · `NEXT_ACTION` · `LITERARY_CHAIN_CHECKLIST` · `HISTORICAL_ISSUES_CLOSURE` · `TASK_QUEUE` · `DECISIONS`

---


- **B10**：`StudioLiteraryChainPanel` + 作品卡片「追踪生产链」按钮，按 novel/comic API 推断当前步
- **C2**：`Novel.characterRosterJson` 迁移 · `GET/PUT /api/novel/[id]/character-roster` · 面板 debounce 同步
- **C4**：`clearComicPanelImages` 支持单格 · panels/stream `panel` 参数 · outline「重绘此格」
- **`npm run build`** ✅

---

Completed:

- **`literary-production-chain.ts`**：`inferNovelChainStep` / `inferComicChainStep` + 五步深链
- **工作链**：`novel/[id]`、`comic/[id]`、`studio` compact；Chain 组件 pending 可点 + compact 模式
- **角色资产库**：`NovelCharacterRosterPanel`（localStorage + 改编 CTA）
- **结构化分镜**：`ComicStoryboardOutline`（页/格/对白/镜头/配图进度）
- **账号 UX**：AccountMenu 注册、studio `?register=ok` 欢迎条、register testid
- **E2E**：`e2e/register.smoke.spec.ts`
- **清单**：`PROJECT_MEMORY/LITERARY_CHAIN_CHECKLIST.md`
- **`npm run build`** ✅

---

Completed:

- **注册/登录**：Prisma `User.passwordHash`、`EmailVerification`；`POST /api/auth/register/send-code`、`/register`、`/api/auth/login/email`；`/register` 页 + `/login` 邮箱入口
- **工作链 UI**：`LiteraryProductionChain`（大纲→章节→角色→分镜→漫画）挂载 `novel/create`、`comic/create`
- **i18n**：五语言 `account.*` 注册文案 + `apiErrors.*` + `literaryChain.*`
- **`npm run build`** 通过

Notes:

- 生产 SMTP 未接；开发用 `EMAIL_AUTH_DEV_EXPOSE=1` 或 API 返回 `devCode`
- 对标 [轻灵AI](https://www.qinglingdesign.cn/#features) 的 P1 缺口见 `DECISIONS.md` 2026-06-14 条目

Changed Files:

- `prisma/schema.prisma` · `prisma/migrations/20260614100000_email_auth/`
- `src/lib/auth/password.ts` · `email-verification.ts` · `email-register.ts`
- `src/app/register/page.tsx` · `src/app/login/page.tsx`
- `src/app/api/auth/register/**` · `src/app/api/auth/login/email/route.ts`
- `src/components/literary/LiteraryProductionChain.tsx`
- `src/app/novel/create/page.tsx` · `src/app/comic/create/page.tsx`
- `src/messages/*.json` · `.env.example`

---

Completed:

- 详情页：`WorkEngagementStats` + `WorkLikeButton`（游戏/小说/漫画）；游戏试玩页 POST `/play` 并展示试玩数
- Discover：小说/漫画排序（最热/最多赞/最新）、`DiscoverListSkeleton`、漫画 loadError
- `/start`：社区回流链（游戏/小说/漫画发现 + 工作室）
- 漫画详情：`withLocalePath` 修复改编/next 深链
- 共享组件：`src/components/work/*`

Changed Files:

- `src/components/work/` · discover pages · detail pages · `CreationLauncher.tsx`
- `src/app/api/projects/[id]/route.ts`（返回 playCount）
- i18n 五语言 `start.browseCommunityTitle`

---

## 2026-06-14 — 漫画独立流水线 QA 收尾 + E2E 修复

Completed:

- `qa:comic-featured:offline`：默认 `DATABASE_URL=file:./prisma/ci.sqlite`，避免与 dev.db 争锁导致 b-tier 挂起
- `qa:b-tier-smoke` 11/11 · `qa:deploy-preflight` 全绿 · `npm run build` 通过
- E2E：`novel-comic.smoke` 修正「从我的小说」文案断言；`comic-create-from-novel-panel` testid；深链 strict mode 修复
- E2E：`novel-comic` + `admin-runtime-config` 共 8 passed

Changed Files:

- `scripts/qa-comic-featured-offline.ts`
- `src/app/comic/create/page.tsx`
- `e2e/novel-comic.smoke.spec.ts`
- `PROJECT_MEMORY/NEXT_ACTION.md`

---

## 2026-06-13 — 封面链路收尾 + dev.db 修复 + HTTP runtime QA 全绿

Completed:

- 封面：`novel/create` → `NovelCreateCoverPreview` + `useAutoWorkCover`（超时/cache bust/重试）
- Hook：`autoFetch` · `fetchTimeoutMs` · `onFailed(reason)`
- dev.db：`npm run fix:dev-db-migrations`（visibility + coverPath 漂移 resolve）
- QA：`qa:runtime-config-admin:http` 17/17；`PW_REUSE_SERVER=1 test:e2e:admin-runtime-config` 1 passed
- 文档：`.env.example` · `README` · `docs/local-database.md` · `docs/admin-super-admin.md`

Changed Files:

- `scripts/fix-dev-db-migrations.ts` · `package.json`
- `src/components/novel/NovelCreateCoverPreview.tsx` · `src/hooks/use-auto-work-cover.tsx`
- `PROJECT_MEMORY/NEXT_ACTION.md` · `TASK_QUEUE.md`

---

## 2026-06-08 — UI 真实浏览器复查与侧栏账号菜单修复

Completed:

- 对 `http://localhost:8888/admin` 做真实浏览器复查：桌面与 390px 移动视口均能打开后台。
- 发现并修复桌面侧栏底部账号按钮贴近视口底边，导致鼠标点击命中异常、下拉菜单看似不展开/易与 CTA 区域重叠的问题。
- 将账号菜单改为 body-level Portal 浮层，补 `aria-haspopup` / `aria-expanded` / `role="menu"`，支持外部点击与 Esc 关闭。
- 将桌面侧栏拆为固定品牌区、独立滚动导航区、固定底部账号/CTA 区，避免底部操作被滚动容器裁剪。

Changed Files:

- `src/components/auth/AccountMenu.tsx`
- `src/components/SiteHeader.tsx`
- `PROJECT_MEMORY/SESSION_LOG.md`

Test Results:

- `npx eslint src/components/SiteHeader.tsx src/components/auth/AccountMenu.tsx`：**通过**
- 真实浏览器 `/admin` 桌面：账号按钮从贴底位置恢复到可点击区域，鼠标点击后 `expanded=true` 且菜单项出现。
- 真实浏览器 `/admin` 390px：横向溢出检测 `overflow=false`，移动端账号菜单点击后可展开。
- `npm run build`：**通过**；仍有既有 Turbopack 动态文件追踪 warning（Godot/workspaces/blob-store 路径相关），非本次 UI 改动引入。

Next:

- 若用户继续反馈具体页面截图，优先用真实浏览器复现，不再仅以构建/E2E 通过作为 UI 完成依据。

---

# SESSION_LOG

> 新条目置顶。

## 2026-05-17 — 产品配置内聚 + README/记忆 + 测试资产入库

### Completed

- **`src/lib/product-config.ts`**：小说/游戏/漫画模型、超时、限流、长篇分段等迁出 `.env`  
- **长篇分段续写**：`novel-long-generate.ts`（大纲 + 多段 + 前文摘要）  
- **git**：`1e44a87` 已推 `main`（https://github.com/gaogg521/1one-game）  
- **记忆**：`iterations/2026-05-17-summary.md`、`CURRENT_STATUS`、`NEXT_ACTION`、`DECISIONS`  
- **README**：模型/环境变量章节改为 product-config 说明  
- **已推送**：`e79bd50` — `ci.sqlite`、24 张 `openai-*.png`、`src/png/小说生成.png`、README/日结  

### Tests

- `npm run build` ✅ · `qa-novel-long-plan` ✅ · 此前 E2E **24/24**

---

## 2026-05-17 — 全量自测 `npm run qa:full`

### Completed

- **E2E 24/24**（ci.sqlite + `saveRefinementLogJson` 兜底）  
- **手测模拟**：8 页分镜 ~210s OK  
- **`qa:studio-duplicate`** OK（同库校验）  
- **`npm run qa:full`** / 报告 `FULL_QA_REPORT_2026-05-17.md`  
- **32 格配图** 后台重跑

---

## 2026-05-17 — Studio 复制 + 32 格配图长测启动

### Completed

- **`POST /api/novel/[id]/duplicate`**、**`POST /api/comic/[id]/duplicate`** + 工作室「复制副本」  
- **`scripts/qa-studio-duplicate.mjs`** 冒烟通过  
- 后台 **`npm run qa:comic-32-panels`**（8 页分镜 + 32 格 SSE，写 `COMIC_32_PANEL_LONGTEST.md`）

---

## 2026-05-17 — coverPath 兜底 + 网关超时 + 回归

### Completed

- **`cover-path-db.ts`**：`persistComicCoverPath` / `persistNovelCoverPath` raw SQL 优先（修复漫画封面 update 崩溃）  
- **`.env`**：`x-openclaw-timeout-ms` **25000 → 600000**（中篇流式断连根因）  
- **回归**：`qa:template-matrix` 6/6 · `qa:director-spec` OK · Playwright **24/24** · `npm run build` OK

---

## 2026-05-17 — novel E2E 收尾 + README 手测脚本

### Completed

- **`e2e/novel-comic.smoke.spec.ts`**：mock `generate/stream` 返回 200 + `{ step: "error", message: "小说生成失败…" }`（对齐真实 SSE 失败路径）  
- **Playwright `e2e/` 24/24**（`PW_EXTERNAL=1` + `E2E_REFINE_STUB=1`）  
- **README**：补 `qa:template-matrix` / `simulate:handtest` / E2E 环境变量说明

---

## 2026-05-17 — 全量手测模拟（代替人工）

### Completed

- **`e2e/templates-handtest.spec.ts`**：六模板试玩 8/8 + refine 摘要 + 访客  
- **`scripts/simulate-handtest.mjs`** + **`scripts/run-handtest-all.ps1`**  
- **漫画 8 页**：分段 LLM **206s** 成功（8 页 / 32 格）  
- **`comic/generate`**：`lengthTier` 写入 raw SQL 兜底（Prisma Client 未 generate 时）  
- **`novel-comic.smoke`**：加载文案与 UI 对齐（`生成中…`）  
- 报告：`HANDTEST_SIMULATION_REPORT.md`

### Test Results

- Playwright 游戏链路 18/18；全 e2e 23→24（novel 失败项已修）  
- `qa:novel-comic-smoke` 通过

---

## 2026-05-17 — 六模板矩阵 QA + 共创 E2E

### Completed

- **`scripts/qa-template-matrix.ts`** + `npm run qa:template-matrix`：六模板 6/6  
- **`e2e/create-play.smoke.spec.ts`**：创建 → 试玩 → PATCH 保存  
- **`mock-spec.ts`**：生存关键词优先于射击（避免「生存+弹幕」误判 shooter）  
- CI quality 增加 `qa:template-matrix`  
- Playwright：**9/9**（refinement 7 + create-play 2）

---

## 2026-05-17 — 玩法深化 + 漫画分段生成

### Completed

**collector / survivor / avoider 玩法深化**
- `director.ts`：三模板专属事件保底：`finalBarrage`（avoider 终局弹幕）、`goldenPickup`（collector 黄金收集物）、`breathingRoom`（survivor 喘息窗口）
- `director.ts`：acts modifier 新增 `bonusField`（collector 奖励场章节）
- `PlayScene.ts`：处理三个新事件类型（运行时副作用 + 视觉反馈）；`spawnGoldenPickup`（闪烁高价值物件）；`startDangerVignette` 复用；`breathingRoom` 降低刷怪密度；`finalBarrage` 高密度精英刷新
- `generate-spec.ts`：`enhancePromptForProduction` 加入三模板专属 director.events 提示
- `scripts/qa-director-spec.ts`：断言三模板专属事件存在

**漫画 8 页 502 修复**
- `comic/generate/route.ts`：分段生成（每次最多 4 页），各段独立 LLM 请求，失败段用占位页填充，不中断整体；超时从 `30+8*8=94s` 降至 `30+4*10=70s/段`

### Test Results

- `npm run qa:director-spec`：通过（含新事件断言）
- `npm run build`：通过

---



### Completed

- 迁移 **`20260517120000_project_play_like_counts`**（`Project.playCount` / `likeCount` 曾缺列导致保存误报「规格无效」）  
- **`project-refinement-db.ts`**：refinementLog 读写走 raw SQL（与 likeCount 同模式，避免 Client 未 generate 时 refine 500）  
- **`proxy.ts`**：owner Cookie `secure` 仅在 HTTPS，修复 `next start` + HTTP 下 E2E 401  
- **`PlayGameClient`**：渲染「已保存到项目版本」  
- Playwright **`e2e/refinement.smoke.spec.ts`**：**7 passed**（`PW_EXTERNAL=1` + `E2E_REFINE_STUB=1` + `ci.sqlite`）

### Test Results

- `npx playwright test e2e/refinement.smoke.spec.ts`：**7/7**  
- `qa:director-spec`、`qa:refinement-log`、`npm run build`：通过

---

## 2026-05-17 — Refinement E2E + 迁移修复 + CI smoke

### Completed

- **`e2e/refinement.smoke.spec.ts`**：主人 patch/regenerate、保存、create?from= 摘要；访客 401 / 无 refinementHistory  
- **`src/lib/refinement-stub.ts`** + **`E2E_REFINE_STUB=1`**（Playwright webServer / CI）  
- **`scripts/qa-refinement-log.ts`**；CI quality  job 增加 director + refinement 脚本  
- 修复空迁移目录 **`20260516130000_comic_cover_path/migration.sql`**（否则 `migrate deploy` 失败）

### Test Results

- `npm run qa:refinement-log`、`npm run qa:director-spec`、`npm run build`：通过  
- Playwright：见 CI `bundle-e2e`（本地可 `DATABASE_URL=file:./ci.sqlite npx prisma migrate deploy` 后 `npm run test:e2e`）

---

## 2026-05-17 — PR-B022：可选 director JSON Schema + coerce 保留 director/systems

### Completed

- **`GAME_SPEC_JSON_SCHEMA_INCLUDE_DIRECTOR=1`** 门控扩展 schema；默认关闭保持网关兼容  
- **`coerceGameSpec`**：合法 **director / systems** 不再被丢弃  
- **`qa:director-spec`** 增补 coerce 断言  

### Test Results

- `npm run qa:director-spec`、`npm run build`：通过  

---

## 2026-05-17 — B 档泳道 A/B 批量落地（refine · director 韧性 · QA 脚本）

### Completed

- **A**：`spec-patch`、`POST /api/projects/[id]/refine`（patch/regenerate）、`refinementLogJson`、试玩/创作台 UI、`GENERATE_RL_REFINE_MAX`
- **B**：`overlaySpec` 校验 director/systems、四模板未知事件防护、`npm run qa:director-spec`、可选 variants `directorSummary`、`DECISIONS`/README/SYSTEM 对齐、PR-B022（可选 director schema）

### Test Results

- `npm run qa:director-spec`：通过  
- `npm run build`：通过  

---

## 2026-05-17 — Director：四幕统一 + PlayScene 三模板事件保底

### Completed

- **`buildDirector`**：`actCount` 固定为 **4**（开场 / 加速 / 变奏 / 终局），注释标明 B 档对齐意图  
- **Play 三模板**：在 `avoider` / `collector` / `survivor` 上 **保底补齐** `coinRain`、`goalShift`、`miniBoss`（若随机未产出则注入），文案按模板区分  

### Changed Files

- `src/lib/director.ts`

### Test Results

- `npm run build`：通过  

---

## 2026-05-17 — avoider 险避连击 + collector 险境宝石场上限

### Completed

- **avoider**：`triggerNearMiss` 支持 **1.6s 内连续险避**叠层，额外加分封顶 +5（飘字带连击倍数）
- **collector**：场上 **最多 2 颗** `riskBonus` 宝石；`spawnRiskCollectible` / `spawnWave` 双保险

### Changed Files

- `src/game/engine/PlayScene.ts`

### Test Results

- `npm run build`：通过

---

## 2026-05-17 — survivor 最后一波倒计时 + collector 险境收集物

### Completed

- **survivor**：一次性「最后一波」窗口（进入含 `finale` 的章节或进度 ≥88% 触发）
  - HUD：`最后一波 Ns` 倒计时（优于连躲提示）
  - 窗口内成功躲避额外 +1（与其它加压条件叠加）
  - `spawnWave` 期间额外下落威胁更高概率
  - 倒计时结束存活：**士气 +5**（单次，`npm run build` 已通过）
- **collector**：`spawnRiskCollectible()` — hazard 色 Tint、`riskBonus=5`，拾取后附近生成 **2** 个威胁 +「险境 +5」飘字；修复为先读 `getData` 再 `destroy`

### Changed Files

- `src/game/engine/PlayScene.ts`

### Test Results

- `ReadLints`：通过
- `npm run build`：通过

---

## 2026-05-17 — PlayScene：survivor 连躲 / collector 连收 combo

### Completed

- **survivor**：连续成功躲避（障碍落出屏）累计 `survivorDodgeStreak`；受伤清零
  - 残血（≤2）或章节含 `finale` 时，每次成功躲避额外 +1 分（加压下苟活）
  - 每连续 6 次躲避触发一次「苟住节奏」坚韧加分（随 streak 略成长）
  - HUD：`goalText` 在非限时目标时显示「生存连躲 N」（N≥3）
- **collector**：约 1.35s 内连续拾取叠加 combo，额外加分（上限 +5/次）；受伤清零 combo
  - 连收时飘字「连收 ×n」
- **avoider**：沿用既有险避机制；本次未改逻辑

### Changed Files

- `src/game/engine/PlayScene.ts`

### Test Results

- `ReadLints`：通过
- `npm run build`：通过

### Next

- `survivor` 可考虑独立「最后一波」倒计时窗口；`collector` 可加高风险拾取圈

---

## 2026-05-17 09:19 — PlayScene 三模板差异化继续推进

**已读来源**：`PlayScene.ts`、`TASK_QUEUE.md`、上一轮 `PlatformerScene` / `PlayScene` 记录。

### Completed（本小轮）

- **collector / survivor / avoider** 继续在 `PlayScene` 里做差异化，而不再只共享同一节奏
  - `spawnWave()` 现在会读取章节 modifier，终局段与双刷段会实际增加威胁密度
  - `collector`：终局段会提高收集物与威胁同时出现的密度，并额外加入精英压场
  - `survivor`：低血量或终局段更容易刷出救场 powerup，朝“扛最后一波”靠近
  - `avoider`：终局段更容易进入高压精英回避节奏
- **章节提示**：`updateAct()` 不再只是改标题，进入不同章节会给对应模板的 Banner 文案
- **精英威胁**：`spawnEliteHazard()` 适配 `collector` 的全场游走精英，而非只从顶部落下
- **胜负反馈**：`finish()` 的文案按 `collector / survivor / avoider` 区分，不再共用同一句结果提示

### Changed Files

- `src/game/engine/PlayScene.ts`

### Test Results

- `ReadLints`：无新增问题
- `npm run build`：通过

### Next

- 继续给 `collector / survivor / avoider` 补更强的独占机制，而不只是密度差异
- 再同步 `CURRENT_STATUS` / `NEXT_ACTION`

---

## 2026-05-17 00:00 — PlayScene 目标闭环 + 生成提示继续偏向玩法结构

**已读来源**：`PlayScene.ts`、`PlatformerScene.ts`、`generate-spec.ts`、`mock-spec.ts`、既有升级计划与本轮记忆。

### Completed（本小轮）

- **PlayScene**：补齐 `goalShift` 的真实闭环，不再只是 HUD 文案
  - 新增 `goalShiftNeed / goalShiftHave / goalShiftSucceeded`
  - 收集物 / 躲避达成时会累计限时目标进度
  - 达成后给额外分数奖励并弹出 Banner
  - 失败时也有事件结束反馈
- **生成侧提示**：`generate-spec.ts` 的系统提示继续向“玩法结构优先”收紧
  - 明确要求 avoider / survivor / collector 优先产出 `coinRain / miniBoss / goalShift`
  - 明确要求 platformer 更像关卡推进而不是单屏随机跳跃
  - 明确要求 shooter / towerDefense 体现波次与结构变化
- **mock-spec**：平台跳跃 / 收集 / 生存 / 射击的默认 subtitle 更偏“阶段目标 / 波次 / 结构感”

### Changed Files

- `src/game/engine/PlayScene.ts`
- `src/lib/generate-spec.ts`
- `src/lib/mock-spec.ts`

### Test Results

- `ReadLints`：无新增问题
- `npm run build`：先因 `PlayScene` 类型收窄比较失败一次，已修复后 **再次通过**

### Next

- 继续补 `PlatformerScene` 的阶段目标 / 事件 / 精英威胁
- 再回头补 `collector / survivor / avoider` 的更深结构

---

## 2026-05-16 — 游戏生成产品升级（共创流程 / spec 持久化 / shooter 共享能力）

**已读来源**：`INDEX.md`、`CURRENT_STATUS.md`、升级计划、`CreateClient.tsx`、`PlayGameClient.tsx`、`generate/stream`、`projects/[id]`、`ShooterScene.ts`、`td-blueprint.ts`。

### Completed

- **Phase 1 共创流程**：`/create` 从单轮输入升级为 **4 步共创**（输入创意 → 提炼意图 → 候选方向 → 生成试玩）
- **SSE 过程可视化**：在 Studio log 里展示“当前理解 / 已选方向 / 成品提要”，不再只显示阶段提示
- **版本真相源**：
  - `PATCH /api/projects/[id]` 支持 **prompt + spec** 更新
  - `/create?from=` 能恢复 **完整 spec + prompt**
  - `/play/[id]` 支持 **AI patch 后保存** 与 **quick tune 后保存**
- **patch 闭环**：`/api/generate/patch` 额外返回合成后的 prompt，便于后续回写项目上下文
- **共享运行时扩展**：`shooter` 接入 `systems.skill` / `director.events`
  - 护盾、减速、爆发火力、goalShift 僚机窗口
  - HUD 展示技能状态与冷却
- **塔防蓝图增强**：`td-blueprint.ts` 波次增加 **rush / elite** 变体，提高塔防中层节奏差异

### Changed Files（本轮核心）

- `src/app/create/CreateClient.tsx`
- `src/app/play/[id]/PlayGameClient.tsx`
- `src/app/api/projects/[id]/route.ts`
- `src/app/api/generate/patch/route.ts`
- `src/lib/create-studio-narrative.ts`
- `src/lib/parse-generate-request.ts`
- `src/game/engine/ShooterScene.ts`
- `src/lib/td-blueprint.ts`

### Test Results

- `ReadLints`（本轮相关文件）：**无新 lint**
- `npm run build`：**通过**

### Next

- 继续把共享玩法层补到 `platformer` / `collector` / `survivor`
- 为 `/create -> /play -> 保存回项目` 增加更系统的手测清单

---

## 2026-05-16 — 文生图批量 / 漫画配图 SSE / 小说广场删除 / 《煤山崇祯》漫画

**已读来源**：`INDEX.md`、`CURRENT_STATUS.md`、用户会话（配图慢、ComfyUI、批量 4 张、小说删除、煤山崇祯漫画）。

### Completed

- **文生图路径确认**：无 `COMFY_UI_BASE_URL` → **OpenAI 网关 `gpt-image-2`**；Comfy 分支存在但串行且未启用  
- **批量配图**：`generateImagesBatchOpenAIDetail`（单次 `n=4`）；`IMAGE_GEN_BATCH_PANELS` 默认 4；≤4 格走批量，>4 格并发 4  
- **可观测性**：`formatImageGenElapsed`、SSE `elapsedMs`、心跳 5s；`GENERATE_STRUCTURED_LOG`  
- **漫画创建**：`panelCount > 4` 时 **跳过内联配图**，改详情页流式 `panels/stream`（`maxDuration=600`）  
- **动漫列表 500**：`comic-list-query.ts` + `$queryRaw` 读 `coverPath`（Prisma client 未对齐时）  
- **漫画详情**：无图不重影旁白；`displayComicTitle`；SSE 配图进度  
- **小说广场**：`GET /api/novel` 返回 `isOwner`；本人卡片悬停 **删除**（`DELETE /api/novel/[id]`）  
- **《煤山崇祯》** `cmp7w7381000auz81yisafq0h`：生成漫画 `cmp8e84lk0001x6zgo8jrd8jg`（2 页 8 格），配图 **12 分 12 秒**；8 页分镜首次 **502**

### Changed Files（核心）

- `src/lib/image-generation.ts`、`src/lib/comic-panel-render.ts`、`src/lib/model-config.ts`  
- `src/lib/format-duration.ts`（从 comic-panel-render 拆出，修 build 客户端引 `fs`）  
- `src/app/api/comic/generate/route.ts`、`src/app/api/comic/[id]/panels/stream/route.ts`  
- `src/app/comic/[id]/page.tsx`、`src/app/novel/discover/page.tsx`、`src/app/api/novel/route.ts`  
- `src/lib/comic-list-query.ts`、`src/lib/comic-display.ts`  
- `.env.example`：`IMAGE_GEN_BATCH_PANELS`、`COMIC_PANEL_GEN_CONCURRENCY`  
- `scripts/generate-comic-for-novel.mjs`、`scripts/benchmark-comic-panel-http.mjs` 等

### Test Results

- `npm run build`：**通过**  
- 批量 4 格 HTTP：**4 分 25 秒**，4/4 OK  
- `generate-comic-for-novel.mjs` 2 页：**46s 分镜 + 12m 配图**，8/8 OK  
- 8 页分镜（medium 一次）：**502** LLM_FAILED

### Next

见 **`NEXT_ACTION.md`**：Prisma generate（若需）、中篇分镜 502 优化、用户验收漫画链接

---

## 2026-05-16 — 工作室「网络异常」+ 漫画创作链路加固

**已读来源**：`INDEX.md`、`iterations/2026-05-16.md`、`studio/page.tsx`、`api/comic/generate`、`comic-generate-config`、生产日志（Prisma validation）。

### Completed

- **Studio**：`readApiJson` + 分接口容错；`/api/novel?mine=1`、`/api/comic?mine=1`；`projects` 401 不整页失败；`normalizeWorkRow` 补齐字段。  
- **列表 API**：`GET /api/novel`、`GET /api/comic` 支持 `mine=1`（无 owner 返回空列表）；`select` 增加 `updatedAt`、`status`、`shareCode`。  
- **漫画生成**：`normalizeComicPagesForGeneration`（页数/每页 4 格补齐）；放宽 LLM JSON Schema（1…N 页、每页 1…4 格）；`read-json-body` 默认 body 上限 **524288**；`.env.example` 注释同步。  
- **前端**：`/comic/create`、`novel/[id]` 生成漫画、`/comic/[id]` 详情 — 非 JSON / 413 / 无 `comic.id` 可读错误；loading 用 `finally` 复位。

### Changed Files（本会话核心）

- `src/app/studio/page.tsx`  
- `src/app/api/novel/route.ts`、`src/app/api/comic/route.ts`  
- `src/lib/comic-generate-config.ts`、`src/app/api/comic/generate/route.ts`  
- `src/lib/api/read-json-body.ts`、`.env.example`  
- `src/app/comic/create/page.tsx`、`src/app/comic/[id]/page.tsx`、`src/app/novel/[id]/page.tsx`  
- `PROJECT_MEMORY/*`（本批记忆落盘）

### Test Results

- `npm run build`：**通过**（会话内）  
- `POST /api/comic/generate` 冒烟：**500**（根因：Prisma client 不认 `lengthTier` / `coverPath`，需本机 `prisma generate`）  
- E2E / 全量 QA：**未重跑**

### Issues Fixed

- Studio 一律「网络异常」（`json()` 抛错 / 单接口失败拖垮 `Promise.all`）  
- 漫画分镜「少一页即失败」、格子不齐导致配图错位风险  
- 长梗概易 **413**（默认上限过小）

### Next

- 见 **`NEXT_ACTION.md`**：Prisma generate → Studio / 漫画短篇验证

---

## （历史）初始化

Completed:

- 记忆目录已创建，待首次深度扫描后填充

Changed Files:

- （见 `iterations/2026-05-16.md` 全自动迭代）

---

## 2026-05-23 — Godot 塔防精灵贴图修复 + 知识库整理

Completed:

- 修复 Godot 塔防中塔（植物/豌豆射手）显示默认几何造型的问题
  - 根因：`player.png` purpose "主角 守护者" 被分到 protagonist，towerSkins 为空
  - 修复 1：`writeGodotReferenceAssets` 双向 fallback（protagonist ↔ towerSkins 共享纹理）
  - 修复 2：新增 `adjustAiSpritePurposesForTemplate`，`towerDefense` 模板下 player.png 改为 "防御塔 植物 豌豆射手"
  - 修复 3：`GODOT_RUNTIME_BUILD_REV` 递增使旧缓存失效
- 修复 Node.js 僵尸进程：`run-dev.mjs` 移除 `shell:true`，改为直接 spawn
- 修复 `game_audio.gd`：`DisplayServer.is_headless()` 不存在 → `get_name() == "headless"`
- 修复 `game_audio.gd`：`var scale` 冲突 → `arp_scale`
- 前端 saveAndPlay 等待精灵生成完成后再跳转
- 知识库整理：更新 CURRENT_STATUS.md、DECISIONS.md、SESSION_LOG.md

Changed Files:

- `src/lib/godot-export-refs.ts`
- `src/lib/godot-export-workspace.ts`
- `godot-templates/ai-mother-universal/scripts/autoload/game_audio.gd`
- `scripts/run-dev.mjs`
- `src/app/create/CreateClient.tsx`
- `src/lib/godot-export.ts`
- `PROJECT_MEMORY/*`

Test Results:

- `npx tsc --noEmit`：**通过**（会话内）
- E2E / 全量 QA：**未重跑**

Issues Fixed:

- Godot 塔防塔无 AI 精灵贴图（显示默认几何造型）
- Node.js 僵尸进程崩溃（1414 个进程占满内存）
- Godot Web 导出 500 错误（GDScript `is_headless` 不存在、`scale` 变量冲突）

Next:

- 用户验证 Godot 塔防贴图是否正常显示
- 如需：微调 UI（金币/怪物/地图参数调节）
- 如需：排查 Phaser 侧贴图尺寸问题

