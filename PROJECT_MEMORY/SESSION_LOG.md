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

