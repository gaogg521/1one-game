# DECISIONS

更新时间：**2026-05-17**

## 2026-05-17 — 产品配置内聚

- **业务参数不进 `.env`**：模型 ID、超时、限流、漫画并发、长篇分段等统一在 **`src/lib/product-config.ts`**（长篇分段细节在 **`novel-long-config.ts`**）。**.env 仅密钥与网关**（`OPENAI_API_KEY`、`OPENAI_BASE_URL` 等）。发版改行为改代码并走 CI，避免终端用户/运营误配环境变量。
- **网关超时**：默认 `x-openclaw-timeout-ms` 由 product-config 注入；小说 **`createNovelOpenAIClient(tier)`** 按篇幅覆盖（中篇 10min、长篇 30min）。
- **测试资产入库**：`prisma/ci.sqlite`、`public/covers/openai-*.png` 等无敏感信息样例随仓库提交，供 E2E/手测/文档对照。

## 架构决策（三轮追加）

- **Director「B 档」对齐**：`buildDirector` 固定 **`actCount = 4`**（开场 / 加速 / 变奏 / 终局），便于各模板章节 banner 与难度弧线一致；**`avoider` / `collector` / `survivor`** 在随机 roll 之后 **保底注入 `coinRain`、`goalShift`、`miniBoss` 各至多一次**（模板差异化 title/message），避免一局「像无尽而没有关卡结构」。  
- **生成 JSON Schema（可选 director）**：默认不设 **`GAME_SPEC_JSON_SCHEMA_INCLUDE_DIRECTOR`**，LLM json_schema 仅绑定核心 GameSpec；设为 **`1`** 时允许可选输出 **`director`**。**`coerceGameSpec`** 对任意来源只要 Zod 通过即保留 **director / systems**。  
- **游戏生成产品形态**：不再把 `/create` 定义为“单轮 prompt -> 一次生成”，而是正式升级为 **4 步共创流程**：输入创意 → 提炼意图 → 候选方向 → 生成试玩。**B 档扩展目标**：在同一项目上叠加 **多回合 refinement**（见 `TASK_QUEUE`）。  
- **项目版本真相源**：`Project.prompt + Project.specJson` 作为游戏创作真相源；试玩页 patch 与 quick tune 允许回写项目，避免一次性产物。  
- **再编辑入口**：`/create?from=` 必须恢复 **完整项目上下文**（至少 prompt + spec），而不是只恢复旧 prompt。  
- **共享玩法层策略**：优先把 `systems.skill` 与 `director.events` 真正接入模板运行时，再继续扩 schema；先从 `shooter` 和 `towerDefense` 落地。  
- **塔防标杆策略**：TowerDefense 继续作为第一标杆模板，通过 **rush / elite / 守点事件 / 经济奖励** 抬高可玩性，而非仅做视觉换皮。

- **文生图主路径**：生产环境以 **OpenAI 兼容网关**（`IMAGE_GEN_OPENAI_MODEL`，默认 `gpt-image-2`）为准；**ComfyUI 仅当配置 `COMFY_UI_BASE_URL`**，且当前实现为逐张串行、内置 SDXL 工作流，与用户自建 Comfy 工具链不一致。  
- **短篇配图批量**：≤`IMAGE_GEN_BATCH_PANELS`（默认 4）格时 **单次 `images.generate` + `n=4`** + 合并 prompt；失败降级 **4 路并行逐张**。  
- **长篇漫画创建**：`panelCount > 4` 时 **不在 `POST /api/comic/generate` 内联配图**，状态 `pending_images`，由 **`POST /api/comic/[id]/panels/stream`** 流式补图（避免平台超时）。  
- **小说广场删除**：列表 API 返回 **`isOwner`**（不暴露 `ownerKey`）；仅作者在广场卡片可删；关联漫画 **级联删除**（Prisma `onDelete: Cascade`）。  
- **客户端耗时文案**：`formatImageGenElapsed` 放在 **`src/lib/format-duration.ts`**，禁止详情页从 `comic-panel-render` 导入（会拖入 `image-generation` → `fs`）。

## 架构决策

- **Studio「我的作品」**：游戏走 `/api/projects`（须 owner Cookie）；小说 / 漫画列表用 **`GET ?mine=1`**，与公开发现页（无 `mine`）分离。  
- **漫画分镜 LLM 输出**：不再要求模型 **恰好** 返回目标页数 × 4 格；服务端用 **`normalizeComicPagesForGeneration`** 补齐，降低 502 率。  
- **生成 API 请求体**：默认上限 **524288 字节**（`PRODUCT.api.bodyMaxBytes`）。

## 技术取舍

- **`director.events[].type` 未知**：各 Scene 仅对 `coinRain` / `goalShift` / `miniBoss` 做玩法映射；其它类型 **只展示横幅并按 `durationMs` 结束**，不改变 scoreMult / 刷怪池等，避免脏规格拖垮一局。  
- **`director.acts[].modifiers` 未知**：各模板用 `includes()` 识别；**未识别 modifier 静默忽略**。  
- Studio 加载：**部分失败仍展示已成功列表**，错误文案拼接展示，避免笼统「网络异常」。  
- `projects` **401**：视为「暂无游戏」，不阻断小说 / 动漫列表。  
- `mine=1` 且无 owner Cookie：返回 **空列表**（200），与 `projects` 401 策略略不同（历史兼容）。  
- 漫画路由 **未** 固定 `maxDuration`（避免部分运行环境空白 500）；长跑超时由部署平台配置。

## 历史兼容要求

- `parseComicImageUrls` 仍兼容旧版 **panel 数组** 存 `imageUrls`。  
- 公开列表 API 行为不变（无 `mine` 参数时仍为广场列表）。

## 禁止修改部分

- 勿在 `PROJECT_MEMORY/` 写入密钥、token、`.env` 原文。  
- 无用户明确要求时 **不代 git commit / push**（用户规则）。
