# CURRENT_STATUS

更新时间：**2026-06-17**（迭代四十五 · 语义化 Juice 横向推广 ✅）

## 迭代四十五：Platformer / Farming / Puzzle 语义反馈接入

| 项 | 结果 | 验证 |
|----|------|------|
| Platformer 横向推广 | 收集、受伤、护盾、boss/炸弹技能、章节切换、胜负结算走语义 feedback；宝箱胜利用 finish 统一反馈 | `qa:platformer-semantic-juice` ✅ |
| Farming 横向推广 | 播种/浇水/金币不足/收获连击/丰收结算收敛到 pickup / hit / combo / win | `qa:farming-semantic-juice` ✅ |
| Puzzle 横向推广 | match3、找不同、记忆翻牌、拼图落位、胜负结算接入 pickup / hit / combo / win / fail | `qa:puzzle-semantic-juice` ✅ |
| B-tier / build | 新增三个语义反馈 contract 后全绿 | `qa:b-tier-smoke` **37/37**、`npm run build` ✅ |

**交付状态**：第二阶段横向推广完成大半；尚未 commit / push / deploy。下一步单独处理 `TowerDefenseScene`，随后进入统一 HUD/目标引导层。

---

更新时间：**2026-06-17**（迭代四十四 · 语义化 Juice 试点 ✅）

## 迭代四十四：语义化反馈接入首批 Scene

| 项 | 结果 | 验证 |
|----|------|------|
| 反馈 preset | `gameJuice.ts` 新增 pickup / hit / combo / boss / win / fail 语义 preset 与封装 | `qa:juice-semantic-presets` ✅ |
| Physics 试点 | 命中、连击、胜利改走语义反馈 | `qa:physics-semantic-juice` ✅ |
| Play 试点 | 收集、受伤、护盾、boss 生命周期、胜负结算改走语义反馈 | `qa:play-scene-semantic-juice` ✅ |
| Shooter 试点 | 敌人受击/爆炸、玩家受伤、护盾/炸弹技能、胜负结算改走语义反馈 | `qa:shooter-semantic-juice` ✅ |
| B-tier / build | 新增四个语义反馈 contract 后全绿 | `qa:b-tier-smoke` **34/34**、`npm run build` ✅ |

**交付状态**：第二阶段试点本地验证通过；尚未 commit / push / deploy。下一步横向推广到 Platformer / TowerDefense / Farming / Puzzle，并开始统一 HUD/目标引导层。

---

更新时间：**2026-06-17**（迭代四十三 · 游戏质量跃迁第一阶段 ✅）

## 迭代四十三：用户非样品生成质量下限

| 项 | 结果 | 验证 |
|----|------|------|
| 非样品质量门禁 | 新增 `qa:non-sample-game-quality`，五类普通用户 prompt 必须具备 director / systems / powerups / presentation tier | `qa:non-sample-game-quality` ✅ |
| 商业表现档 | `GameSpec.presentation.qualityTier` 默认 `standard`，开发态共享体验摘要显示 tier | `npm run build` ✅ |
| 硬质量兜底 | `game-quality.ts` 为非样品补至少 3 个可观察运行时事件；`systems.ts` 保底 4 个 powerup | `qa:game-quality-contracts` ✅ |
| Juice 表现档 | `gameJuice.ts` 按 `minimal/standard/showcase` 调整 shake / burst / floater / flash 强度 | `qa:juice-quality-tier` ✅ |
| B-tier | 新增两个游戏质量 contract 后全绿 | `qa:b-tier-smoke` **30/30** ✅ |

**交付状态**：第一阶段本地验证通过；尚未 commit / push / deploy。下一阶段应把语义化 hit/pickup/combo/boss/win feedback 接入试点 Scene，并继续做 HUD/目标引导统一层。

---

更新时间：**2026-06-17**（迭代四十二 · 构建追踪治理 ✅）

## 迭代四十二：提交前构建追踪与运行时资产路径治理

| 项 | 结果 | 验证 |
|----|------|------|
| 本地 public 资产路径 | 新增 `repoPublicPath()`，收口封面、漫画、游戏 sprite/bg、Godot 导出、blob-store 等直接 `process.cwd()/public` 拼接 | `qa:public-path-contracts` ✅ |
| Next server trace | `next.config.ts` 排除 `public/**/*`、`qa-output/**/*`、`workspaces/**/*`、`data/**/*.log`，避免运行时/QA 产物进入输出追踪 | `qa:next-trace-config` ✅ |
| b-tier 门禁 | 新增两个构建治理契约并接入 b-tier | `qa:b-tier-smoke` **28/28** ✅ |
| build | 通过；Turbopack broad-pattern warnings 从 39 → 19 → **0**，构建输出不再出现 broad-pattern 警告 | `npm run build` ✅ |

**交付状态**：本地验证通过；尚未 commit / push / deploy。提交前仍需筛选大体积 QA 产物、截图、贴图和源码改动。

---

更新时间：**2026-06-17**（迭代四十一 · 三线风险修复 ✅）

## 迭代四十一：游戏 / 小说 / 漫画风险收敛

| 产品线 | 修复 | 验证 |
|------|------|------|
| 游戏 | `competitor-gates` 读取 clone batch 子报告兜底；farming `gameplay.startingCoins` ↔ `farming.startingCoins` 同步 | `qa:game-quality-contracts`、`qa:product-lines:game`、`qa:b-tier-smoke`、`npm run build` ✅ |
| 小说 | 公开列表/详情只读 `public+ready`；生成中草稿默认 hidden；resume 不重复扣首次生成额度 | `qa:literary-safety-contracts`、`qa:product-lines:novel`、`qa:b-tier-smoke`、`npm run build` ✅ |
| 漫画 | panels API 补 quota 且在 owner/no-op 后扣费；emergency 分镜返回 warning；部分配图返回 resumeHint | `qa:comic-safety-contracts`、`qa:product-lines:comic`、`qa:b-tier-smoke`、`npm run build` ✅ |
| QA 报告 | 单线 product-lines 不再覆盖三线总汇总；全量 `qa:product-lines` 才写 aggregate summary | `qa:product-lines-summary-contracts`、`qa:product-lines`、`qa:b-tier-smoke` ✅ |

**交付状态**：本地验证通过；`qa:b-tier-smoke` **26/26**、`qa:product-lines` 三线全绿、`npm run build` ✅。尚未 commit / push / deploy。工作区仍包含迭代四十的旗舰贴图、共享表现层、Scene 收口与 QA 产物。

更新时间：**2026-06-15**（迭代三十五 · AI patch + 竞品基线 ✅）

更新时间：**2026-06-15**（迭代三十四 · 生产上线 cb03358 ✅）

## 架构对齐（Astrocade 平台）

| 层 | 技术 | 默认 |
|----|------|------|
| Primary | Phaser 专用 Scene | ✅ 样品 / 用户 / 克隆 同路由 |
| Secondary | Godot 3D 母版 | Web 导出 / 11 模板 3D |
| Advanced | Agentic LLM | `AGENTIC_FORCE_LLM=1` 可选 |

**入口**：`src/lib/astrocade-architecture.ts`  
**门禁**：`npm run qa:architecture-parity`

## 迭代三十五：AI 修改链路 + 生产竞品截图基线

| 能力 | 状态 |
|------|------|
| `qa:sample-ai-patch-audit` | 新增 · IPv4 HTTP + Playwright 6666 端口白名单 |
| 生产 patch API | ✅ LLM ~5s 返回 · UI 试玩页 patch 无报错 |
更新时间：**2026-06-16**（迭代三十九 · sprite 深度渲染 ✅）

## 迭代三十九：玩法视觉深度优化

| 能力 | 状态 |
|------|------|
| `ShooterScene` | 修复 preload `texPlayer/texHazard` 未被使用的 bug |
| `phaser-loaded-sprites.ts` | 统一缩放 · 样品背景 alpha 0.24 |
| 模板化程序化贴图 | shooter=星舰 · towerDefense=炮塔造型 |
| 玩法审计 | 失败样品自动重试 1 次 |
| 部署 | `seed:sample-assets` 写入生产 deploy 流水线 |

更新时间：**2026-06-16**（迭代三十八 · 生产闭环 ✅）

## 迭代三十八（生产闭环）

1. ✅ `ad87851` 部署 @6666 — 17 款程序化 sprite/bg
2. ✅ `qa:prod-sample-play-audit` **17/17**（`e8e9cee` 修 blocky-sniper Space×5）
3. ✅ `COMPETITOR_CLONE_BATCH=all` @prod **17/17**
4. 本地：`npm run qa:competitor-gates`（~25min · 勿设 PLAYWRIGHT_BASE_URL=6666）

更新时间：**2026-06-15**（迭代三十八 · 样品程序化贴图 + competitor-gates ✅）

## 迭代三十八：旗舰 sprite 贴图 + 门禁稳定性

| 能力 | 状态 |
|------|------|
| `procedural-game-assets.ts` | sharp 离线生成 player/hazard/gem/power/boss + 背景 |
| `npm run seed:sample-assets` | 17 款 + stub · 旗舰 5 款 rich 细节 |
| `qa:competitor-gates` | ✅ 本地全绿（Godot 17/17 · parity · clone · gameplay 17/17） |
| 审计稳定性 | 样品间隔 500ms · canvas 45s · 动画深度二次采样 |
| 门禁修复 | `competitor-gates` 强制 `PLAYWRIGHT_BASE_URL=8888`（避免 6666 ERR_UNSAFE_PORT） |

更新时间：**2026-06-15**（迭代三十七 · 生产 17/17 玩法+克隆 ✅）

## 迭代三十七（生产闭环）：`451cee8` @6666

| 能力 | 状态 |
|------|------|
| commit | `451cee8` fix(qa): QA 状态即时发布 + depthChangePasses undefined→0 |
| 生产 | http://43.163.105.71:6666 · health ok |
| `qa:prod-sample-play-audit` | ✅ **17/17** |
| `qa:competitor-clone-batch` all@prod | ✅ **17/17** |

报告：`qa-output/prod-sample-play-audit/` · `qa-output/competitor-clone-batch/`

更新时间：**2026-06-15**（迭代三十七 · 17/17 全样品玩法深度 + 本地克隆 17/17 ✅）

## 迭代三十七：全 17 款玩法深度 + 克隆视觉修复

| 能力 | 状态 |
|------|------|
| `GAMEPLAY_DEPTH_BY_SAMPLE` | ✅ **17/17** 字段映射 |
| 各 Phaser Scene | `__PHASER_QA_STATE__` 持续发布（update/交互） |
| `runtime-seed.ts` | duplicate 改 title 不漂移 RNG（variantId 锚定） |
| `qa:sample-gameplay-interaction` | ✅ 本地 **17/17**（独立进程跑，避免并行 Playwright 抢 dev） |
| `qa:competitor-clone-batch` all@local | ✅ **17/17** · animated 样品 12 帧 burst |
| 塔防 merge | `onMergeCellClick` 计入 QA 深度 |
| 审计稳定性 | 每样品独立 browser page · `SAMPLE_AUDIT_IDS` 过滤 |

报告：`qa-output/sample-gameplay-interaction/` · `qa-output/competitor-clone-batch/`

更新时间：**2026-06-15**（迭代三十六 · QA 深度 + 阈值收紧 ✅）

## 迭代三十六：玩法深度断言 + 视觉阈值收紧

| 能力 | 状态 |
|------|------|
| `__PHASER_QA_STATE__` | 旗舰 5 款暴露金币/分数/距离等运行时状态 |
| `qa:gameplay-depth-offline` | 深度字段与用例对齐离线门禁 |
| 视觉阈值 | 克隆默认 diff≤8% · 旗舰 5 款 ≤5% |
| 稳定性 | API 重试 · 样品间隔 450ms · migration P3009 自愈 |
| commit | `fd15084` 已 push + 部署 |
| `qa:competitor-clone-batch` all@prod | ✅ **17/17** · diff 0.4%–4.4% |
| 脚本修复 | `competitor-clone-batch` IPv4 health · 远程跳过本地 seed |

报告：`qa-output/sample-ai-patch-audit/` · `qa-output/competitor-clone-batch/`

## 竞品克隆可玩度（2026-06-15 迭代三十二）

| 能力 | 状态 |
|------|------|
| `action-visual.ts` | Physics/Strategy/Chess/定制/射击视觉层 |
| Smash / State Conquest / Chess / Sniper / Orbit | ✅ 场景接入 + 17 款 theme 配色齐 |
| 累计视觉层 | `farming-visual` + `puzzle-visual` + `action-visual` |
| 实机玩法交互 QA | ✅ **17/17** |
| 生产部署 | ✅ `cb03358` @ http://43.163.105.71:6666 · prod QA **17/17** |

## 竞品克隆可玩度（2026-06-15 迭代三十一）

| 能力 | 状态 |
|------|------|
| Grow a Garden 田园视觉 + 种子栏 + 连收 | ✅ `farming-visual.ts` + `FarmingScene` |
| Color Bloom / Whimsy / Memory / Kids 益智强化 | ✅ `puzzle-visual.ts` + `PuzzleScene` |
| 塔防合成枪械/剑塔图标 | ✅ `TowerDefenseScene` merge tier |
| 实机玩法交互 QA | ✅ **17/17** @ localhost:8888 |
| 生产部署 | ⬜ 需 **commit + push main** 后跑 `deploy-prod-playability-fix.py` |

## 竞品克隆可玩度（2026-06-14）

| 能力 | 状态 |
|------|------|
| 17 款样品 per-sample 断言 | ✅ `competitor-clone-playability-checks.ts` |
| 实机 batch duplicate + 视觉 | ✅ smoke 8/8 · 全量 17/17 |
| 离线断言（CI） | ✅ `qa:competitor-clone-checks-offline` |
| nightly gates | ✅ `qa:competitor-gates` 含 batch all |

报告：`qa-output/competitor-clone-batch/REPORT.md`

## 文学生产链（2026-06-14）

| 能力 | 状态 |
|------|------|
| 五步工作链 + Studio 追踪 | ✅ |
| 邮箱注册 MVP | ✅（dev 用 `EMAIL_AUTH_DEV_EXPOSE=1`） |
| 角色 roster 服务端持久化 | ✅ Prisma 优先 + raw 回退 |
| 中篇 8 页漫画轻量分镜 | ✅ 314s |
| 四档小说 + 漫画实机全量 | ✅ storyboard 238s + lib 配图 528s · 32/32 |
| DATABASE_URL 规范化 | ✅ `src/lib/database-url.ts` |

**离线门禁**：`qa:b-tier-smoke` **20/20** · `qa:historical-closure` · `qa:pm-handtest-signoff`

## 不变量

- `dedicatedSceneForTemplateFirst` + `normalizeAstrocadePlaySpec`
- 蓝图自包含 specJson（无 runtime `SAMPLE_MODES`）
- 全 `GAME_TEMPLATE_IDS` 在 template-first 列表
- 中篇默认 8 页走轻量分镜（`mediumDirectorMinPages=12`）

## 样品馆

17 款 Astrocade 灵感样品 · seed + 专用 Scene 路由 · clone 可玩度全绿

## 文档

- `docs/astrocade-architecture-parity-cn.md`
- `docs/admin-console-sso.md`（生产 IdP 待企业配置）
- `PROJECT_MEMORY/HISTORICAL_ISSUES_CLOSURE.md`
