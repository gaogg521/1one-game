# 编排框架（Orchestration）—— 落地说明

本项目采用「**规格驱动运行时 + DAG 编排**」路线，优先开源组件。本文描述 **Phase 0～4 当前已实现** 部分与扩展方式。

## Phase 0（已实现）

- **`ContextPack`**：从创作请求推导出的策展上下文（路由、布尔开关、`hasReferenceSnippet`、**`qualityTier`** 来自环境变量）。
- **`RunTraceRecorder`**：`creative_brief_expand`、`web_search`、`spec_draft`、`spec_enhance`、编排 **note**：`client_asset_manifest`（条目/revision）、`comfy_probe`（见 Phase 3）、**`godot_web_prefetch`**（生成完成后异步 Godot Web 预导出，不阻塞 SSE）等；SSE `done.debug.orchestrationTrace` 与前端「生成证据」折叠。
- 入口：`createRunTraceRecorder()`（`src/lib/orchestration/run-trace.ts`）。

### 并行与等待时间（已实现）

- **联网检索正文**：`tryWebEnhance` 内对多条候选 URL 的 `fetchUrlPlainText` 使用 **`Promise.all`** 并行抓取（失败条目跳过），缩短 `web_search` 阶段墙钟时间。
- **Rich + Trace**：当 **`qualityTier === rich`** 且请求携带 **`RunTraceRecorder`** 时，`generateGameSpecWithMeta` 将 **`probeComfyHealthDetailed`** 与 **`generateGameSpecDraftWithMeta`**（内部含检索与初稿 LLM）**并行 `Promise.all`**，探活结束后再写入 **`comfy_probe`** note；不改变规格语义，仅减少串联等待。

## Phase 1（已实现）

- **`lintGameSpecForOrchestration`**：Zod 结构 + 塔防语义（path/waves、`enemyId` 引用、`director.events.at`）。
- **`generateGameSpecWithMeta` 收口**：生成流程在返回前经 **`finish()`** 做多轮 **`lint_spec` → `repairGameSpecFromIssues`**（轮数 **`ORCHESTRATION_MAX_REPAIR_ROUNDS`**，默认 2）；trace 挂载 orchestration。
- `src/lib/orchestration/lint-spec.ts`、`src/lib/generate-spec.ts`。

## Phase 2（已实现）

- **`AssetManifestV1`**：索引参考图条目（不写像素）；`buildAssetManifestFromReferencePayloads`（`src/lib/orchestration/asset-manifest.ts`）。
- **会话键** `gc:assetManifest:v1`：`asset-manifest-session.client.ts`。
- **创作台**：参考图 ingest 后与 session payloads **同步写入**清单；清空参考图时 **同步 clear** manifest（`src/app/create/CreateClient.tsx`）。生成请求可向服务端附带 **`assetManifest`**（元数据）；编排 trace **`client_asset_manifest`** 记录条目数便于排查。

## Phase 3（占位已实现）

- **`getComfyBaseUrl` / `probeComfyHealth` / `probeComfyHealthDetailed`**：`COMFY_UI_BASE_URL`，探测 **`{base}/system_stats`**，超时由 **`COMFY_PROBE_TIMEOUT_MS`** 控制。
- **API**：`GET /api/orchestration/comfy-status` → `baseUrlConfigured`、`reachable`、`probeMs`、`timedOut`。
- **Trace**：仅在 **`ORCHESTRATION_QUALITY_TIER=rich`** 且存在 **`RunTraceRecorder`** 时写 **`comfy_probe`** note；探测与 **`generateGameSpecDraftWithMeta`** **并行发起**，结束后写入 trace（不改变规格结果）。

## Phase 4（已实现）

- **脚本冒烟**：`npm run qa:orch-smoke` → `scripts/qa-orchestration-smoke.ts`（`mockSpecFromPrompt` + `lintGameSpecForOrchestration`，多模板提示）。
- **E2E**：`npm run test:e2e` → Playwright；本地默认 **`npm run dev`（8888）**；CI 使用 **`PW_START=1`** 走 **`npm run build` + `next start`（8888）**，覆盖首页与 `/create` 冒烟。
- **CI**：`.github/workflows/ci.yml`——**并行** `lint` + `qa:orch-smoke`；以及 **build → E2E（生产服务器）**。

## 相关代码路径

| 用途 | 路径 |
|------|------|
| 编排导出 | `src/lib/orchestration/index.ts` |
| 生成流水线（草稿 / 强化 / lint-repair） | `src/lib/generate-spec.ts` |
| 一句话深度扩写（Creative Brief） | `src/lib/creative-brief/` |
| Godot 预导出调度 | `src/lib/godot-prefetch-scheduler.ts`、`src/lib/godot-prefetch.client.ts` |
| 双轨规格 enrich | `src/lib/enrich-game-spec.ts` |
| 参考图分类（Phaser/Godot） | `src/lib/reference-classify.ts` |
| SSE 附带 trace | `src/app/api/generate/stream/route.ts` |
| 近期迭代纪要 | `docs/recent-progress.md` |
| AI 接手稿（架构总览） | `docs/ai-handoff-architecture-cn.md` |

环境变量示例见项目根目录 **`.env.example`**（编排、生成 API、`COMFY_PROBE_TIMEOUT_MS` 等）。

更新本文时请同步 bumped Phase 完成情况。
