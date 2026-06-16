# CURRENT_STATUS

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
