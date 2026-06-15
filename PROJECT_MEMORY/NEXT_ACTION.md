更新时间：**2026-06-15**（迭代三十 · 宋辽满格+精选 ✅）

更新时间：**2026-06-14**（迭代二十九 · 全链路收口 ✅）

更新时间：**2026-06-14**（迭代二十八 · 竞品克隆批量门禁 ✅）

更新时间：**2026-06-14**（迭代二十七 · 竞品克隆三件套 ✅）

更新时间：**2026-06-14**（迭代十九 · QA 工程化 ✅）

更新时间：**2026-06-14**（迭代二十一 · 宋辽 QA 产物链 ✅）

更新时间：**2026-06-14**（迭代二十二 · 缓存解析 + 链式 QA ✅）

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
| ⬜ | 六模板章节感 **可选** PM 肉眼抽测（自动化已签收） |
