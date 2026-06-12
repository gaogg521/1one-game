# NEXT_ACTION

更新时间：**2026-06-12**

## 最高优先级（Astrocade 级）

1. **实机 LLM 生成**：创作页 generate/stream → spec 含 LLM agentic（非 fallback）抽检  
2. **Godot 3D 深化**：chess / customization 视觉向 Astrocade demo 靠拢  
3. **资产生成对齐**：封面 prompt 与试玩 sprite 风格统一校验  

## 维护

- 全量游戏 QA：`npm run qa:astrocade-pipeline`  
- 调编排/Agentic：`product-config.ts` 或 `.env` → `ORCHESTRATION_QUALITY_TIER` / `AGENTIC_GAME_MODULE`  
- 改 schema 后：关 8888 → `npx prisma generate`

## 脚本速查

| 脚本 | 用途 |
|------|------|
| `npm run qa:astrocade-pipeline` | Astrocade 级聚合 QA |
| `npm run qa:template-matrix` | 13 模板 + 15 样品离线 |
| `npm run qa:gameplay-agent` | Playwright 样品试玩（9 条） |
| `npm run qa:full` | 全量 QA（ci.sqlite + E2E） |

