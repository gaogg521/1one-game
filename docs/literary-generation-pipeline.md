# 小说 / 漫画生成：LLM 是作者，采集不要丢

> **下一任 AI 必读。** 游戏线见 [`game-generation-pipeline.md`](game-generation-pipeline.md)。文学线**没有** Phaser 内核，不要把游戏的「正则锁核」搬过来。

相关代码：`src/app/api/novel/generate/stream/route.ts`、`src/lib/comic-pipeline.ts`、`src/lib/comic-generate-run.ts`、`src/lib/work-generation-meta.ts`  
决策记录：`PROJECT_MEMORY/DECISIONS.md`（2026-08-27 文学条）

---

## 和游戏的差别

| | 游戏 | 小说 | 漫画分镜 |
|--|------|------|----------|
| 玩家/读者拿到什么 | 有限 Phaser 模板 + GameSpec | **模型写出的正文** | **模型写出的分镜 JSON**，再另走文生图 |
| 默认作者 | LLM（内核只校验/兜底） | LLM | LLM |
| 校验 / 编排 | 可玩性合同、delivery | 篇幅档、故事圣经、章节计划、完整性 | 导演包、一致性、版式 |
| 失败兜底 | 内核编译可玩 spec | **不造假正文**，报错或让用户续写 | `buildEmergencyComicPages` 占位页（类似内核，不是作者） |

不要因为「后台要看模型」去给小说/漫画加一套关键词模板作者。采集是埋点。

---

## 小说

1. 作者是 `getNovelStyleTextModelCascade` 里实际跑成功的模型。圣经 / 章纲 / 完整性检查只编排和验收，不代替写作。
2. 长篇草稿 `createDraftGeneratingNovel` **创建时就要写下** provider + 当前 cascade 首模；`finalizeDraftNovel` 再用真正跑完的模型覆盖。
3. 短篇/中篇在 `prisma.novel.create` 时写入 `normalizeWorkGenerationProvenance`。
4. **续写不改** `generationProvider` / `generationModel`：后台记的是**成稿作者**，不是最后一次续写。
5. 没有可用模型就失败，不要用本地假正文冒充某模型。

---

## 漫画

分镜和配图是两条模型，后台目前只有一对 `generationProvider` / `generationModel`：

| 字段记什么 | 不记什么 |
|------------|----------|
| **分镜 LLM**（`comic_storyboard` / 长导演包） | 逐格文生图模型（`comic-panel-render` 日志里另有 `provider/model`） |

1. 轻量分镜：`llmJson` 返回的 `provider`/`model` 原样上送。
2. 长导演：返回时必须 `provider: getActiveProvider()`，**禁止空字符串**（空串规范化后变成 null，后台「未记录」）。
3. 分镜 checkpoint / 成稿保存都要带 provenance，不要等全部跑完才写。
4. `storyboardSource === "emergency"`：占位页不是模型写的，但仍记下**当时尝试的** provider/model，方便看「哪个模型失败后兜底」。不要把空 provider 落库。
5. 配图重跑（`/api/comic/[id]/panels`）**不得覆盖**分镜 provenance。

---

## 反例（已经踩过）

1. 长导演内层 `provider: ""` → 落库成未记录。
2. 应急分镜 `provider: ""`，只剩 model 或全空。
3. 长篇/分镜草稿不写 provenance，后台列表里生成中的作品全是「未记录」。
4. 把文学线理解成「也要先锁一个内核模板」。小说/漫画的产品就是模型文本，不是模板编译器。

---

## 可见性（直链 vs 发现页）

新作品默认 `pending_review`，**不会**静默变成 `public`。

| | 发现页 / 推荐 | 打开 `/novel/[id]` `/comic/[id]` |
|--|--|--|
| `public` + `ready` | 列出 | 可读 |
| `public` / `pending_review` + `pending_images` | 不列出 | **持有 URL 可读**（分镜已出、配图未齐） |
| `pending_review` + `ready` | 不列出 | **持有 URL 可读** |
| `hidden` | 不列出 | 仅作者 |

详情 GET 用 `canAccessWorkByDirectLink`；列表仍用 `publicReadyWorkWhere`。不要再把待审核伪装成「作品不存在」。
