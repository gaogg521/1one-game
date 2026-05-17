# B 档 · 共创链路审计 & Director 消费矩阵（PR-A000 / PR-B000）

更新时间：**2026-05-17**

## 1. 用户路径（共创 → 试玩 → 再精炼）

1. **`/create`**：四步共创 → 调用 **`POST /api/generate`** 或 **`POST /api/generate/stream`**（及可选 **`POST /api/generate/variants`**）→ 得到 `GameSpec`。  
2. **保存作品**：客户端 **`PATCH /api/projects/[id]`**（`prompt` + `spec`）写入 Prisma `Project.prompt` / `specJson`。  
3. **`/play/[id]`**：**`GET /api/projects/[id]`** 拉取 `spec`；试玩内 **Phaser** 读 `spec`。  
4. **继续改玩法**：  
   - **访客**：**`POST /api/generate/patch`**（`prompt` + `currentSpec` + 可选 `currentPrompt`）→ 返回新 `spec`（不写库）。  
   - **作品主人**：**`POST /api/projects/[id]/refine`**，`body: { instruction, mode: "patch" | "regenerate" }` → 返回新 `spec` / `prompt`，并 **`append` `refinementLogJson`**（仍 **`PATCH`** 项目才真正落 spec）。  
5. **`/create?from=<projectId>`**：**`GET /api/projects/[id]`** → 填回描述；主人可见 **`refinementHistory`** 摘要。

## 2. Director / Systems 消费矩阵（摘要）

| templateId | 主要文件 | `director.intensity` | `director.acts` | `director.events` | `systems.skill` | `systems.powerups` |
|------------|----------|----------------------|-----------------|-------------------|-----------------|---------------------|
| avoider/collector/survivor | `PlayScene.ts` | ✓ | ✓ 章节 HUD / modifier 文案 | ✓ coinRain / goalShift / miniBoss | ✓ | ✓（powerups 池） |
| platformer | `PlatformerScene.ts` | ✓ | ✓ 重力 / 段落 | ✓ | ✓ | ✓ |
| shooter | `ShooterScene.ts` | ✓ | ✓ 波次感 | ✓ | ✓ | — |
| towerDefense | `TowerDefenseScene.ts` | ✓ | ✓ 经济与节奏 | ✓ | ✓（文案占位） | — |
| （全局） | `createPhaserGame.ts` | ✓ 默认铺底参数 | — | — | — | — |

**未知 `events[].type`**：仅横幅 + 计时；**未知 `acts[].modifiers`**：静默忽略（见 `DECISIONS.md`）。
