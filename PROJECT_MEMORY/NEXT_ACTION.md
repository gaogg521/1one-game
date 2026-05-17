# NEXT_ACTION

更新时间：**2026-05-17**

## 最高优先级

1. **部署**：`npx prisma migrate deploy` + `npx prisma generate`（生产/新环境）  
2. **中篇/长篇实机**：创作页再跑一条中篇流式 + 一条长篇分段（验证网关 10～30min 超时）  
3. **肉眼扫一眼**六模板试玩动效 — 见 `B_TEMPLATE_HANDTEST_MATRIX.md`  
4. 漫画 **32 格配图** — `npm run qa:comic-32-panels`，结果写 `COMIC_32_PANEL_LONGTEST.md`  
5. 工作室 **批量删除**（产品待确认交互）

## 维护

- 调模型/超时/篇幅：改 **`src/lib/product-config.ts`** 与 **`src/lib/novel-length.ts`**，勿再增 `.env` 业务项  
- 全量回归：`npm run qa:full`  
- 改 schema 后：关 8888 → `npx prisma generate`

## 脚本速查

| 脚本 | 用途 |
|------|------|
| `npm run qa:full` | 全量 QA（ci.sqlite + E2E + 手测） |
| `npm run qa:template-matrix` | 六模板离线 |
| `npm run qa:comic-32-panels` | 8 页分镜 + 32 格 SSE 长测 |
| `npm run simulate:handtest` | HTTP 手测（需 :8888） |
| `npx tsx scripts/qa-novel-long-plan.ts` | 长篇分段计划离线检查 |
