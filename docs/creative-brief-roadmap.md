# Creative Brief 后续清单

> 状态：2026-05-20 第 5～8 项已实现。

| # | 项 | 状态 | 说明 |
|---|-----|------|------|
| 1 | 扩展题材知识包（武侠 / 恐怖 / 二次元） | ✅ | `genre-packs.ts`：`wuxia-jianghu`、`horror-survival`、`anime-action` |
| 2 | Brief ↔ theme 一致性 lint + 自动对齐 | ✅ | `lint-theme.ts` + `runFinalizeLintRepair` |
| 3 | 创作台可编辑 Brief 并按修订重新生成 | ✅ | `CreativeBriefPanel` + `format-revision.ts` |
| 4 | Brief → 游戏封面 / 出图 prompt | ✅ | `cover-prompt.ts`、`cover-generation` `type: "game"` |
| 5 | 更多题材包（民俗、体育、解谜…） | ✅ | `folklore-festival`、`sports-arcade`、`puzzle-logic` |
| 6 | Brief 独立 API + 持久化到 Project | ✅ | `POST /api/creative-brief/expand`；`Project.creativeBriefJson`；保存时 `creativeBrief` 字段 |
| 7 | Comfy 工作流直接消费 Brief | ✅ | `game-brief-comfy-cover.ts`；`POST /api/projects/[id]/brief-cover`；Comfy 负面词来自 `brief.negatives` |
| 8 | 多语言 Brief 扩写 | ✅ | `detect-input-locale.ts`、`locale-prompts.ts`；`inputLocale` 写入 Brief |
| 9 | 小说 / 漫画创意扩写 | ✅ | `format-novel.ts`、`format-comic.ts`；接入小说/漫画 SSE `step: brief` |
| 10 | 预览 / 修订 / 持久化 | ✅ | 创作页「预览扩写」；`briefRevision` + `preExpanded` 免重复 LLM；`Novel`/`Comic.creativeBriefJson` |

## API 速查

- **扩写（独立）**：`POST /api/creative-brief/expand` — body: `{ prompt, medium?: "game"|"novel"|"comic", templateHint?, skipLlm?, referenceSnippet? }`
- **保存作品**：`POST|PATCH /api/projects` — body 增加 `creativeBrief`
- **Brief 封面**：`POST /api/projects/:id/brief-cover` — 需已保存 Brief；优先 `COMFY_UI_BASE_URL`，否则文生图降级
