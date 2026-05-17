# TASK_QUEUE

更新时间：**2026-05-17**

## 已完成任务

- **游戏生成产品升级 Phase 1-5（首轮）**
  - `/create` **4 步共创流程**
  - SSE 增加 **当前理解 / 方向选择 / 成品提要**
  - `/api/projects/[id]` 支持 **prompt + spec** 更新
  - `/play/[id]` 支持 **AI patch / quick tune 后保存回项目**
  - `/create?from=` 恢复 **完整项目上下文**
  - `shooter` 接入 `systems.skill` 与 `director.events`
  - `td-blueprint` 波次加入 `rush / elite` 差异
- Studio 三类型合并 + `mine=1` + 删除  
- 漫画分镜规范化 + 请求体上限 + 前端错误提示  
- **动漫列表 Prisma coverPath 绕过**（`comic-list-query`）  
- **漫画 SSE 配图进度 + 每格耗时**  
- **文生图批量 n=4 + 并发 4 配置**  
- **小说广场本人删除**  
- **《煤山崇祯》2 页漫画 + 8 格配图**（`cmp8e84lk0001x6zgo8jrd8jg`）

## 当前进行中

- **P2** — 肉眼扫一眼六模板章节/事件（自动化手测已模拟完成；E2E 24/24）

## B 档产品线目标（周级，用户确认纳入范围）

- **多回合共创**：单项目内支持「生成 → 试玩 → 明确修改意图 → 再 patch / 再全量生成」的闭环产品化（不仅是单次 4 步）  
- **生成与运行时对齐**：`generate-spec` / mock / variants 输出的结构字段与 `director.acts`、`director.events`、各 `*Scene` 读取路径一致，并有回归抓手  
- **全模板验收**：TD / shooter / platformer / collector / survivor / avoider 章节感、事件反馈、胜负文案与性能红线  

## 待执行（按优先级）

1. **P2** — 漫画 32 格流式配图长测 — **后台重跑** `npm run qa:comic-32-panels`（上次 1/32 后中断）  
2. **P2** — 部署环境 Prisma generate（本地 EPERM 时需先停 8888/dev）+ migrate deploy  
4. **P1** — 用户验收煤山崇祯漫画；按需生成完整 8 页（预估配图 40+ 分钟）  
5. **P1** — 回归 `npm run build`、手测关键链路  
6. ~~**P2** — Studio：novel/comic 复制~~（2026-05-17：`/api/novel|comic/[id]/duplicate` + 工作室按钮）  
7. **P3** — Studio 批量删除（未做）  
8. **P3** — 工作区 **git commit**（需用户明确要求）
