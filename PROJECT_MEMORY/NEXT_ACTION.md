# NEXT_ACTION

更新时间：**2026-05-16**

## 最高优先级任务

1. **本机**：关闭 `npm run dev` / `next start` → **`npx prisma generate`** → 重启 dev → 打开 **`http://localhost:8888/studio`** 确认无红条。  
2. **验证漫画**：`/comic/create`，篇幅选 **短篇**，粘贴梗概（如「煤山崇祯·社畜魂穿」）→ 生成；失败则看 Network 中 **`/api/comic/generate`** 的 status 与 JSON `error`。  
3. **环境**：确认 `.env` 中 `NOVEL_LLM_*`、`OPENAI_*` / 文生图或 `COMFY_UI_BASE_URL` 可用。

## 当前最优推进路径

1. Prisma 对齐 → Studio + 漫画冒烟  
2. 若 LLM 分镜仍 502：查网关日志与 `NOVEL_LLM_PRIMARY` / `FALLBACK`  
3. 按需将工作区变更 **git commit**（用户未要求则勿代提交）  
4. 漫画生成可考虑 **SSE 进度**（未做，属体验增强）

## 当前需要优先解决的问题

- **Prisma Client 过期**（阻塞 API 500）  
- 用户侧 **长正文漫画** 超时与配图成本（产品策略，非单点 bug）
