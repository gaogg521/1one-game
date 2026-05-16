# TASK_QUEUE

更新时间：**2026-05-16**

## 已完成任务

- Studio 三类型合并 + `mine=1` + 删除  
- 漫画分镜规范化 + 请求体上限 + 前端错误提示  
- **动漫列表 Prisma coverPath 绕过**（`comic-list-query`）  
- **漫画 SSE 配图进度 + 每格耗时**  
- **文生图批量 n=4 + 并发 4 配置**  
- **小说广场本人删除**  
- **《煤山崇祯》2 页漫画 + 8 格配图**（`cmp8e84lk0001x6zgo8jrd8jg`）

## 当前进行中

- （无）

## 待执行（按优先级）

1. **P0** — 本机 `npx prisma generate`（若仍有 Prisma validation 500）  
2. **P0** — 修复 **中篇 8 页分镜 LLM 502**（分段生成或缩小单次 Schema）  
3. **P1** — 用户验收煤山崇祯漫画；按需生成完整 8 页（预估配图 40+ 分钟）  
4. **P1** — 回归 `npm run build`、可选 `benchmark-comic-panel-http.mjs`  
5. **P2** — Studio：novel/comic 复制；批量删除  
6. **P3** — 工作区 **git commit**（需用户明确要求）
