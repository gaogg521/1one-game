# TASK_QUEUE · OpenGame 三阶段 + Phase D 视听

更新时间：**2026-06-18**（迭代一百零四）

## 阶段 A — Debug Skill

| 状态 | 项 |
|------|-----|
| ✅ | debug-protocol + repair + 平台测试 2/2 + E2E Agentic |
| ✅ | **Staging 默认 Browser Bench**（`STAGING=1` / `OPERONE_STAGING=1`） |
| ⬜ | 生产环境显式开启 Browser Bench（按需） |

## 阶段 B — Pro OpenGame 子进程

| 状态 | 项 |
|------|-----|
| ✅ | CLI spike + bridge + `qa:opengame-cli-live`（无 CLI 时 fixture 回退） |
| ⬜ | 本机安装 opengame 后 live headless 实机验收 |

## 阶段 C — Template Skill → 样品库

| 状态 | 项 |
|------|-----|
| ✅ | 14/14 parity + `qa:sample-behavior-signoff` |
| ⬜ | 全 14 款行为深度 · PM 上架 checklist |

## 阶段 D — Sensory Cohesion

| 状态 | 项 |
|------|-----|
| ✅ | Brief 资产管线 + 并行精灵 + 自动封面 |
| ✅ | **Comfy 256→512 精灵**（`GAME_SPRITE_COMFY` / staging 默认） |
| ✅ | **模板 BGM 槽** + `seed:game-bgm-slots`（5 款 loop） |
| ⬜ | Comfy 侧车生产联调 · 256→1024 二阶段文生图 |

---

# TASK_QUEUE（历史）
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
14. **P2** — 四档小说+漫画全量实机 QA — ✅ 2026-06-14
15. **P2** — 17 款竞品 clone 可玩度 batch — ✅ 2026-06-14
16. **P2** — PM 手测自动化签收 — ✅ `qa:pm-handtest-signoff`
