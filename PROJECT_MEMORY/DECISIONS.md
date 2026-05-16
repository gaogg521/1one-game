# DECISIONS

更新时间：**2026-05-16**

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
