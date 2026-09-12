# Operone 创作者平台交接（2026-08-22）

## 最新接续入口：平台级手机质量合同与真实美术验收（2026-09-12 下午）

上一节记录的四类缺陷全部是**生成链路通病**，不是「太空快递」那一款的问题。本轮按平台能力修，不按单游戏修。

### 已交付、已推送、已部署

| 提交 | 修的是什么 | 影响面 |
|---|---|---|
| `4d33820f` | `spec-patch` 改用 `json_schema`（生产模型上 `json_object` 实测不收敛）、一次有界重试、脱敏日志；patch 结果**合并**到现有规格而不是整份替换 | 全平台 owner 局部修改此前必然 503；合并还顺带堵住了「一次编辑把 forgeBuild 丢掉」 |
| `4d33820f` | 设计提示词骨架与 Zod 默认值改为竖屏；`orientation: "either"` 解析为竖屏 | 每款新游戏不再把横屏舞台塞进竖屏播放器 |
| `4d33820f` | 视觉合同接受 `g.assets.image` / `r.sprite` | 此前**每个正确的 Forge 构建**都被误报 `runtime_sprite_actor_missing` |
| `4d33820f` | Forge 自修复探针改跑 393×852 手机 | 此前跑 960×540 桌面窗口，修复循环看不见它该修的手机问题 |
| `207cc2cf` | 可玩但不达标的构建触发**恰好一轮**后台质量打磨 | 此前质量发现只写进 evidence，没有任何消费者 |
| `42876d4f` | 主角尺寸改为真实测量（渲染器本就算了精灵屏幕尺寸，只是丢掉了） | 9% 下限此前只是提示词散文 |
| `6d97bf7b` | 真实美术审查：把交付帧交给视觉模型，封闭代码表 | `visual_review_agent` 此前**没有任何生产者**，`visual_review_rejected` 是 100% 噪声 |
| `2cc01699` | CONTEXT.md 快照 | — |

### 必须保留的设计取舍

1. **不新增硬门禁。** 质量不达标照常交付、玩家照常能玩，平台后台补一轮。不要把这些 advisory 改成 blocker。
2. **打磨严格一轮。** `shouldScheduleGameQualityPolish` 只在 `productionRound === 1` 触发，产出的是第 2 轮，结构上不可能自循环。每轮约 10 分钟模型时间，`POLISHABLE_ADVISORIES` 白名单要保持窄；`visual_review_unavailable`、`real_agent_missing:*` 被刻意排除。
3. **能测量的不要靠提示词。** 主角尺寸走 `forge-player-evidence` 的 `w`/`h`，不需要视觉模型。
4. **没跑过的审查不许下结论。** 视觉审查跑不了返回 null，候选写 `visual_review_unavailable`。`qa-runtime-delivery-gate.ts` 原先断言的是旧的「永远 rejected」行为，即断言了 bug，已改。

### 下一位的缺口

1. **质量发现对人不可见。** `game_production_candidate.advisories` 没有进 `creator-quality.ts` 的作品质量报告，也没有进后台。创作者看不到「平台正在自动优化：主角过小 / 画面留白」。`assessGameCreatorQuality` 目前只接 spec，需要把候选 advisories 从详情 API 透传进去。
2. **既有失败（非本轮回归，均已隔离复现）**：`qa:agentic-persist-coerce`（`coerceGameSpec` 单独调用即丢 `agenticModule`，`normalize-spec.ts`/`game-spec.ts` 本轮未改）、`qa:creator-core`（CONTEXT 早已记载的共享库 job 抢占）、`scripts/qa-game-forge-browser.ts`（未注册进 package.json，手写参考构建签名检查失败）。
3. 工作区仍有大量非本轮所有的改动，**禁止 `git add .`**，只按精确路径暂存。

---

## 上一轮入口：一句话游戏门禁体验与“太空快递”生产验收（2026-09-12 上午）

### 本轮目标与产品决定

用户指出“动不动搞门禁”会伤害体验。本轮把最终交付门禁收缩为**客观不可玩故障**，并保留 Forge 自动修复能力：

- 继续硬拦：独立运行时缺失或验证缺失、运行报错、未启动、无首帧、循环卡死、交互无变化、主角不可见、主角不响应操作。
- 不再单独硬拦：静态质量发现、生成素材缺失但已有可用兜底、收集物不可见/越界等可修复质量项。这些仍写入 evidence、仍由 Forge 尝试修复。
- 活动 job（`queued` / `running` / `retrying`）优先于旧失败 revision。后台已经自动修复时，用户看到“游戏制作中/正在自动优化”，不再先看到红色终态失败页。
- 只有任务已经结束且仍有致命运行故障时，才显示较柔和的“这次生成还没达到可玩状态 / 继续优化”。

### 已完成、已提交、已部署

- 代码提交：`b283716d fix(game): keep repairable builds in progress`，已推送 `origin/main`，生产 `/opt/operone` 当前也是 `b283716d`。
- 页面状态与文案：`src/app/play/[id]/PlayGameClient.tsx:74,92,103`。
- 交付软硬分类：`src/lib/game-runtime-validation.ts:28-29,51,89-109`。
- 修复 validation evidence 被最终探针摘要覆盖：`src/lib/game-runtime-validation.ts:121`。
- 本地通过：`npm run qa:runtime-delivery-gate`、`npx tsc --noEmit`、目标 ESLint（0 error）、`npm run build`。
- 生产发布脚本通过：正确 HEAD、迁移、Prisma、Next BUILD_ID、service、TLS health、worker timer、www-data 真实 Chromium；日志终态 `RUNTIME_DELIVERY_RELEASE_OK`。
- 当前生产状态：`operone=active`、`operone-generation-worker.timer=active`、活动生成队列为空。

### 为什么用户截图会先显示失败

“开心消消乐”项目 `cmtwtjyli00on4abzhpx6xqgl` 前两版失败后，后台已经自动创建下一次修复，第三版最终 ready。旧页面却优先读失败 revision，而没有让活动 job 覆盖它，于是把可恢复的中间状态展示成了终态失败。本轮已修正这一状态优先级。

### 全新生产游戏实测：太空快递

- 试玩项目（legacy Project）：`cmtwv5zla000e8w6tkzc8jmmt`。
- CreativeProject：`cmtwv5zm2000g8w6tapko5laz`。
- revision：`cmtwv5zmk000i8w6tsj4kx6ph`，sequence 1，`ready`。
- job：`cmtwv5zqe00168w6tgg7l5tgi`，attempts 1/3，2026-09-11 19:19:23 至 19:29:04（约 9 分 41 秒），`completed`。
- prompt：手机单手拖动蓝色飞船，躲避红色陨石，收集黄色能量星，60 秒 30 分胜利，碰撞三次失败并可重试。
- 设计约 22.9 秒完成；6 个代码模块约 47.4 秒完成。`ship_blue` 与 `bg_space` 模型素材各在 150 秒预算超时，平台继续生成/使用可用兜底，没有因此把整个游戏判死。
- `game_runtime_validation`：`passed`，`blockers=[]`。生产资源检查：背景、player、hazard URL 均 HTTP 200 image。
- 393×852 Chromium 真实页面：独立 iframe/canvas 启动；蓝色飞船主角可见；触控输入产生 `first_action`；结局和 Canvas 内“再玩一次”均产生真实 `end` / `retry` 事件。
- 截图：`qa-output/prod-game-create-delivery/playing-start.png`、`playing-active.png`、`play-timeout.png`。报告：同目录 `REPORT.md`、`summary.json`。
- 项目当前 `visibility=pending_review`，**尚未发布**，不能给匿名用户当公开成品链接。

### 真实未完成项与风险（按优先级）

1. **P0：局部 AI 修改在生产必然失败的概率很高。** 对“太空快递”定向修改连续 3 次 HTTP 503 `patchFailed`，没有产生第二个 revision/job。`src/lib/spec-patch.ts:105-159` 仍强制 `mode: "json_object"`、单模型 22 秒，并吞掉每次异常；这与此前生产 `game_text` 模型上已经证实不收敛的 `json_object` 问题同类。应改成该模型支持的 `json_schema`/统一结构化调用，加入一次有界重试和脱敏失败日志，再重跑同一项目的局部优化。
2. **P0：新游戏能玩，但首分钟难度不合格。** 多个真实回合在 6–42 秒内因三次碰撞失败，得分 0–7；虽然主角、输入、结局、重试都正常，但没有任何单局产生 `first_minute`。不要通过放宽发布硬门禁掩盖这个问题；应让真实试玩证据触发一次有界自动质量迭代，调整前 60 秒敌人密度、速度、无敌时间和奖励可达性。
3. **P1：移动端画面利用率和主角尺寸仍差。** 游戏使用横屏舞台塞进竖屏 iframe，上下留白明显；蓝色飞船可见但偏小。应把“移动端竖屏填充、主角最小可视尺寸”放进生成/修复提示与 advisory 质量合同，触发修复但不要变成新的终态硬门禁。
4. **P1：视觉合同与实际运行脱节。** `runtime_build_manifest.visualContract.ok=false`，报告 `runtime_*_asset_unused`/`runtime_sprite_actor_missing`；运行时仍可用且资源 URL 200，但模型运行时代码没有使用生成素材。这些应进入自动修复和后台质量说明，不能静默，也不应因为有可用程序化画面就立即红屏。
5. **P1：refine 可观测性缺失。** `/api/projects/[id]/refine` 最外层 catch 和 `patchGameSpecWithLlm` 的循环都吞异常，生产 journal 对这三次 503 没有对应原因。至少记录 scene/model/attempt/errorCode/duration 的脱敏日志。
6. **P1：真实试玩脚本此前按主文档查 canvas，独立运行时在 iframe 内，造成假阴性；还把 `bgm_notes` 误当成 BGM 未完成。** 当前工作区已修：允许复用项目、恢复 owner 会话、识别 `bgm_notes`、进入 iframe canvas、记录开局/操作截图、按 forge 观测驱动输入和 Canvas 重试。TypeScript 与目标 ESLint 通过，但最终验收仍因产品确实未产生 `first_minute` 而失败。
7. **P2：页面有未定位的 404 console error。** 目前脚本只保存了浏览器错误文本，没有保存失败资源 URL；下一步给 `response` 事件加 URL/status 取证后定位。

### 当前工作区与提交边界

- 当前 HEAD：`b283716d`。生产与仓库已经包含产品修复。
- `scripts/qa-prod-game-create-delivery.ts` 有本轮尚未提交的验收器改进；应与本交接文档精确提交。
- 工作区还有大量既有 `.qa-cache/`、`qa-output/sample-gameplay-interaction/`、`.dream/`、PPT、临时脚本改动，所有权不明。**禁止 `git add .`，只按精确路径暂存。**
- 当前没有活动 Codex 自动续接 automation；此前 `p0-p1` 在上一阶段验收完成后已删除。生产生成队列当前也为空。

### 下一位直接执行顺序

1. 修 `src/lib/spec-patch.ts` 的生产结构化模型调用、一次有界重试和脱敏日志；补隔离 QA，部署。
2. 对现有 `cmtwv5zla000e8w6tkzc8jmmt` 做局部 patch：主角至少放大 2 倍；前 60 秒同屏陨石最多 2 个、速度减半、碰撞后 2 秒无敌；提高能量星可达率；重开完全复位。
3. 保存后等待同一项目的新 revision/job，不要再创建第二个游戏。
4. 用修过的 `qa-prod-game-create-delivery.ts` 复用该项目，要求 iframe canvas、player visible、first_action、单局 `first_minute >= 60000`、明确 end、retry、无 pageerror；人工查看 `playing-start.png` 和 `playing-active.png`。
5. 通过后再显式发布并用匿名 393×852 浏览器复验；失败则保留 `pending_review`，不得宣称完成。

## 先读这段

本轮最重要的纠偏是：产品应按**创作者平台**重构，而不是继续围绕单个小游戏做表现层打磨。

目标架构应是三条产品线（游戏、小说、漫画）共用：

```text
一句话/素材 → Creative Brief → 生成 → 质量报告 → 局部修改/版本
→ 可发布检查 → 发布/分发 → 作品消费数据 → 商业权益与成本账本
```

已完成三条线的质量 API 接入、工作台跨媒介质量汇总、章节/页级定向修复和消费数据质量证据；但**真实首分钟遥测验收、支付成本账本和生产发布仍未完成**。不要把当前状态当成整项产品改造已经完成。

## 本轮已改动（仅下列为本轮明确拥有的代码）

### 1. 移动端首页首轮改造

- `src/components/SiteHeader.tsx`：移动端导航由横向拥挤导航改为紧凑折叠菜单。
- `src/app/page.tsx`：移动端首屏压缩信息密度、突出主 CTA。
- `e2e/home-mobile-ux.smoke.spec.ts`：375px 宽度下导航不溢出、菜单可见的冒烟检查。

已验证：375×812 浏览器视口中无横向溢出，折叠菜单在屏幕内。`npx tsc --noEmit`、定向 eslint、该 Playwright 测试均通过。

### 2. 游戏质量基础（只是一条产品线的基础，不是最终平台方案）

- `src/lib/game-vertical-slice.ts`：
  - 跑酷/消除/物理解压/平台跳跃/农场五类首分钟合同（0–5 / 5–20 / 20–40 / 40–60 秒）。
  - 确定性评分：clarity、pacing、agency、presentation、feel。
  - Art Direction Pack：解析画风、shader、粒子、动画档、音乐/SFX、Brief 锚点和关键动作节点。
- `src/lib/generate-spec.ts`：将 `verticalSlice` 写入 `GenerationDebug` 和 orchestration trace；不修改运行时规则。
- `scripts/qa-game-vertical-slice.ts` 与 `package.json`：五类旗舰模板的定向合同检查。

注意：这不是发布硬门禁；目前它只提供可观察的质量证据。

### 3. 匿名试玩质量数据链和后台概览

- `prisma/schema.prisma` + `prisma/migrations/20260822020000_add_gameplay_event/migration.sql`：新增 `GameplayEvent`。
  - 只存：作品 ID（可空）、模板、随机 session ID、事件、时长、分数、胜负、静态质量分。
  - 不存：prompt、原始输入、用户身份、设备指纹。
- `src/lib/gameplay-telemetry.ts` / `.client.ts`：事件 schema 与 fire-and-forget 客户端上报。
- `src/app/api/gameplay/events/route.ts`：验证后写入事件。
- `src/components/GamePlayerInner.tsx`：试玩开始、首次操作、满一分钟、结算、重试上报；previewMode 不上报。
- `src/app/api/admin/analytics/route.ts`：统计启动数、首次操作率、首分钟完成率、重试、平均失败秒数、平均质量分，并按模板聚合。
- `src/components/admin/AdminConsolePage.tsx`：后台概览显示上述指标和模板下钻。
- `src/messages/{zh-Hans,zh-Hant,en,ms,th}.json`：相关文案。
- `scripts/qa-gameplay-telemetry.ts`：payload schema/隐私字段检查。

注意：新迁移**没有在本机开发库或生产库应用**。生产发布脚本会运行 `prisma migrate deploy`，但应先在干净环境验证迁移。

### 4. 平台统一作品状态（仅基础层，尚未接三条线 API）

- `src/lib/creator-workflow.ts`：定义统一阶段：
  `draft → generating → quality_review → editable → publishable → published`。
- `scripts/qa-creator-workflow.ts`：验证状态映射。

关键未完成：游戏 `/api/projects`、小说 `/api/novel/*`、漫画 `/api/comic/*` 仍分别返回自己的 `status/visibility` 语义；下一位需要把三条线详情/生成 API 输出统一接入 `CreatorWorkStage` 和统一的 `CreatorQualityReport`。

### 5. 生产发布健康检查修复

- `scripts/prod_ssh.py`：新增正式 HTTPS vhost 的本机健康检查命令。
- `scripts/check-prod-commit.py`、`scripts/deploy-prod-cee8b1d.py`：使用该检查。

已通过只读 SSH 实测：

```text
curl -fsS --connect-timeout 10 \
  --resolve operone.1oneclaw.com:443:127.0.0.1 \
  https://operone.1oneclaw.com/api/health
→ {"ok":true,"db":"up","email":"configured",...}
```

此前无 Host 的 `127.0.0.1:80/api/health` 返回 404；仅带 Host 的 HTTP 请求是 301，二者都不能判定应用健康。

## 已验证的事实

- `npx tsc --noEmit`：最近一次通过。
- `npm run qa:game-vertical-slice`：通过。
- `npm run qa:gameplay-telemetry`：通过。
- `npm run qa:creator-workflow`：通过。
- `npm run qa:game-quality-contracts`、`qa:non-sample-game-quality`、`qa:commercial-game-design-contracts`：本轮早期通过。
- `npx prisma validate`：通过。
- `npx prisma generate`：因正在运行的 Windows Prisma query engine 文件锁定而 EPERM；`npx prisma generate --no-engine` 成功生成类型，不应为了此事强杀用户服务。
- `npx prisma migrate diff --from-migrations ... --to-schema-datamodel ...` 仍显示 **既有** `PlatformEmailConfig` 与若干 unique-index 的迁移/Schema 漂移；不要把该输出误判为本轮 `GameplayEvent` migration 的失败。
- 全仓 `npm run lint` 没有跑绿。本轮定向 lint 的新增文件通过；`GamePlayerInner.tsx` 有既有的 React `set-state-in-effect` 两个 error 及一个依赖 warning，需在单独修复任务中处理。

## 续接完成（2026-08-22，提交 `ae00cd48`，未推送）

- `src/lib/creator-quality.ts` 已将三条线的现有确定性证据收敛为统一质量报告：游戏复用 vertical slice；小说检查完整性、章节、开篇/结尾长度和段落重复；漫画检查页格、可读文案、角色/场景锚点和配图完成度。
- 游戏保存/详情、小说普通生成/流式生成/详情、漫画生成/详情均返回 `{ workflow: { stage }, quality: { verdict, score?, evidence[] } }`。这仍是可观察的建议，不会阻断发布。
- `npm run qa:creator-quality` 已新增并通过；`npx tsc --noEmit`、定向 ESLint（0 error）、已有质量检查、`npx prisma validate` 均通过。正在运行的本机开发服务也已对三种公开作品的详情 API 实测质量外壳。
- 新迁移在全新临时 SQLite 库完成 `prisma migrate deploy`，确认包含 `GameplayEvent`；临时库已清除，生产尚未迁移。
- `npm run build` 已完成并生成 `.next/BUILD_ID` 与生产 manifests。全仓 lint、全量 E2E、生产部署均未执行。

## 续接完成：工作台质量修复闭环（待提交）

- 新增 `src/app/api/studio/quality/route.ts`：仅以 owner cookie 查询最近 100 项作品，在服务端评估并返回小型 `workflow` / `quality` 摘要；小说正文不会随列表传到浏览器。
- `src/app/studio/page.tsx` 与 `src/components/CreatorCenterPanel.tsx`：显示质量判定、分数和证据；未达标作品优先进入质量检查区并可直达详情页修复。离开详情再返回工作台会重新评估。
- 五种 locale 已补齐文案。验证通过：`npx tsc --noEmit`、目标 ESLint、JSON 解析、`qa:creator-quality`、`qa:creator-workflow`；开发服务的质量接口对无 cookie 为 401、owner cookie 为 200。浏览器会话没有现成作品，因此仅实测了工作台空态加载，无前端错误。

## 续接完成：章节/页级质量与局部修复（待提交）

- `CreatorQualityReport.units` 已把小说拆成 `chapter-N`、漫画拆成 `page-N`，每项返回独立分数、判定与证据；相关详情 API 自动随原有 `quality` 返回。
- 小说 owner 可从章节质量卡直达并聚焦对应章节编辑；漫画 owner 可看到当前页质量并复用已有的“重绘本页”和单格修改能力。
- 同时清除了交接中列出的两处页面级 React lint 错误。核心文件 ESLint、`npx tsc --noEmit`、两个质量 QA 均通过；开发 API 对公开作品实测小说为 1 个章节单元、漫画为 8 个页面单元。

## 续接完成：消费数据质量证据（待提交）

- 详情质量报告新增 `engagement` 汇总：游戏复用匿名 `GameplayEvent` 的启动、首操作、首分钟、重试、失败时长；小说复用现有阅读/点赞计数，漫画复用点赞计数。该字段不含身份、输入或设备指纹，且不改变评分/发布决策。
- `npx tsc --noEmit`、目标 ESLint、`qa:creator-quality`、`qa:gameplay-telemetry` 均通过。开发 API 已实测公开小说/漫画的非空 `engagement` 外壳；测试 owner 下无游戏，未能实测非空游戏事件聚合。

## 续接完成：运行时兼容与首分钟验收基础（待提交）

- 已修复旧 Prisma Client 的降级路径：若长驻 Windows 进程仍使用 `GameplayEvent` 迁移之前生成的 Client，作品详情和后台概览会将遥测视为零样本，不再把可试玩作品误报为“损坏”；遥测写入保持非阻断并返回 503，等待安全重启后恢复。
- `e2e/global-setup.ts` 不再依赖 Windows 的 `npx prisma` shim，直接调用已安装的 Prisma CLI；新增 `e2e/flagship-first-minute.spec.ts` 和 `npm run test:e2e:first-minute`，五个旗舰模板均真实等待 61 秒并检查 `start`、首次操作和 `first_minute` 的聚合结果。
- 已验证：恢复后 `node node_modules/typescript/bin/tsc --noEmit`、定向 ESLint、`qa:creator-quality`、`qa:gameplay-telemetry` 通过；已有 avoider 试玩 Playwright 用例通过。
- 真实 avoider 首分钟用例确实运行到 61 秒，但当前 8888 进程持有旧 Client，`GameplayEvent` delegate 不存在，故遥测写入按设计返回 503，详情显示零样本，断言未通过。**不要用 fake timer 或降低 60 秒阈值掩盖该结果。**
- 接手前先在允许的维护窗口停止/重启占用 query engine 的开发服务，运行普通 `prisma generate`（不要使用 `--no-engine`，该参数会生成浏览器/WASM Client），然后以 `npm run test:e2e:first-minute` 复跑五个模板。

## 续接完成：后台媒介/模板质量明细（待提交）

- `GET /api/admin/analytics` 现在对每种媒介至多读取最近 200 部作品，在服务端生成质量聚合：已评估、就绪、待润色、阻断和平均分。响应仅包含这些计数和分数，**不会返回**正文、prompt、作品 ID、owner 或图片 URL。
- 游戏模板维度把静态质量均分/就绪数与匿名试玩启动量、首分钟率并列；零样本明确显示为无数据，不能作为发布门禁。无法解析的历史 spec 不会被伪造成低分样本。
- `AdminConsolePage` 已显示媒介概览和模板质量/首分钟对照，五份 locale 已补齐。验证通过：TypeScript、定向 ESLint、五语 JSON、`qa:creator-quality`、`qa:gameplay-telemetry`。

## 续接完成：开发库恢复与五旗舰首分钟验收（待提交）

- 已在明确停止 `D:\game` 的 8888 开发进程后执行普通 `prisma generate`，恢复二进制 Prisma Client；`scripts/fix-dev-db-migrations.ts` 现直接调用本地 Prisma CLI，并覆盖已有 `Comment` 表和 `Project.bgmNotesJson` 列的历史迁移漂移。`dev.db` 的 24 条迁移现已全部对齐，包含 `GameplayEvent`。
- `GamePlayerInner` 将试玩会话延后一项任务再激活，Strict Mode 的探测挂载会在上报 `start` 前被取消；同时清理了两处 effect 同步 setState 和 `onEnd` 依赖 lint。避免开发态伪造额外启动会话，把真实首分钟率错误压成 50%。
- `e2e/flagship-first-minute.spec.ts` 的农场 fixture 使用注册表正式 `farming` ID；`npm run test:e2e:first-minute` 已完整通过 avoider、puzzle、physics、platformer、farming 五条真实 61 秒用例（7.6 分钟）。
- 修复 `GET /api/projects/[id]/bgm`：持久化的 `specJson` 先 `JSON.parse` 再校验。对真实测试项目预置缓存旋律后，公开 BGM 接口实测正常返回，无 Zod 错误。
- 本轮质量验证还包括：`npx tsc --noEmit`、目标 ESLint、`qa:game-vertical-slice`、`qa:game-quality-contracts`、`qa:gameplay-telemetry`、`qa:creator-quality`、physics/puzzle/platformer/farming 四类 semantic-juice QA，全部通过。

## 生产状态与发布规则

- 正式站点：`https://operone.1oneclaw.com/zh-Hans`，已确认可访问。
- 生产仓库：`/opt/operone`；本次核验时生产提交：`e32cc87 feat(card-games): P0-P3 棋牌规则全补齐`。
- 本机配置：`scripts/deploy.local.env` 存在有效 SSH 配置；绝不提交该文件或泄露其内容。
- 发布入口：`python scripts/deploy-prod-with-assets.py`。
- **高风险规则**：底层发布脚本在服务器执行 `git fetch origin && git reset --hard origin/main`。
  因此必须只暂存本次拥有的文件、提交、推送 `origin/main`，再部署；服务器不会带上未提交本地改动。
- 交接初始改动曾未提交；随后质量基础提交 `7ab2b0d6` 与本次统一质量 API 提交 `ae00cd48` 均仅在本地，尚未推送、迁移生产库或部署。

## 当前工作区风险

当前分支 `main`，提交 `8118b197`、`ae00cd48`、`7ab2b0d6` 均仅在本地，工作台闭环改动待提交。工作区本来就很脏，以下文件/目录并非都属于本轮：

- 明确不要顺手提交：`.claude/launch.json`、`README.md`、`src/proxy.ts`、PNG、`dev.db`、`prisma/prisma/ci.sqlite*`、`temp-*.json`、`scripts/deploy-*-www.py`、`scripts/upload-1onework-releases.py`、`docs/_build_1one_roadshow.py`、`test-template-selector.ts`、`scripts/__pycache__/` 等。
- `CONTEXT.md` 是本轮明确按用户要求重写的最新上下文，应保留。
- 提交时使用 exact-path staging，或在干净 worktree 操作；不要使用 `git add .`。

## 推荐接手顺序

1. 先审阅并决定是否保留本轮游戏质量/遥测改动；可分为“移动端”“游戏质量”“平台遥测”“发布检查”四个独立提交，避免混入用户改动。
2. 对 `GameplayEvent` 在新 SQLite 临时库/干净 worktree 做 `prisma migrate deploy` 验证，再决定是否上生产。
3. 把 `creator-workflow.ts` 接到三条线的**详情 API 和生成响应**：统一返回 `{ workflow: { stage }, quality: { verdict, score?, evidence[] } }`，但先不要硬拦截公开。
4. 为后台增加模板和媒介维度的质量明细，并在收集阈值数据前保持不阻断发布。
5. 完成五个旗舰游戏模板的角色状态机、资产制作和真实 60 秒 E2E；避免只在游戏详情页加指标。
6. 在已有事件数据稳定后，按媒介建立首成品率、编辑完成率、质量通过率、发布率、消费完成率、分享率、付费转化与单作品成本；再决定质量门禁阈值和套餐权益。
7. 最后才启用真正的发布硬门禁、支付/成本账本和生产发布。

## 参考入口

- 总体计划与已验证生产信息：`CONTEXT.md`。
- 游戏生成：`src/lib/generate-spec.ts`。
- 游戏质量：`src/lib/game-vertical-slice.ts`。
- 三条线数据模型：`prisma/schema.prisma`。
- 游戏保存：`src/app/api/projects/route.ts`、`src/app/api/projects/[id]/route.ts`。
- 小说生成：`src/app/api/novel/generate/route.ts`、`src/app/api/novel/generate/stream/route.ts`。
- 漫画生成：`src/lib/comic-generate-run.ts`、`src/app/api/comic/generate/route.ts`。
- 发布脚本：`scripts/deploy-prod-with-assets.py`、`scripts/deploy-prod-cee8b1d.py`。
