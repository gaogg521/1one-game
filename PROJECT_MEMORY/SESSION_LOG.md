# SESSION_LOG

> 新条目置顶。

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
