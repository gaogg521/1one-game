# NEXT_ACTION

更新时间：**2026-05-17**

## 最高优先级

1. **肉眼扫一眼**六模板试玩（章节/事件动效）— E2E **24/24** 已绿，见 `B_TEMPLATE_HANDTEST_MATRIX.md`  
2. **中篇小说**：`.env` 网关超时已改为 600000；小说 API 用 `llmNovelTextStream` 覆盖短超时头 — 请再试崇祯煤山那条  
3. **部署**：`npx prisma migrate deploy` + 停 8888 后 `npx prisma generate`（消除 coverPath/lengthTier Client 漂移）  
4. **git commit**（需你明确要求）  
5. 漫画 **32 格配图** — `npm run qa:comic-32-panels` 后台跑，结果见 `COMIC_32_PANEL_LONGTEST.md`  
6. 本地全量回归：`npm run qa:full`（见 `FULL_QA_REPORT_2026-05-17.md`）  
7. 工作室批量删除仍待做

## 产品 / 技术后续

1. **B 档**：全模板一致体验的手测矩阵（TD / shooter / platformer / collector / survivor / avoider）与文档、README 能力描述对齐  
2. **游戏模板横向扩展**：shared systems/director 在 `collector / survivor / avoider` 与生成侧字段深度一致，而非仅 UI 文案  
3. **中篇 8 页分镜 502**：降低单次 Schema 页数、分段 LLM、或加强 cascade 重试  
4. **可选**：`.env` 确认 `IMAGE_GEN_BATCH_PANELS=4`、`COMIC_PANEL_GEN_CONCURRENCY=4`  
5. 回归：`npm run build`；必要时补手测脚本  
6. 工作区变更 **git commit**（需用户明确要求）

## 脚本速查

| 脚本 | 用途 |
|------|------|
| `npm run qa:director-spec` | 离线：mock director + coerce 保留 director |
| `node scripts/generate-comic-for-novel.mjs <novelId> [pageCount]` | 分镜 + 流式配图 |
| `node scripts/benchmark-comic-panel-http.mjs` | HTTP 配图耗时 |
| `node scripts/peek-novel-comic.mjs <novelId>` | 查小说与关联漫画 |
