# CURRENT_STATUS

更新时间：**2026-06-14**

## 架构对齐（Astrocade 平台）

| 层 | 技术 | 默认 |
|----|------|------|
| Primary | Phaser 专用 Scene | ✅ 样品 / 用户 / 克隆 同路由 |
| Secondary | Godot 3D 母版 | Web 导出 / 11 模板 3D |
| Advanced | Agentic LLM | `AGENTIC_FORCE_LLM=1` 可选 |

**入口**：`src/lib/astrocade-architecture.ts`  
**门禁**：`npm run qa:architecture-parity`

## 竞品克隆可玩度（2026-06-15 迭代三十二）

| 能力 | 状态 |
|------|------|
| `action-visual.ts` | Physics/Strategy/Chess/定制/射击视觉层 |
| Smash / State Conquest / Chess / Sniper / Orbit | ✅ 场景接入 + 17 款 theme 配色齐 |
| 累计视觉层 | `farming-visual` + `puzzle-visual` + `action-visual` |
| 实机玩法交互 QA | ✅ **17/17** |
| 生产部署 | ⬜ 需 commit + push → `deploy-prod-playability-fix.py` |

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
