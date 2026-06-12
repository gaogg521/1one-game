# CURRENT_STATUS

更新时间：**2026-06-12**（Astrocade 级 Phase 1–4 重构）

## 项目整体进度

完成度：**Astrocade 级编排默认开启，专用运行时 + Agentic 双轨可用**  
当前阶段：默认 `qualityTier=astrocade`、`agenticModuleEnabled=true`；13 语义模板 + 15 样品专用 Phaser/Godot 运行时；用户新生成走 Agentic 沙箱。

## Astrocade 级（2026-06-12）

| 项 | 状态 |
|----|------|
| 编排档位 `astrocade` | ✅ 默认 MultiAgent + 深度 Brief |
| Agentic 模块 | ✅ 生成/refine LLM+repair；POST 同步 template fallback |
| Agentic QA 闭环 | ✅ validateAgenticRunnable + repair loop + `qa:agentic-repair` |
| E2E 用户路径 | ✅ `e2e/astrocade-agentic.smoke.spec.ts` POST→AgenticScene→canvas |
| 专用 Phaser 场景 | ✅ puzzle/farming/physics/chess/customization/coaster/strategy |
| Godot 专用 runtime | ✅ 同上 + strategy；`GODOT_RUNTIME_BUILD_REV=20260612-astrocade-tier` |
| 资产 V2 manifest | ✅ background API + Play 页 session 写入 |
| QA 流水线 | ✅ `npm run qa:astrocade-pipeline` 全绿 |

## 各模块状态

| 模块 | 状态 | 备注 |
|------|------|------|
| 游戏生成 / 试玩 | ✅ | Astrocade 默认 Agentic；样品馆仍用专用场景保 demo 质量 |
| refine API | ✅ | patch 模式也会 attach agentic |
| 小说 / 漫画 / Studio | ✅ | 未改 |

## 脚本速查（游戏 QA）

| 脚本 | 用途 |
|------|------|
| `npm run qa:astrocade-pipeline` | 编排档位 + 用户路径 + 模板矩阵 + Agentic + 试玩 |
| `npm run qa:astrocade-user-path` | 用户生成 Agentic attach + 样品隔离 + 资产 slots |
| `npm run qa:template-matrix` | 13 模板 + 15 样品 |
| `npm run qa:gameplay-agent` | 9 样品 Playwright 试玩 |

## 已知差距（相对 Astrocade 产品）

1. **LLM Agentic 玩法质量**仍依赖模型；POST/remix 走 instant fallback，完整 LLM 在 generate/refine  
2. **封面与试玩资产一致性**——V2 slots + AgenticScene preload 已接  
3. **Godot 全模板 3D**——coaster 天空已主题化；chess 仍 2D 简化盘  
4. **实机 LLM 抽检**：生产环境需监控 LLM vs fallback 比例

## 文档

- 决策：`PROJECT_MEMORY/DECISIONS.md`（Astrocade tier）
- 环境：`.env.example` → `ORCHESTRATION_QUALITY_TIER` / `AGENTIC_GAME_MODULE`

