# TASK_QUEUE

更新时间：**2026-06-14**

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

0. **P1** — 封面 / runtime 门禁 — ✅ 2026-06-13  
1. **P2** — 漫画 64 格长测 — ✅ 2026-06-13  
2. **P2** — `qa:deploy-preflight` — ✅ 2026-06-13  
3. **P1** — 煤山崇祯漫画用户验收 / 按需 8 页 — ⬜ 需用户  
4. **P1** — build 回归 — ✅ 2026-06-13  
5. ~~**P2** — Studio 复制~~ · ~~**P3** — Studio 批量删除~~ — ✅  
6. **P3** — git commit — ⬜ 需用户明确要求  
7. **P2** — Console 订单导出 — ✅ 2026-06-13  
8. **P3** — Console SSO/2FA — ✅ PIN + **SSO Phase 1**（OIDC 路由/stub/Login Gate）；生产 IdP 联调 ⬜  
9. **P2** — 多回合共创 QA — ✅ `qa:co-create-loop`（refine stub + 日志）  
10. **P1** — 煤山 8 页漫画 — ✅ 64/64 · `cmqcjell90008hwa0d2ngatyz` · `qa-output/meishan-comic-8page/REPORT.md`  
11. **P2** — 漫画发现精选位 — ✅ `featured=1` API + 发现页/首页 + `seed:comic-featured-meishan`
12. **P2** — 文学生产链 P1（工作链/roster/单格重绘/邮箱注册） — ✅ 2026-06-14
13. **P2** — 中篇 8 页漫画轻量分镜根因 — ✅ `mediumDirectorMinPages=12` + `qa:comic-director-pipeline`
14. **P2** — 四档小说+漫画全量实机 QA — ⬜ 需 API Key + 长时 LLM（`npm run qa:songliao-literary-regression`）
