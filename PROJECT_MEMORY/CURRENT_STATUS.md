# CURRENT_STATUS

更新时间：**2026-06-18**（迭代一百零四 · Staging Bench + Comfy 精灵 + BGM 槽 ✅）

## 迭代一百零四（当前）

| 项 | 结果 |
|----|------|
| Staging | `STAGING=1` 默认 Browser Bench + repair；`.env.staging.example` |
| Comfy 精灵 | 256 预览 → sharp 512；`GAME_SPRITE_COMFY` |
| BGM | `public/game-bgm/*.ogg` ×5 · `seed:game-bgm-slots` |
| Phase B | `qa:opengame-cli-live`（fixture 回退） |
| QA | staging-env ✅ · comfy-sprite ✅ · build ✅ |

---

更新时间：**2026-06-18**（迭代一百零三 · Phase D 视听 + 三阶段缺口收口）

## 迭代一百零三

| 项 | 结果 |
|----|------|
| Phase D | Brief→资产 prompt · 并行精灵 · 自动封面 · BGM 槽 |
| Phase A | E2E `platform-complex-agentic.smoke` |
| Phase C | `qa:sample-behavior-signoff` |
| QA | brief-asset-cohesion ✅ · build ✅ |

---

更新时间：**2026-06-18**（迭代一百零二 · 平台测试生成闭环 ✅）

## 迭代一百零二

| 项 | 结果 |
|----|------|
| 平台 QA | `qa:platform-test-generate` 简单 dedicated + 复杂 Agentic **2/2** |
| 入库修复 | `coerceGameSpec` 保留 agentic 字段；canonical 写回强化 |
| 测试用户 | ownerKey=`platform-test-user`；报告 `qa-output/platform-test-generate/` |
| QA | agentic-persist-coerce ✅ · platform-test-generate ✅ |

---

更新时间：**2026-06-17**（迭代一百零一 · Phaser.Scene bridge + P0 polish ✅）

## 迭代一百零一

| 项 | 结果 |
|----|------|
| Phase B | `Phaser.Scene` → `createGame` 桥接 + fixture `phaser-scene` |
| P0 消消乐 | 关间 ⭐ 飞入顶栏关卡位动画 |
| P0 神庙 | 死亡 3s 倒计时提示 + QA `templeDeathCountdown` |
| QA | cli-bridge ✅ · temple-death-flow ✅ · build ✅ |

---

更新时间：**2026-06-17**（迭代一百 · CLI→Agentic bridge ✅）

## 迭代一百

| 项 | 结果 |
|----|------|
| Phase B bridge | `opengame-cli-bridge.ts`：多文件 JS → 单文件 `createGame` Agentic 模块 |
| 生成管线 | `OPENGAME_CLI_BRIDGE=1` + CLI 成功 → `source: opengame_cli`（Debug Skill 门禁） |
| QA | cli-bridge ✅ · sample-parity 14/14 · opengame-skills ✅ · build ✅ |

---

更新时间：**2026-06-17**（迭代九十九 · Phase C 全量 hook + Phase B CLI spike ✅）

## 迭代九十九

| 项 | 结果 |
|----|------|
| Phase C | **14/14** 样品 Scene hook 试点（补全 4 款棋类） |
| Phase B | `opengame-cli.ts` 子进程 spike + orch trace + dry-run QA |
| 生成管线 | 复杂 prompt + `OPENGAME_CLI=1` → `opengame_cli_spike` 观测 |
| QA | sample-parity 14/14 · opengame-skills ✅ · cli-spike ✅ · build ✅ |

---

更新时间：**2026-06-17**（迭代九十八 · Phase C 扩展 + dedicated Debug lint ✅）

## 迭代九十八

| 项 | 结果 |
|----|------|
| generation-trace | OpenGame SSE recap（tier / agentic / browser bench） |
| Phase C | `template-sample-parity` 14 款对照 + **10 款** Scene hook 试点 |
| Phase A | dedicated 路由 `lintDedicatedRouteDebugSkill` → orch `opengame_dedicated_debug_lint` |
| 工程 | `template-sample-parity` 移出 barrel export（消除 NFT trace）；build ✅ |
| QA | sample-template-skill-parity **14/14** · opengame-skills ✅ · build ✅ |

---

更新时间：**2026-06-17**（迭代九十七 · refine 路由重算 + 创作台试玩引擎提示 ✅）

## 迭代九十七

| 项 | 结果 |
|----|------|
| refine attach | 重算 `agenticPlayRoute`；dedicated 剥离 agenticModule |
| 创作台 | SSE recap 展示试玩引擎（dedicated / Agentic） |
| refine API | 返回 `agenticPlayRoute` |
| QA | opengame-skills ✅ · build ✅ |

---

更新时间：**2026-06-17**（迭代九十六 · OpenGame 试玩路由接入用户管线 ✅）

## 迭代九十六

| 项 | 结果 |
|----|------|
| 试玩路由 | `agenticPlayRoute` + `resolveAgenticPlayRoute`（默认 complex_only） |
| 用户复杂 prompt | attach Agentic + OpenGame Skills；试玩保留 agenticModule |
| Browser Bench | 可选挂进 `generateAgenticGameModule`（`OPENGAME_BROWSER_BENCH=1`） |
| QA | opengame-skills ✅ · build ✅ |

---

更新时间：**2026-06-17**（迭代九十五 · OpenGame Browser Bench 闭环 ✅）

## 迭代九十五

| 项 | 结果 |
|----|------|
| Browser Bench | payload 解码 + scene 探测修复；**2/2 PASS** |
| OpenGame Skills | Debug + Template + 复杂度路由 + astrocade 流水线接入 |
| QA | opengame-skills ✅ · agentic-template-matrix **16/16** ✅ |

---

更新时间：**2026-06-17**（迭代九十二 · 样品 14 款 + 消消乐三关 ✅）

## 迭代九十二

| 项 | 结果 |
|----|------|
| 样品馆 | **14 款**商业保留；9 款已下架 + DB 清理 |
| 消消乐 | 三关递进 + 三目标胜利 + 关间道具奖励 |
| QA | build + offline **14/14** + gameplay **14/14** ✅ |

---

更新时间：**2026-06-17**（迭代六十五 · 神庙 near-miss + 连击 + 视差 ✅）

## 迭代六十五

| 项 | 结果 |
|----|------|
| Near-miss | 邻道擦边提示 |
| 金币连击 | streak xN + bonus 分 |
| 视差氛围 | 藤蔓 / 萤火虫 / 车道光晕 |
| QA | build + board + 神庙互动 ✅ |

---

更新时间：**2026-06-17**（迭代六十四 · HudGoalPanel + 神庙 v5 ✅）

## 迭代六十四

| 项 | 结果 |
|----|------|
| CoasterScene 目标卡 | HudGoalPanel + 神庙/endless 引导文案 |
| 神庙 v5 | 车道虚线、金币 spin、猿猴追兵 |
| QA | hud-goal + scene-guidance + board ✅ · build ✅ |

---

更新时间：**2026-06-17**（迭代六十三 · 样品馆 UX + 神庙 v4 + 封面刷新 ✅）

## 迭代六十三

| 项 | 结果 |
|----|------|
| photoCover | 6 款展示样品卡片改为真实截图布局 |
| 神庙 v4 | 残柱、夕阳 vignette、尘土、跑者 v4、金币串 |
| 封面 | 6 款 PNG 从试玩重截 |
| QA | **23/23** 互动 · board contract ✅ · build ✅ |

---

更新时间：**2026-06-17**（迭代六十二 · seed 23 + 封面工具 + 神庙 polish ✅）

## 迭代六十二

| 项 | 结果 | 验证 |
|----|------|------|
| 神庙 polish | 得分脉冲、金币相机 zoom、弯道加强 | build ✅ |
| 封面工具 | `capture:sample-covers`；神庙 PNG 已更新 | 脚本 ✅ |
| 样品 DB | 本地 23 项目 upsert | seed + db-sync **23/23** ✅ |
| QA | board contract 扩展 | ✅ |

---

更新时间：**2026-06-17**（迭代六十一 · 全量 QA 23/23 + 神庙 v3 视觉 ✅）

## 迭代六十一：QA 闭环与神庙 polish

| 项 | 结果 | 验证 |
|----|------|------|
| color-bloom 深度 | flood 消除计入 `puzzleMoves`；中心 4 连块 | interaction QA ✅ |
| gun-merge 交互 | 合成 juice + qaTouches 双 bump | interaction QA ✅ |
| 神庙 v3 视觉 | 两侧水域、石质分数面板 | build ✅ |
| 全量样品 QA | 23 款互动 + 深度全绿 | **23/23** ✅ |
| Build | Next 生产构建通过 | `npm run build` ✅ |

**质量判断**：样品馆 23 款互动 QA 已全部通过；神庙为 2.5D 程序化 graphics，距离商业 Temple Run 仍有差距（专业美术/真 3D）。

---

更新时间：**2026-06-17**（迭代六十 · 神庙重做 + 统一 WASD/鼠标 ✅）

## 迭代六十：神庙可玩性 + 统一输入

| 项 | 结果 |
|----|------|
| 透视跑道 | 梯形收敛，非三条平行竖条 |
| 难度曲线 | 2.6s 无敌、单障碍、1 命即时重开、无尽 |
| 跑者动画 | 8 帧 run/jump/slide/lean + 追兵/速度线 |
| 统一输入 | WASD + 鼠标覆盖 Play/Shooter/Platformer/Coaster |

---

更新时间：**2026-06-17**（迭代五十九 · 神庙逃亡 v2 机制 ✅）

## 迭代五十九：神庙逃亡从原型到 v2 可玩机制

| 项 | 结果 | 验证 |
|----|------|------|
| 金币拾取 | 路上生成金币，同车道碰撞 +1，`coasterCoins` 暴露给 QA | `qa:board-showcase-samples` ✅ |
| 跳跃 / 滑铲 | pillar 低障碍需跳、beam 高障碍需滑、rock 滚石需换道 | 源码 contract ✅ |
| 弯道 / 动画 | `laneCenterX` 透视弯、`runAnimPhase` 摆腿、跳/滑姿态 | 目视 + build ✅ |
| HUD / i18n | 操作提示与距离+金币得分，五语系 messages 同步 | `npm run build` ✅ |
| 互动 QA | 神庙样品仍用 `coasterDistance` 深度断言（金币开局即捡完不适合 depth） | temple QA 1/1 ✅ |
| Build | Next 生产构建通过 | `npm run build` ✅ |

**质量判断**：神庙逃亡 v2 已具备 Temple Run 核心机制骨架（换道/跳/滑/金币/弯道路面），仍非商业级；下一档优先精灵动画、失败重开、弯道手感与 UI  polish。

---

更新时间：**2026-06-17**（迭代五十八 · 六款小游戏真实试玩 + 神庙逃亡样品 ✅）

## 迭代五十八：从“自动化通过”补到“肉眼可玩”

| 项 | 结果 | 验证 |
|----|------|------|
| 五款棋盘/益智试玩复核 | 2048、围棋、斗兽棋已达到可试玩；中国象棋从格子棋盘改为真实线盘/楚河汉界/圆棋子；国际象棋补全 32 子和基础 Q/R/B/N/K/P 走法 | `qa:sample-gameplay-interaction` 5/5 ✅、截图复核 ✅ |
| 神庙逃亡样品 | 新增 `temple-relic-runner`：三线石板跑酷、左右换道、滚石/石柱障碍、遗迹背景、距离得分 | 单款 QA ✅、6 款组合 QA 6/6 ✅ |
| 样品馆 DB | 本地样品馆 upsert 到 23 个项目 | `seed:samples` ✅、`qa:sample-gallery-db-sync` 23/23 ✅ |
| 质量门禁 | `qa:board-showcase-samples` 增加棋盘质量和神庙跑酷 contract | ✅ |
| Build / lint | Next 生产构建通过，改动文件 lint 无错误 | `npm run build` ✅、ReadLints ✅ |

**质量判断**：这 6 款现在达到“人类能点开试玩并理解规则”的底线；神庙逃亡是可玩原型，不是完整商业级 Temple Run。后续若追商业质感，优先补跳跃/滑铲、金币拾取、连续弯道、角色动画帧与失败重开节奏。

---

更新时间：**2026-06-17**（迭代五十七 · 五款棋盘/益智样品可见 + 封面/围棋/抖动修复 ✅）

## 迭代五十七：用户截图反馈闭环

| 问题 | 结果 | 验证 |
|------|------|------|
| 最新发布只看到 3 款 | 新增 `classic-xiangqi-board`、`classic-international-chess` 两个样品；DB 最新 5 款为 International Chess / Chinese Xiangqi / Jungle / Go / 2048 | `seed:samples` ✅、DB 查询 ✅ |
| 游戏封面破图/缺失 | 五款棋盘/益智样品封面改为 PNG：`public/samples/*.png`，seed 写入 `coverPath` | `qa:board-showcase-samples` ✅ |
| 围棋棋子太小 | Go 不再用 `●/○` 文本，改为 `drawGoStone()` 大圆盘 + 高光 + 阴影，半径 `cell * 0.43` | `qa:board-showcase-samples` ✅ |
| 2048 测试背景抖动 | 2048 每步不再调用会触发 camera shake 的 `juiceCombo()`，改为局部 `juiceBurst()` | `qa:board-showcase-samples` ✅ |
| Build / lint | Next 生产构建通过，改动文件 lint 无错误 | `npm run build` ✅、ReadLints ✅ |

**注意**：`qa:sample-gameplay-interaction` 全量 22 款中，本次相关 5 款全部通过；旧样品 `color-bloom`（玩法深度未变）和 `gun-merge-3d-zombie-apocalypse`（interaction diff 阈值）仍失败，需单独排查。

---

更新时间：**2026-06-17**（迭代五十六 · 斗兽棋棋子可读性修复 ✅）

## 迭代五十六：斗兽棋从“裸汉字”改为动物图标棋子

| 项 | 结果 | 验证 |
|----|------|------|
| 棋子可读性 | `ChessScene` 的 jungle ruleset 改为高对比圆形棋子底 + 动物 emoji + 汉字标签 | `qa:board-showcase-samples` ✅ |
| 防回退门禁 | `qa:board-showcase-samples` 增加动物图标、图标+文字、圆形棋子底断言 | `qa:board-showcase-samples` ✅ |
| 试玩验证 | 斗兽棋样品 canvas / Scene / 交互 / 玩法深度保持通过 | `SAMPLE_AUDIT_IDS=jungle-animal-chess npm run qa:sample-gameplay-interaction` ✅ |
| Build | Next 生产构建通过 | `npm run build` ✅ |

**交付状态**：斗兽棋不再依赖浅色棋盘上的纯文字辨识，棋子现在更接近“动物 ICO + 标签”的产品表达。

---

更新时间：**2026-06-17**（迭代五十五 · 样品馆真实可见与控制台复制 ✅）

## 迭代五十五：样品从“代码里存在”变成“广场/样品馆可见”

| 项 | 结果 | 验证 |
|----|------|------|
| 样品 DB 同步 | `/api/samples/ensure` 改为幂等 upsert，确保代码里的 20 个样品同步到数据库 | `seed:samples`、`qa:sample-gallery-db-sync` ✅ |
| 样品馆数据源 | 新增 `/api/samples` DB catalog，`/samples` 页面改为从数据库渲染，控制台复制的样品可显示 | 浏览器打开 `/zh-Hans/samples` 已看到 2048 / Go / Jungle ✅ |
| 控制台复制 | 新增 super admin API `/api/admin/samples/copy-project`；运营控制台 game 行增加“复制到样品馆”按钮 | `qa:sample-gallery-copy` ✅ |
| CLI 复制 | 新增 `npm run sample:copy-project -- <projectId> [sampleId]`，用于本地/运维控制台复制并生成 public 资产 | `qa:sample-gallery-copy` ✅ |
| 试玩验证 | 三个新样品通过真实 Playwright canvas/交互/玩法深度审计 | `SAMPLE_AUDIT_IDS=number-merge-2048,zen-go-board,jungle-animal-chess npm run qa:sample-gameplay-interaction` **3/3** |
| B-tier / Build | 总闸与生产构建保持通过，且构建 broad-pattern warning 已清理 | `qa:b-tier-smoke` **47/47**、`npm run build` ✅ |

**交付状态**：2048、围棋、斗兽棋已经 seed 到本地 DB，并在样品馆页面可见；后台可把游戏广场项目复制到样品馆给别人借鉴。真实生产环境仍需部署后执行 seed/ensure 或访问 `/samples` 触发同步。

---

更新时间：**2026-06-17**（迭代五十四 · 彩色棋盘与 2048 样品扩展 ✅）

## 迭代五十四：新增 2048 / 围棋 / 斗兽棋展示样品

| 项 | 结果 | 验证 |
|----|------|------|
| 样品馆 | 新增 `number-merge-2048`、`zen-go-board`、`jungle-animal-chess` 三个色彩鲜明样品与 SVG 封面 | `qa:template-matrix` ✅ |
| 规格层 | `PuzzleBlueprint` 新增 `merge2048`；`ChessBlueprint` 新增 `go` / `jungle` ruleset | `qa:board-showcase-samples` ✅ |
| 运行时 | `PuzzleScene` 支持 2048 数字合成；`ChessScene` 支持 19x19 围棋落子与 7x9 斗兽棋动物棋盘 | `qa:sample-gameplay-interaction:offline` ✅ |
| 样品门禁 | 三个新样品补齐 sample profile、玩法深度期望、交互 case、基础 PNG 资产 | `qa:competitor-clone-checks-offline` **20/20**、`qa:gameplay-depth-offline` **20/20** |
| B-tier / Build | 总闸从 46 项增至 47 项并全绿 | `qa:b-tier-smoke` **47/47**、`npm run build` ✅ |

**交付状态**：用户指定的 2048、围棋、斗兽棋已进入样品馆与专用运行时分支；本地 QA/构建通过。真实生产 URL 审计与肉眼试玩需部署后执行。

---

更新时间：**2026-06-17**（迭代五十三 · 商业精品生成门禁与双样例落地 ✅）

## 迭代五十三：中国象棋 / 开心消消乐不再只是“路由到模板”

| 项 | 结果 | 验证 |
|----|------|------|
| 商业精品门禁 | 新增中国象棋/开心消消乐专项 contract，检查商业蓝图与运行时兑现 | `qa:commercial-game-design-contracts`、`qa:match3-commercial-runtime`、`qa:xiangqi-commercial-runtime` ✅ |
| 规格层 | Puzzle 蓝图增加交换三消、目标、道具、特殊块、关卡包；新增 Chess 蓝图和 xiangqi 规则集 | `qa:non-sample-game-quality` ✅ |
| 运行时 | PuzzleScene 支持 swap 三消；ChessScene 支持 9x10 中国象棋、楚河汉界、完整子力和基础 AI | `qa:b-tier-smoke` **46/46** |
| 本地验证 | 样品扩展试玩与 17 样品互动审计保持通过 | `qa:sample-play-extended` **7/7**、本地 `qa:prod-sample-play-audit` **17/17** |
| Build | Next 生产构建通过 | `npm run build` ✅ |

**交付状态**：商业精品维度已从“视觉/反馈补强”推进到“生成规格 + 运行时兑现 + QA 门禁”；尚未 commit / push / deploy。真实生产 URL 审计需部署后执行。

---

更新时间：**2026-06-17**（迭代五十二 · 次级入口 HUD/资产下限补齐 ✅）

## 迭代五十二：Farming / Puzzle / Physics 也进入统一体验底座

| 项 | 结果 | 验证 |
|----|------|------|
| HUD 目标卡扩展 | `FarmingScene` / `PuzzleScene` / `PhysicsScene` 接入 `HudGoalPanel` 与 `buildSceneGoalGuidance()` | `qa:hud-goal-panel` ✅ |
| 背景可见度扩展 | 三个次级 Scene 增加 `bgTex` preload，并用 `assetBackgroundAlpha()` 展示文生图背景；已修复 Puzzle 背景被不透明 backdrop 盖住的问题 | `qa:asset-visibility-floor` ✅ |
| B-tier / build | HUD 与资产下限门禁覆盖 7 个 Phaser Scene，总闸保持通过 | `qa:b-tier-smoke` **43/43**、`npm run build` ✅ |
| 本地样品/非样品验证 | 样品扩展试玩 7/7、样品互动审计 17/17、非样品质量与 gameplay depth 离线门禁通过 | `qa:sample-play-extended` ✅、`qa:prod-sample-play-audit` 本地 17/17 ✅ |

**交付状态**：主入口和次级入口都已接入统一目标引导与背景可见度下限；本地样品/非样品验证已通过；尚未 commit / push / deploy。实际生产 URL 验证需在部署当前改动后执行。

---

更新时间：**2026-06-17**（迭代五十一 · Systems 技能/道具可观察层 ✅）

## 迭代五十一：技能/道具不再只是静默改数值

| 项 | 结果 | 验证 |
|----|------|------|
| Systems 冲击层 | 新增 `systemImpact.ts`，统一 skill / powerup 的 pickup / combo / boss 语义反馈 | `qa:systems-observable-impact` ✅ |
| 核心 Scene 接入 | `PlayScene` / `PlatformerScene` 接入 powerup 观察层；`PlayScene` / `ShooterScene` / `PlatformerScene` / `TowerDefenseScene` 接入 skill 观察层 | `qa:systems-observable-impact` ✅ |
| B-tier / build | systems 门禁纳入总闸，B-tier smoke 增至 43 项 | `qa:b-tier-smoke` **43/43**、`npm run build` ✅ |

**交付状态**：runtime-depth 的 director 与 systems 两层都已形成共享可观察反馈；尚未 commit / push / deploy。下一步进入本地/生产路径验证，并补齐 Farming / Puzzle / Physics 等次级入口的 HUD/资产下限覆盖。

---

更新时间：**2026-06-17**（迭代五十 · Director 事件运行时冲击层 ✅）

## 迭代五十：运行时事件不再只是横幅

| 项 | 结果 | 验证 |
|----|------|------|
| 事件冲击层 | 新增 `runtimeEventImpact.ts`，按事件类型触发语义化 pickup / hit / combo / boss 反馈 | `qa:runtime-depth-observable` ✅ |
| 核心 Scene 接入 | `PlayScene` / `ShooterScene` / `PlatformerScene` / `TowerDefenseScene` 的 director `startEvent` 统一调用事件冲击层 | `qa:runtime-depth-observable` ✅ |
| B-tier / build | runtime-depth 门禁纳入总闸 | `qa:b-tier-smoke` **42/42**、`npm run build` ✅ |

**交付状态**：director 事件具备统一可见冲击，不再只是 banner；尚未 commit / push / deploy。下一步让 systems skill / powerup 的状态变化也进入统一可观察层。

---

更新时间：**2026-06-17**（迭代四十九 · 用户生成资产可见度下限 ✅）

## 迭代四十九：背景与 Sprite 可见度下限

| 项 | 结果 | 验证 |
|----|------|------|
| 背景可见度 | 新增 `assetBackgroundAlpha()`，非样品 standard 背景透明度提升到可见下限，showcase 更突出 | `qa:asset-visibility-floor` ✅ |
| Sprite 尺寸下限 | 新增 `visibleSpriteTargetSize()`，为 player/hazard/collectible/power/boss 提供 tier 化尺寸下限 | `qa:asset-visibility-floor` ✅ |
| 核心 Scene 接入 | `PlayScene` / `ShooterScene` / `PlatformerScene` / `TowerDefenseScene` 背景 alpha 改走共享下限 | `qa:asset-visibility-floor` ✅ |
| B-tier / build | 资产可见度门禁纳入总闸 | `qa:b-tier-smoke` **41/41**、`npm run build` ✅ |

**交付状态**：用户生成游戏背景不再默认淡成水印；尚未 commit / push / deploy。下一步进入 runtime-depth，让 director/systems 的阶段、技能、道具和高潮事件更明显地改变运行时体验。

---

更新时间：**2026-06-17**（迭代四十八 · HUD 目标任务卡 ✅）

## 迭代四十八：统一目标面板

| 项 | 结果 | 验证 |
|----|------|------|
| HUD 任务卡 | 新增 `HudGoalPanel`，展示目标 / 操作 / 风险提示，开场完整显示后半透明常驻 | `qa:hud-goal-panel` ✅ |
| 核心 Scene 接入 | `PlayScene` / `ShooterScene` / `PlatformerScene` / `TowerDefenseScene` 挂载并 update 任务卡 | `qa:hud-goal-panel` ✅ |
| B-tier / build | 阶段三目标面板纳入总闸；构建发现并修复 `GameObject` 类型宽化问题 | `qa:b-tier-smoke` **40/40**、`npm run build` ✅ |

**交付状态**：HUD/目标引导阶段已从文案统一推进到可见任务卡；尚未 commit / push / deploy。下一步扩展到 Farming / Puzzle / Physics 等次级入口，并继续资产可见度与运行时深度。

---

更新时间：**2026-06-17**（迭代四十七 · 目标引导层第一步 ✅）

## 迭代四十七：共享目标引导文案层

| 项 | 结果 | 验证 |
|----|------|------|
| 目标引导生成器 | 新增 `scene-goal-guidance.ts`，从 `GameSpec` 生成目标、操作、风险、banner、底部 hint | `qa:scene-goal-guidance` ✅ |
| 核心 Scene 接入 | `PlayScene` / `ShooterScene` / `PlatformerScene` / `TowerDefenseScene` 首屏和底部提示接入统一 guidance | `qa:scene-goal-guidance` ✅ |
| B-tier / build | 阶段三第一道门禁纳入总闸 | `qa:b-tier-smoke` **39/39**、`npm run build` ✅ |

**交付状态**：HUD/目标引导阶段已完成文案统一第一步；尚未 commit / push / deploy。下一步把文案层升级为可复用 HUD 目标面板/任务卡。

---

更新时间：**2026-06-17**（迭代四十六 · TowerDefense 语义反馈收口 ✅）

## 迭代四十六：塔防反馈完成语义化

| 项 | 结果 | 验证 |
|----|------|------|
| TowerDefense 收口 | 合成、开波、建塔/升级、击杀、基地受击/护盾、技能、coinRain、胜负结算走语义 feedback | `qa:tower-defense-semantic-juice` ✅ |
| 基地反馈坐标 | 新增 `baseFxPoint()`，用路径终点统一定位基地护盾/受击/失败反馈 | `npm run build` ✅ |
| B-tier / build | 阶段二所有主 Scene 语义反馈 contract 纳入总闸 | `qa:b-tier-smoke` **38/38**、`npm run build` ✅ |

**交付状态**：语义化 Juice 阶段已覆盖主要 Phaser Scene；尚未 commit / push / deploy。下一步进入统一 HUD/目标引导层，解决“调试模板感”。

---

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
