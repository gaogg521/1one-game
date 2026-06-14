# 全量回归报告

- 时间：2026-06-13
- 命令：`npm run qa:full` + 续跑 E2E/handtest
- 环境：`DATABASE_URL=file:./prisma/ci.sqlite` · dev @8888 · `E2E_COMIC_STUB=1`

## 修复项（本轮）

| 问题 | 修复 |
|------|------|
| `qa:astrocade-pipeline` 期望 attach agenticModule | 对齐 template-first 架构，用 `checkAstrocadeParity` |
| `templateHint=physics` 被归一为 auto | `normalizeTemplateHint` 改用 `isGameTemplateId` 全模板 |
| `qa:generate-stream-sse` 路由 ShooterScene | 同上 + `finish()` 再 apply hint |
| E2E admin-tab-runtime 重复 | 侧栏 `aside` 定位 |
| E2E novel/discover networkidle 超时 | 改为 `domcontentloaded` |

## 结果摘要

| 阶段 | 结果 |
|------|------|
| migrate + seed + build | ✅ |
| qa:astrocade-pipeline | ✅ |
| qa:director-spec / refinement / novel-comic-smoke | ✅ |
| qa:studio-duplicate / multilingual / en-path | ✅ |
| qa:b-tier-smoke (8/8) | ✅ |
| qa:admin-console (21/21) | ✅ |
| Playwright E2E (81, 排除 Godot 16 矩阵) | ✅ 81/81 |
| qa:game-effect-compare | ✅ 23/23 |
| simulate-handtest | ✅ |
| qa:generate-stream-sse | ✅ physics → PhysicsScene |

## 验证命令

```bash
npm run qa:full
npm run qa:historical-closure   # 历史问题总验（可选）
```
