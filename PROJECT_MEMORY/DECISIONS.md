# DECISIONS

更新时间：**2026-05-16**

## 架构决策（三轮追加）

- **文生图主路径**：生产环境以 **OpenAI 兼容网关**（`IMAGE_GEN_OPENAI_MODEL`，默认 `gpt-image-2`）为准；**ComfyUI 仅当配置 `COMFY_UI_BASE_URL`**，且当前实现为逐张串行、内置 SDXL 工作流，与用户自建 Comfy 工具链不一致。  
- **短篇配图批量**：≤`IMAGE_GEN_BATCH_PANELS`（默认 4）格时 **单次 `images.generate` + `n=4`** + 合并 prompt；失败降级 **4 路并行逐张**。  
- **长篇漫画创建**：`panelCount > 4` 时 **不在 `POST /api/comic/generate` 内联配图**，状态 `pending_images`，由 **`POST /api/comic/[id]/panels/stream`** 流式补图（避免平台超时）。  
- **小说广场删除**：列表 API 返回 **`isOwner`**（不暴露 `ownerKey`）；仅作者在广场卡片可删；关联漫画 **级联删除**（Prisma `onDelete: Cascade`）。  
- **客户端耗时文案**：`formatImageGenElapsed` 放在 **`src/lib/format-duration.ts`**，禁止详情页从 `comic-panel-render` 导入（会拖入 `image-generation` → `fs`）。

## 架构决策

- **Studio「我的作品」**：游戏走 `/api/projects`（须 owner Cookie）；小说 / 漫画列表用 **`GET ?mine=1`**，与公开发现页（无 `mine`）分离。  
- **漫画分镜 LLM 输出**：不再要求模型 **恰好** 返回目标页数 × 4 格；服务端用 **`normalizeComicPagesForGeneration`** 补齐，降低 502 率。  
- **生成 API 请求体**：默认上限 **524288 字节**（`read-json-body.ts`）；可通过 `GENERATE_BODY_MAX_BYTES` 覆盖。

## 技术取舍

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
