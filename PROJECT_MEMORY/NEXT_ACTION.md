更新时间：**2026-06-14**（迭代十八 · 中篇漫画根因 ✅）

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
| ⬜ | 四档小说 + 中篇漫画**全量实机**（无 `SKIP_COMIC_PANELS` / `QA_SKIP_CHAR_SHEETS`；需 API Key，预计 30min+） |
| ⬜ | git commit（需用户明确要求） |
| ⬜ | Console SSO 生产 IdP 联调（需企业 Azure/飞书配置） |
| ⬜ | 六模板章节感 PM 肉眼签收（自动化已覆盖结构） |
