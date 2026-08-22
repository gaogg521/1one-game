# Operone 创作者平台交接（2026-08-22）

## 先读这段

本轮最重要的纠偏是：产品应按**创作者平台**重构，而不是继续围绕单个小游戏做表现层打磨。

目标架构应是三条产品线（游戏、小说、漫画）共用：

```text
一句话/素材 → Creative Brief → 生成 → 质量报告 → 局部修改/版本
→ 可发布检查 → 发布/分发 → 作品消费数据 → 商业权益与成本账本
```

已开始搭建其中的“质量报告、试玩数据、统一作品状态”基础，但**尚未完成平台层 API 接入、统一创作台 UI、支付成本账本或生产发布**。不要把当前状态当成整项产品改造已经完成。

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

## 续接完成（2026-08-22，提交 `57a83075`，未推送）

- `src/lib/creator-quality.ts` 已将三条线的现有确定性证据收敛为统一质量报告：游戏复用 vertical slice；小说检查完整性、章节、开篇/结尾长度和段落重复；漫画检查页格、可读文案、角色/场景锚点和配图完成度。
- 游戏保存/详情、小说普通生成/流式生成/详情、漫画生成/详情均返回 `{ workflow: { stage }, quality: { verdict, score?, evidence[] } }`。这仍是可观察的建议，不会阻断发布。
- `npm run qa:creator-quality` 已新增并通过；`npx tsc --noEmit`、定向 ESLint（0 error）、已有质量检查、`npx prisma validate` 均通过。正在运行的本机开发服务也已对三种公开作品的详情 API 实测质量外壳。
- 新迁移在全新临时 SQLite 库完成 `prisma migrate deploy`，确认包含 `GameplayEvent`；临时库已清除，生产尚未迁移。
- `npm run build` 已完成并生成 `.next/BUILD_ID` 与生产 manifests。全仓 lint、全量 E2E、生产部署均未执行。

## 生产状态与发布规则

- 正式站点：`https://operone.1oneclaw.com/zh-Hans`，已确认可访问。
- 生产仓库：`/opt/operone`；本次核验时生产提交：`e32cc87 feat(card-games): P0-P3 棋牌规则全补齐`。
- 本机配置：`scripts/deploy.local.env` 存在有效 SSH 配置；绝不提交该文件或泄露其内容。
- 发布入口：`python scripts/deploy-prod-with-assets.py`。
- **高风险规则**：底层发布脚本在服务器执行 `git fetch origin && git reset --hard origin/main`。
  因此必须只暂存本次拥有的文件、提交、推送 `origin/main`，再部署；服务器不会带上未提交本地改动。
- 交接初始改动曾未提交；随后质量基础提交 `7ab2b0d6` 与本次统一质量 API 提交 `57a83075` 均仅在本地，尚未推送、迁移生产库或部署。

## 当前工作区风险

当前分支 `main`，HEAD `e32cc87d`。工作区本来就很脏，以下文件/目录并非都属于本轮：

- 明确不要顺手提交：`.claude/launch.json`、`README.md`、`src/proxy.ts`、PNG、`dev.db`、`prisma/prisma/ci.sqlite*`、`temp-*.json`、`scripts/deploy-*-www.py`、`scripts/upload-1onework-releases.py`、`docs/_build_1one_roadshow.py`、`test-template-selector.ts`、`scripts/__pycache__/` 等。
- `CONTEXT.md` 是本轮明确按用户要求重写的最新上下文，应保留。
- 提交时使用 exact-path staging，或在干净 worktree 操作；不要使用 `git add .`。

## 推荐接手顺序

1. 先审阅并决定是否保留本轮游戏质量/遥测改动；可分为“移动端”“游戏质量”“平台遥测”“发布检查”四个独立提交，避免混入用户改动。
2. 对 `GameplayEvent` 在新 SQLite 临时库/干净 worktree 做 `prisma migrate deploy` 验证，再决定是否上生产。
3. 把 `creator-workflow.ts` 接到三条线的**详情 API 和生成响应**：统一返回 `{ workflow: { stage }, quality: { verdict, score?, evidence[] } }`，但先不要硬拦截公开。
4. 给小说做章节级质量报告（开篇钩子、角色一致性、章节完整性、可继续生成）；给漫画做页级报告（角色/场景一致性、文字安全区、分镜连续性、局部重绘）。这两者必须与游戏的质量报告使用同一平台外壳。
5. 统一创作台为“Brief → 生成 → 质量反馈 → 局部修改 → 发布”的跨媒介流程；避免只在游戏详情页加指标。
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
