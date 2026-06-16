更新时间：**2026-06-17**（迭代四十五 · 语义化 Juice 横向推广 ✅）

## 迭代四十五（当前）

1. ✅ **Platformer / Farming / Puzzle 接入语义 feedback**
   - `PlatformerScene`：收集、受伤、护盾、胜负结算、boss/炸弹技能、章节切换改走 `juicePickup` / `juiceHit` / `juiceBoss` / `juiceWin` / `juiceFail`。
   - `FarmingScene`：播种、浇水、收获连击、丰收结算改走 `juicePickup` / `juiceCombo` / `juiceWin`，金币不足走 `juiceHit`。
   - `PuzzleScene`：match3 命中/错误、找不同、记忆翻牌、拼图落位、胜负结算改走语义 feedback。
2. ✅ **新增防回退契约**
   - 新增 `qa:platformer-semantic-juice`
   - 新增 `qa:farming-semantic-juice`
   - 新增 `qa:puzzle-semantic-juice`
   - 全部接入 `qa:b-tier-smoke`。
3. ✅ **验证**
   - `npm run qa:platformer-semantic-juice` ✅
   - `npm run qa:farming-semantic-juice` ✅
   - `npm run qa:puzzle-semantic-juice` ✅
   - `npm run qa:b-tier-smoke` ✅ **37/37**
   - `npm run build` ✅
   - Edited-file lints：无错误
4. ⬜ **下一步**
   - 阶段二剩余：单独处理 `TowerDefenseScene`，把造塔、击杀、漏怪、波次、胜负反馈收敛到语义 feedback。
   - 阶段三：统一 HUD/目标引导层，解决“看起来像调试模板”的问题。

---

更新时间：**2026-06-17**（迭代四十四 · 语义化 Juice 试点 ✅）

## 迭代四十四（当前）

1. ✅ **语义化反馈 preset**
   - `gameJuice.ts` 新增 `resolveJuicePreset()` 与语义封装：`juicePickup` / `juiceHit` / `juiceCombo` / `juiceBoss` / `juiceWin` / `juiceFail`。
   - preset 区分 pickup、hit、combo、boss、win、fail 的粒子数、shake 强度、flash 时长、floater 前缀。
   - 新增 `qa:juice-semantic-presets`，断言语义反馈层级不退化。
2. ✅ **Scene 试点接入**
   - `PhysicsScene`：点击命中、连击、胜利改走 `juiceHit` / `juiceCombo` / `juiceWin`。
   - `PlayScene`：收集、受伤、护盾、boss 入场/阶段/受击/击杀、胜负结算接入 `juicePickup` / `juiceHit` / `juiceBoss` / `juiceWin` / `juiceFail`。
   - `ShooterScene`：敌人受击、爆炸、玩家受伤、护盾、炸弹技能、胜负结算接入语义反馈。
3. ✅ **防回退契约**
   - 新增 `qa:physics-semantic-juice`
   - 新增 `qa:play-scene-semantic-juice`
   - 新增 `qa:shooter-semantic-juice`
   - 全部接入 `qa:b-tier-smoke`。
4. ✅ **验证**
   - `npm run qa:juice-semantic-presets` ✅
   - `npm run qa:physics-semantic-juice` ✅
   - `npm run qa:play-scene-semantic-juice` ✅
   - `npm run qa:shooter-semantic-juice` ✅
   - `npm run qa:b-tier-smoke` ✅ **34/34**
   - `npm run build` ✅
   - Edited-file lints：无错误
5. ⬜ **下一步**
   - 继续阶段二横向推广：`PlatformerScene` / `TowerDefenseScene` / `FarmingScene` / `PuzzleScene` 接入语义 feedback。
   - 阶段三：统一 HUD/目标引导层，解决“看起来像调试模板”的问题。

---

更新时间：**2026-06-17**（迭代四十三 · 游戏质量跃迁第一阶段 ✅）

## 迭代四十三（当前）

1. ✅ **非样品用户生成质量门禁**
   - 新增 `qa:non-sample-game-quality`：覆盖 collector / shooter / towerDefense / physics / farming 五类普通用户 prompt。
   - 断言非样品 spec 经 `applyHardQualityDefaults()` 后必须通过 orchestration lint，且至少有 4 幕、3 个运行时事件、主动技能、4 个 powerup、商业表现档。
   - 已接入 `qa:b-tier-smoke`。
2. ✅ **商业表现档进入 GameSpec**
   - `GameSpec.presentation` 新增 `qualityTier: minimal | standard | showcase`。
   - `withPresentationDefaults()` 对用户新建默认补 `qualityTier=standard`，避免非样品路径继续落到“低配模板”。
   - `describeCohesiveExperience()` 展示 tier，方便开发态一眼确认共享体验层是否生效。
3. ✅ **非样品硬质量兜底加强**
   - `game-quality.ts` 新增 commercial director 兜底：非样品路径至少具备奖励窗 / 限时目标 / 高压段这类可观察事件。
   - `systems.ts` 保底 4 个 powerup，避免局内道具密度太低。
4. ✅ **juice 反馈按表现档放大**
   - `gameJuice.ts` 新增 `resolveSharedJuiceStyle()`，由 `qualityTier` 分级影响 shake / burst / floater / flash。
   - 新增 `qa:juice-quality-tier`，断言 `showcase > standard > minimal` 的反馈强度阶梯。
   - 已接入 `qa:b-tier-smoke`。
5. ✅ **验证**
   - `npm run qa:non-sample-game-quality` ✅
   - `npm run qa:juice-quality-tier` ✅
   - `npm run qa:game-quality-contracts` ✅
   - `npm run qa:b-tier-smoke` ✅ **30/30**
   - `npm run build` ✅
   - Edited-file lints：无错误
6. ⬜ **下一步**
   - 继续阶段二：把语义化 juice preset（hit / pickup / combo / boss / win / fail）接入 `PlayScene` / `PhysicsScene` / `ShooterScene` 试点。
   - 之后做统一 HUD/目标引导层，避免用户打开后仍像调试模板。

---

更新时间：**2026-06-17**（迭代四十二 · 构建追踪治理 + 提交前整理 ✅）

## 迭代四十二（当前）

1. ✅ **构建追踪治理**
   - 新增 `src/lib/public-path.ts`，统一本地 `public/` 运行时资产路径，避免服务端模块到处直接 `path.join(process.cwd(), "public", ...)`。
   - `next.config.ts` 增加 `outputFileTracingExcludes`，排除 `public/**/*`、`qa-output/**/*`、`workspaces/**/*`、`data/**/*.log` 这类运行时/QA 产物进入 server trace。
   - 覆盖封面、小说封面、漫画角色参考、游戏背景/sprite、Godot 导出、blob-store 等直接 public 路径。
2. ✅ **QA 契约**
   - 新增 `qa:next-trace-config`：断言 Next output tracing 排除项存在。
   - 新增 `qa:public-path-contracts`：断言 `src/` 内不再直接拼 `process.cwd()/public` 或 `repoRoot()/public`。
   - 两个契约均纳入 `qa:b-tier-smoke`。
3. ✅ **验证**
   - `npm run qa:next-trace-config` ✅
   - `npm run qa:public-path-contracts` ✅
   - `npm run qa:b-tier-smoke` ✅ **28/28**
   - `npm run build` ✅（Turbopack broad-pattern warnings 从 39 → 19 → **0**）
   - Edited-file lints：无错误
4. ⚠️ **已知验证限制**
   - `npx tsc --noEmit` 仍被既有 `e2e/*.spec.ts` 类型问题挡住（agenticModule / Page / APIRequestContext 等），非本轮 public-path 改动引入。
   - `npm run lint` 在本地扫描长期无输出，已停止；本轮依赖 `ReadLints` + build + 契约验证。
   - 为消除 Turbopack 误追踪，对运行时动态文件访问补充 `/*turbopackIgnore: true*/`：封面字体读取、小说/漫画/游戏生成资产、Godot workspace、AI sprite 引用读取。
5. ⬜ **未收口**
   - 工作区 `git status` 输出已超过 1MB；提交前仍需筛选源码、QA 报告、截图/PNG 等哪些纳入 commit。
   - 尚未 commit / push / deploy，生产 6666 尚未复验。

**下一步**：做一次提交前审阅，优先纳入源码、脚本、项目记忆与必要 QA summary；谨慎筛选大体积截图/贴图/报告，然后 commit → push → deploy → 生产 `qa:prod-sample-play-audit` + `COMPETITOR_CLONE_BATCH=all` + 文学/漫画冒烟。

---

更新时间：**2026-06-17**（迭代四十一 · 三线风险修复 + 验证 ✅）

## 迭代四十一（当前）

1. ✅ **游戏线风险修复**
   - `qa:competitor-gates` 的 clone batch 结果改为结合子报告 `qa-output/competitor-clone-batch/summary.json` 判定，避免 Windows `execSync`/Playwright 假挂误杀。
   - `game-quality.ts` 同步 farming 双轨经济：硬质量底座抬高 `gameplay.startingCoins` 后同步 `farming.startingCoins`，避免用户新生成 farming 游戏规格与运行时开局金币不一致。
   - 新增 `qa:game-quality-contracts` 并纳入 `qa:product-lines:game` / `qa:b-tier-smoke`。
2. ✅ **小说线风险修复**
   - 新增 `literary-safety`：公开列表/详情统一只允许非 owner 读取 `visibility=public && status=ready`。
   - 长篇生成中草稿默认 `hidden`，避免 `draft_generating` 空壳泄漏到发现页。
   - `resumeNovelId` 续跑不再重复消耗首次小说生成额度。
   - 新增 `qa:literary-safety-contracts` 并纳入 `qa:product-lines:novel` / `qa:b-tier-smoke`。
3. ✅ **漫画线风险修复**
   - 同步 `POST /api/comic/[id]/panels` 补齐 `comicPanels` quota gate，与 SSE stream 路由一致。
   - 复审发现 quota gate 不能早于归属校验/完成态 no-op；已调整 sync + stream 路由顺序，避免不存在/非本人/已满格请求误扣额度。
   - `storyboardSource=emergency` 返回 `storyboardWarning`，不再静默低质降级。
   - panels stream / sync API 对部分完成返回 `resumeHint`，明确长篇配图可续跑。
   - 新增 `qa:comic-safety-contracts` 并纳入 `qa:product-lines:comic` / `qa:b-tier-smoke`。
4. ✅ **验证**
   - `npm run qa:game-quality-contracts` ✅
   - `npm run qa:literary-safety-contracts` ✅
   - `npm run qa:comic-safety-contracts` ✅
   - `npm run qa:product-lines:game` ✅（含 E2E）
   - `npm run qa:product-lines:novel` ✅（含 E2E）
   - `npm run qa:product-lines:comic` ✅（含 E2E）
   - `npm run qa:product-lines` ✅（三线汇总包含 game / novel / comic）
   - `npm run qa:b-tier-smoke` ✅ **26/26**
   - `npm run build` ✅
6. ✅ **报告收口**
   - 修复单线 `qa:product-lines:comic|novel|game` 覆盖三线总汇总的问题；现在只有全量 `qa:product-lines` 写 `qa-output/product-lines/summary.json`。
   - 新增 `qa:product-lines-summary-contracts` 并纳入 `qa:b-tier-smoke`。
7. ⬜ **未收口**
   - 工作区仍包含迭代四十的旗舰 AI PNG、共享表现层、Scene 收口、QA 产物及本轮三线修复；尚未 commit / push / deploy。
   - 生产 6666 尚未复验迭代四十/四十一改动。

**下一步**：做一次代码审阅/选择要纳入提交的 QA 产物，然后 commit → push → deploy → 生产 `qa:prod-sample-play-audit` + `COMPETITOR_CLONE_BATCH=all` + 文学/漫画冒烟。

更新时间：**2026-06-16**（迭代四十 · 本地调试优先）

## 迭代四十（当前）

1. ✅ 旗舰 5 款 AI 贴图本地生成（`seed:flagship-ai-sprites`，未 commit / 未推生产）
2. ✅ **parity / 克隆根因修复**（重启后 strict **17/17 + 克隆 5/5** 复验通过）：
   - `variantId` 回退 + `GamePlayerInner` canonical prompt
   - `duplicate` 走 `prepareGameSpecForPersist` 持久化 canonical spec
   - parity 每款独立 Playwright page + session 清理（防页面污染）
   - `ShooterScene` orbit 障碍确定性 seed（已移除 physics.pause，不影响试玩）
   - `seed:sample-assets` 跳过已有旗舰 5 款 AI 贴图
3. ✅ gameplay interaction **17/17**
4. ✅ 本地 `qa:competitor-gates` 实质全绿（parity/clone/gameplay/Godot 均 PASS；`cloneBatchOk` 曾误报 false → 已修 `execSync` 15min 超时 + `writeFinalSnap`）
5. ✅ **硬质量底座**：`game-quality.ts` + 生成 / 保存 / 补丁 / enrich 四条链路兜底，未来用户生成游戏也会自动补齐主题、节奏、技能与数值底线
6. ✅ **共享表现层可见化**：`cohesive-presentation` 状态带 + `gameJuice` 全局强化 + `gameSoundscape`/`webBleeps` 默认音画反馈升级 + 启动 banner 摘要
7. ✅ **Scene 收口**：12 个主要 Scene 统一接入 `buildSceneCohesion()`，不再各自手写共享气质与短反馈音色初始化
8. ✅ **启动链收口**：`createPhaserGame` 改为统一入口，启动 banner / 共享气质 / 短反馈音色均走同一协议
9. ✅ 关键回归：`qa:sample-gameplay-interaction` **17/17**、`qa:competitor-parity-validation` **17/17+克隆5/5**、`qa:competitor-clone-batch` **all 17/17**（2026-06-16T15:51）；Windows 子进程假挂 → `process.exit(0)` 收口
10. ✅ `qa:competitor-gates` 全量 wrapper **全绿**（2026-06-16T16:27 · `e2eAllOk=true` · 约 33min）
11. ⬜ **一轮** commit（含旗舰 AI PNG + 上述修复 + 硬质量底座 + 共享表现层升级 + Scene / 启动链收口 + QA 退出收口）+ push + deploy
11. P3：Console SSO

**下一步**：如果你要，我可以继续把 `HudBanner` / `gameSoundscape` 再收薄一点，或者直接做 commit 收口。

更新时间：**2026-06-16**（迭代三十九 · sprite 深度渲染）

更新时间：**2026-06-16**（迭代三十八 · 生产 sprite + 17/17 ✅）

## 迭代三十八（当前）

1. ✅ `ad87851` + `e8e9cee` — 程序化贴图 · blocky-sniper QA 边界
2. ✅ 生产 `qa:prod-sample-play-audit` **17/17**
3. ✅ 生产 clone batch **17/17** · 本地 `qa:competitor-gates` 待跑
4. P3：Console SSO · 旗舰文生图贴图（可选 RUN_REAL_IMAGE_GEN）

更新时间：**2026-06-15**（迭代三十七 · 生产 17/17 ✅）

## 迭代三十七（生产闭环）

1. ✅ `451cee8` 部署 @6666
2. ✅ `qa:prod-sample-play-audit` **17/17**
3. ✅ `COMPETITOR_CLONE_BATCH=all` @prod **17/17**
4. ✅ P2：`seed:sample-assets` 旗舰 5 款 rich 贴图 + 背景 · `competitor-gates` 本地全绿（固定 PLAYWRIGHT_BASE_URL=8888）
5. 注意：全量 Playwright 串行偶发假失败；勿残留 `PLAYWRIGHT_BASE_URL=6666` 跑本地门禁

更新时间：**2026-06-15**（迭代三十七 · 本地 17/17 玩法+克隆 ✅）

更新时间：**2026-06-15**（迭代三十一 · 样品可玩性视觉升级 ✅）

更新时间：**2026-06-15**（迭代三十 · 宋辽满格+精选 ✅）

更新时间：**2026-06-14**（迭代二十九 · 全链路收口 ✅）

更新时间：**2026-06-14**（迭代二十八 · 竞品克隆批量门禁 ✅）

更新时间：**2026-06-14**（迭代二十七 · 竞品克隆三件套 ✅）

更新时间：**2026-06-14**（迭代十九 · QA 工程化 ✅）

更新时间：**2026-06-14**（迭代二十一 · 宋辽 QA 产物链 ✅）

更新时间：**2026-06-14**（迭代二十二 · 缓存解析 + 链式 QA ✅）

更新时间：**2026-06-15**（迭代三十二 · 全 17 款 action 视觉层 ✅）

更新时间：**2026-06-15**（迭代三十三 · Platformer+Coaster 视觉 ✅）

更新时间：**2026-06-15**（迭代三十五 · AI patch QA + 竞品基线 ✅）

更新时间：**2026-06-15**（迭代三十四 · 生产上线 cb03358 ✅）

## 迭代三十五：AI patch 实机 + 竞品截图基线

| 项 | 交付 |
|----|------|
| `qa:sample-ai-patch-audit` | 健康 / 拉规格 / POST patch / 试玩页 UI 四步验收 |
| 生产 patch | API 改 `gameplay.startingCoins=200` · UI 清空输入无报错 |
| 种田同步缺口 | LLM 未改 `farming.startingCoins` · 本地 `syncFarmingStartingCoins` 已补 |
| 竞品 batch @prod | **17/17 PASS** · `COMPETITOR_CLONE_BATCH=all` |
| 脚本 | `competitor-clone-batch` IPv4 health + 6666 Playwright + 远程跳过 seed |

**下一步**：主人 refine 链路生产抽测 · 用户肉眼抽测

## 迭代三十五（闭环）：deploy `271dd39` + patch 全绿

| 项 | 交付 |
|----|------|
| commit | `271dd39` fix(patch): 种田金币同步 + AI patch 生产验收脚本 |
| 生产 | http://43.163.105.71:6666 · health ok |
| `qa:sample-ai-patch-audit` | **4/4** · `farming.startingCoins=200` |
| `qa:competitor-clone-batch` all | **17/17** @ prod（上轮已验） |

## 迭代三十四：提交 + 生产部署

| 项 | 交付 |
|----|------|
| commit | `cb03358` feat(playability): 17 款样品视觉与手感全面升级 |
| 生产 | http://43.163.105.71:6666 · health ok · PORT=6666 |
| prod QA | `qa:prod-sample-play-audit` **17/17** |

生产试玩：`/play/sample-grow-a-garden` · `/play/sample-color-bloom` · `/play/sample-elastic-thief-2`

**下一步**：AI 修改链路实机验收 · 竞品截图基线更新 · 用户肉眼抽测

## 迭代三十三：Elastic Thief + 过山车/公路强化

| 项 | 交付 |
|----|------|
| `action-visual` 扩展 | 金库潜行背景、脉冲激光、主题天空、立体车厢、公路障碍车 |
| `PlatformerScene` | Elastic Thief 金库场景 + 宝藏光晕 + 激光脉冲 |
| `CoasterScene` | Rail in Air / Crashy Roads 主题渐变 + 立体车厢 + 公路虚线/障碍车 |
| QA | **17/17** |

试玩：`/play/sample-elastic-thief-2` · `/play/sample-rail-in-air` · `/play/sample-crashy-roads`

## 迭代三十二：action-visual 全覆盖剩余样品

| 项 | 交付 |
|----|------|
| `action-visual.ts` | 沙袋场、策略地图、象棋演播室、汽车/陶艺、环绕星球、狙击镜 |
| Scene 接入 | Physics / Strategy / Chess / Customization / Shooter |
| `registry.ts` | **17/17** 样品独立 theme 配色 |
| QA | `qa:sample-gameplay-interaction` **17/17** |

试玩：`/play/sample-smash-the-dummy` · `/play/sample-state-conquest` · `/play/sample-blocky-sniper-hunter`

## 迭代三十一：17 款样品可玩性视觉升级（本地 ✅）

| 项 | 交付 |
|----|------|
| `farming-visual.ts` | 田园背景、分阶段作物、Grow a Garden 种子栏/连收 |
| `puzzle-visual.ts` | Color Bloom 宝石块、Whimsy 插画找不同、Memory emoji、Kids 动物拼图 |
| `TowerDefenseScene` | 合成格 🔫/🗡️ tier 图标 |
| `registry.ts` | 6 款样品主题色 + 作物/经济参数 |
| QA | `qa:sample-gameplay-interaction` **17/17** · `qa:sample-profiles` OK |

试玩：`/play/sample-grow-a-garden` · `/play/sample-color-bloom` · `/play/sample-whimsy-differences`

**下一步**：`git commit` + `push main` → `python scripts/deploy-prod-playability-fix.py`（PORT=6666）

## 迭代三十：宋辽中篇实机复跑 + 发现页精选

| 项 | 交付 |
|----|------|
| 分镜实机 | 8 页 32 格 · **396s** · `cmqekk1ft000113f3f5y8qke8` |
| lib 配图 | **32/32 · 775s** · `full-medium-summary.json` |
| 精选 seed | `seed:comic-featured-songliao` → 发现页 featured API |
| 三线验收 | `qa:product-lines:novel` + `:comic` 离线+E2E 全 OK（`PW_EXTERNAL=1`） |

试看：http://127.0.0.1:8888/comic/cmqekk1ft000113f3f5y8qke8 · 首页/发现精选可见

## 迭代二十九：全链路收口

| 项 | 交付 |
|----|------|
| `qa:competitor-clone-checks-offline` | 17 款离线断言 · CI + b-tier **20/20** |
| `qa:pm-handtest-signoff` | 六模板 + 竞品 PM 自动化签收报告 |
| `qa:competitor-gates` | 接入 `qa:competitor-clone-batch` all=17 |
| 文档 | HISTORICAL #27–29 · CURRENT_STATUS 更新 |

## 迭代二十八：17 款竞品克隆批量对标

| 项 | 交付 |
|----|------|
| `competitor-clone-playability-checks.ts` | 17 款 per-sample 断言 + expectedScene |
| `competitor-clone-screenshots.ts` | 动画场景 burst 采样 · 独立 browser context |
| `qa:competitor-clone-batch` | smoke=8 / all=17 · 报告 `qa-output/competitor-clone-batch/` |
| `inferPuzzleMode` sampleId | whimsy / memory / kids / color-bloom |
| `qa-historical-closure` | dev 在线时跑 smoke batch |
| 实机 | smoke **8/8** · 全量 **17/17** |

## 迭代二十七：竞品克隆可玩度（Crashy + Elastic Thief + Pottery）

| 项 | 交付 |
|----|------|
| `inferPlatformerMode` / `inferCustomizationMode` | `sampleId` 强制 stealth / pottery |
| `PlatformerScene` | 激光束命中检测 + 闪红反馈 |
| `CustomizationScene` | 转盘点击拉坯增高 |
| `qa:platformer-stealth-mode` · `qa:pottery-mode` | 离线断言 · 接入 b-tier **18/18** |
| 实机 clone QA | crashy-roads ✅ · elastic-thief-2 ✅ · pottery-master-3d ✅ |

试玩：`/play/sample-elastic-thief-2` · `/play/sample-pottery-master-3d`

## 迭代二十二：漫画缓存解析 + 分镜→配图链

| 项 | 交付 |
|----|------|
| `listCachedComicRefs` | 按时间倒序 · **优先缺配图** comicId |
| `resolveCachedComicId({ ignoreEnv })` | 避免 shell 残留 `QA_COMIC_RESUME_ID` 覆盖 |
| `syncFullMediumSummaryIfComplete` | 满格后自动写 `full-medium-summary.json` |
| `qa:songliao:medium-chain` | storyboard → panels-resume 一条龙 |

## 迭代二十一：宋辽回归产物链 + env 泄漏修复

| 项 | 交付 |
|----|------|
| `songliao-regression-artifacts.ts` | 缓存 novelId/comicId · 别名报告（storyboard / full-medium / 4tier / resume） |
| `clearLeakedLiteraryQaEnv` | wrapper 清除 shell 残留 `QA_COMIC_RESUME_ID` / `QA_COMIC_PAGES` 等 |
| `qa:songliao:panels-resume` · `qa:songliao:artifacts` | 一键补配图 · 离线断言 |
| 实机 | 8 页分镜 **238s** · pipeline=light · 32 格 → `storyboard-summary.json` |

## 迭代二十：DATABASE_URL 全仓对齐 + CI 门禁

| 项 | 交付 |
|----|------|
| `applyLiteraryQaDatabaseUrl` / `applyQaOfflineDatabaseUrl` | QA 入口统一写入 env |
| `warnLiteraryQaEnv` | lib + ci.sqlite 误配告警 |
| `qa:songliao:storyboard` | 中篇 8 页分镜快测（跳过配图） |
| CI / deploy-preflight / product-lines | 接入 `qa:database-url` + director-pipeline |

验证：`npm run build` · `qa:b-tier-smoke` · `qa:product-lines:comic`

## 迭代十九：DATABASE_URL / 配图 runner 工程化

| 项 | 交付 |
|----|------|
| `src/lib/database-url.ts` | 误配 `file:./prisma/dev.db` 自动纠正；文学 QA / dev 解析 |
| `run-dev.mjs` | shell 残留 `ci.sqlite` 自动改回 `dev.db`（`DEV_ALLOW_CI_DB=1` 可保留） |
| `src/lib/qa/literary-panel-render.ts` | lib / http 配图复用；多轮直到满格 |
| 便捷脚本 | `qa:songliao:novels` · `qa:songliao:comic-full` · `qa:database-url` |
| `docs/local-database.md` | 文学实机命令与 `QA_PANEL_RENDER_MODE` 说明 |

验证：`npm run build` ✅ · `qa:b-tier-smoke` 13/13 ✅ · resume 配图 32/32 ✅

## 迭代十八：中篇默认 8 页仍走 director

| 现象 | 根因 | 修复 |
|------|------|------|
| 宋辽 E2E 中篇→8 页漫画 ~15min+ | `medium` + 8 页 ≥ `directorPipelineMinPages(6)` → `long_director` | **`mediumDirectorMinPages=12`**：中篇默认 8 页走轻量；≥12 页才 director |
| 改编仍多一轮 Brief LLM | `creativeBriefExpand` 对 `from_novel` 也跑 | **`shouldSkipComicBriefExpand`**：有 `novelId` 且无 `briefRevision` 时跳过 |
| 中篇仍跑 preread/blueprint | `shouldBuildAdaptationBlueprint` 阈值过低 | **medium**：≥12000 字且 ≥4 章才建蓝图 |

## 迭代十七：短篇/char-sheet（仍有效）

| 现象 | 根因 | 修复 |
|------|------|------|
| 短篇 4 页漫画 ~7min+ | 中文 4 页强制 `long_director` | 短篇/儿童一律轻量 |
| 分镜 defer 仍卡 char-sheet | 同步文生图人设图 | 延至 `renderComicPanels` |
| 轻量路径仍跑精读/蓝图 | roster 前全量 preread | 轻量仅拉 roster |

## 迭代十八：中篇 8 页轻量分镜（✅ 314s）

| 现象 | 根因 | 修复 |
|------|------|------|
| 中篇 8 页 600s 超时 | 仍走 `long_director` 或轻量 4 页×8 格=32 格 JSON 单次 LLM ~8min | **`mediumDirectorMinPages=12`**；**中篇默认四宫格**；**2 页/批**；**二分降级**替代逐页 180s×N |
| 改编多一轮 Brief | `creativeBriefExpand` 对 `from_novel` 也跑 | **`shouldSkipComicBriefExpand`** |
| 旧 draft Resume 错批大小 | grid_8/4 页批 checkpoint 与新区不兼容 | **layout/pipeline 不匹配则忽略 draft** |
| roster 仍用 raw SQL | 迁移前 Prisma Client 未 generate | **改用 Prisma `characterRosterJson`** |

验证（2026-06-14）：`pipeline=light`，8 页 32 格，314s，无 `QA_SKIP_CHAR_SHEETS`

```powershell
# 分镜路径（跳过配图，~5min）
$env:QA_COMIC_NOVEL_ID="cmqdub6vx0001t1ctchwz59rc"
$env:QA_COMIC_PAGES="8"
$env:SKIP_COMIC_PANELS="1"
npm run qa:songliao-literary-regression

# 离线断言（秒级，CI 可用）
npm run qa:comic-director-pipeline
```

## 待办

| 状态 | 项 |
|------|-----|
| ✅ | 三线独立验收 `qa:product-lines`（离线 + E2E） |
| ✅ | 四档小说实机 — `novels-4tier-summary.json` |
| ✅ | 中篇 8 页全量（分镜 267s + lib 配图 32/32） — `full-medium-summary.json` |
| ✅ | DATABASE_URL 规范化 + dev 防 ci 污染 + 文学配图 runner |
| ✅ | CI/deploy-preflight 接入 database-url · storyboard 快测脚本 |
| ✅ | 8 页分镜实机 238s · env 泄漏修复 · 产物别名报告 |
| ✅ | 分镜+配图链 238s+528s=32/32 · `cmqe2cos2000167xc8zuy9c86` |
| ✅ | 17 款竞品 clone batch + 离线断言 + CI |
| ✅ | 六模板 PM 自动化签收 `qa:pm-handtest-signoff` |
| ✅ | git commit `e098313` — 文学链路 + 竞品 clone 门禁 |
| ⬜ | Console SSO 生产 IdP 联调（需企业 Azure/飞书配置 · 文档已齐） |
| ✅ | 种田 patch 金币同步上线 `271dd39` |
| ✅ | `qa:sample-ai-patch-audit` 生产四步全绿 |
| ⬜ | 六模板章节感 **可选** PM 肉眼抽测（自动化已签收） |
