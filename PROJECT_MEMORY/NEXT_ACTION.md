# NEXT_ACTION

更新时间：**2026-05-16**

## 最高优先级

1. **本机**（若 API 仍报 Prisma 字段不存在）：关 dev → **`npx prisma generate`** → 重启 **`npm run dev -p 8888`**  
2. **验收《煤山崇祯》漫画预览**：打开 [http://localhost:8888/comic/cmp8e84lk0001x6zgo8jrd8jg](http://localhost:8888/comic/cmp8e84lk0001x6zgo8jrd8jg)（2 页 / 8 格已配图）  
3. **清理低质量小说**：小说广场悬停 **本人卡片 → 删除**，或 **工作室** 筛选小说删除  

## 产品 / 技术后续

1. **中篇 8 页分镜 502**：降低单次 Schema 页数、分段 LLM、或加强 cascade 重试  
2. **可选**：`.env` 确认 `IMAGE_GEN_BATCH_PANELS=4`、`COMIC_PANEL_GEN_CONCURRENCY=4`  
3. 回归：`npm run build`；`node scripts/benchmark-comic-panel-http.mjs`（可选）  
4. 工作区变更 **git commit**（需用户明确要求）

## 脚本速查

| 脚本 | 用途 |
|------|------|
| `node scripts/generate-comic-for-novel.mjs <novelId> [pageCount]` | 分镜 + 流式配图 |
| `node scripts/benchmark-comic-panel-http.mjs` | HTTP 配图耗时 |
| `node scripts/peek-novel-comic.mjs <novelId>` | 查小说与关联漫画 |
