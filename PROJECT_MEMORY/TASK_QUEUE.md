# TASK_QUEUE

更新时间：**2026-05-16**

## 已完成任务

- Studio 三类型合并列表 + 筛选（`iterations/2026-05-16.md` #11）  
- 小说 / 漫画封面、分享、独立列表页（同日迭代）  
- **Studio 加载容错 + `mine=1` 列表 API**（本会话）  
- **漫画分镜规范化 + 请求体上限 + 前端错误提示**（本会话）

## 当前进行中任务

- （无 Agent 占用）— **待用户本机**：`prisma generate` 后验证漫画短篇生成

## 待执行任务（按优先级排序）

1. **P0** — 本机 `npx prisma generate`，重启 dev，确认 Studio / `GET /api/comic` 无 Prisma validation 500  
2. **P0** — 用短篇梗概跑通 `/comic/create` → 详情页有分镜（配图可部分占位）  
3. **P1** — 检查 `.env` 是否仍设 `GENERATE_BODY_MAX_BYTES=98304`，与长梗概创作对齐  
4. **P1** — 回归：`npm run build`、`npx playwright test`（若有环境）  
5. **P2** — 漫画生成 SSE / 分步进度（体验）  
6. **P2** — Studio：novel/comic 复制；批量操作（见迭代「已知限制」）  
7. **P3** — 工作区变更整理并 **git commit**（需用户明确要求）
