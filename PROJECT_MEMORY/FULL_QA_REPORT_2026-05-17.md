# 全量自测报告 · 2026-05-17

## 环境

- DB：`file:./prisma/ci.sqlite`（`migrate deploy` 已应用 8 条迁移）
- 服务：`npm run start` @ **8888**，`E2E_REFINE_STUB=1`
- 一键：`npm run qa:full` → `scripts/run-full-qa.ps1`

## 结果摘要

| 项 | 结果 |
|----|------|
| `npm run build` | ✅ |
| `qa:template-matrix` | ✅ 6/6 |
| `qa:director-spec` | ✅ |
| `qa:refinement-log` | ✅ |
| `qa:novel-comic-smoke` | ✅ |
| `qa:studio-duplicate` | ✅（需与 8888 同库 `ci.sqlite`） |
| Playwright `e2e/` | ✅ **24/24** |
| `simulate-handtest` + 8 页分镜 | ✅ ~210s，`cmp9ob8ky000k8gqe1kmbklya` |
| `qa:comic-32-panels` 配图 SSE | ⏳ 重跑中（上次仅 1/32 格后因重启服务中断） |

## 修复项（本轮）

- `saveRefinementLogJson`：无 `refinementLogJson` 列时不 500
- `qa-studio-duplicate.ts`：校验 `mine=1` 与服务库一致
- `npm run qa:full` 统一 ci.sqlite + 全链路

## 仍须人工

- 六模板肉眼玩一局（章节/事件动效）
- 中篇小说流式复测（网关超时已改 600000）
- `dev.db` 若 `migrate` 报 duplicate column，需 `prisma migrate resolve` 或删库重建
