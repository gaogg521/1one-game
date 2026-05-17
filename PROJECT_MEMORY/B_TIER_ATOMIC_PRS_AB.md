# B 档 · 泳道 A/B 原子项进度（会话快照）

**说明**：这是 **进度勾选快照**，不是仓库唯一权威清单；权威代码与接口以 git 为准。  
**数据库**：`refinementLogJson`（`20260517103000`）+ `playCount`/`likeCount`（`20260517120000_project_play_like_counts`）—— 部署请 **`npx prisma migrate deploy`**；本地开发 **`migrate dev`** 后 **`prisma generate`**。

---

## 总清单（做完打勾）

### 波段 0 · 文档 / 盘点

- [x] **PR-A000** 共创主链路审计 → `PROJECT_MEMORY/B_FLOW_AUDIT_AB.md`
- [x] **PR-B000** Director/systems 消费矩阵 → 同上文件 §2

### 泳道 A · Refinement

- [x] **PR-A010** `spec-patch.ts` + `/api/generate/patch` 薄封装
- [x] **PR-A020** `refinement-types.ts`
- [x] **PR-A021** `refinement-request.ts`（Zod）
- [x] **PR-A030** Prisma `refinementLogJson` + 迁移 SQL
- [x] **PR-A031** `refinement-log.ts`（append / parse）
- [x] **PR-A040** `GET /api/projects/[id]` 主人返回 `refinementHistory`
- [x] **PR-A041** `POST /api/projects/[id]/refine` · **patch**
- [x] **PR-A042** 同上 · **regenerate**
- [x] **PR-A043** refine 成功追加日志（不写 spec 直至用户保存）
- [x] **PR-A050** `PlayGameClient` 主人 refine UI（模式切换 + 调用 refine）
- [x] **PR-A051** regenerate 模式（同一表单）
- [x] **PR-A052** 仍用既有「应用并保存」写回项目（未改自动保存策略）
- [x] **PR-A053** `CreateClient` `from=` 展示精炼摘要
- [x] **PR-A060** `GENERATE_RL_REFINE_MAX` + refine 限流
- [x] **PR-A061** README 多回合精炼说明
- [x] **PR-A062** 手测勾选 → 本文 §「手测」

### 泳道 B · Generate / Director / 运行时

- [x] **PR-B010** `DECISIONS.md` 未知 event.type / modifiers 策略
- [x] **PR-B011** `finalizeSpec` 注释（`generate-spec.ts`）+ patch 规则已迁入 `spec-patch.ts`
- [x] **PR-B020** `SPEC_PATCH_SYSTEM` 保留 director/systems
- [x] **PR-B021** `SYSTEM` 补充四幕 / events 语义（避免模板字面量嵌套反引号）
- [x] **PR-B022** `getActiveGameSpecJsonSchema()`：默认不变；**`GAME_SPEC_JSON_SCHEMA_INCLUDE_DIRECTOR=1`** 时纳入可选 `director`；**coerceGameSpec** 保留校验通过的 director/systems（任意 LLM 模式）
- [x] **PR-B030** mock + finalize 断言 → `npm run qa:director-spec`
- [x] **PR-B031** `buildDirector` 行为并入同上脚本
- [x] **PR-B040** `overlaySpec`：`DirectorSchema` / `SystemsSchema` 校验失败则回落基准
- [x] **PR-B050** `PlayScene.startEvent` 未知类型安全收尾
- [x] **PR-B051** `ShooterScene` 同上
- [x] **PR-B052** `PlatformerScene` 同上
- [x] **PR-B053** `TowerDefenseScene` 同上（合并重复 miniBoss 分支）
- [x] **PR-B060** `VARIANTS_DIRECTOR_SUMMARY=1` + 非 production 返回 `directorSummary`

---

## 手测（PR-A062）

- [x] `/create` 四步 → 保存 → `/play` patch → 保存（**`e2e/refinement.smoke.spec.ts`** API + UI，CI 开 `E2E_REFINE_STUB=1`）  
- [x] regenerate → `/create?from=` 可见精炼摘要（同上 e2e）  
- [x] 访客无 refine、GET 无 `refinementHistory`（同上 e2e）  
- [x] `npm run qa:director-spec` + `npm run qa:refinement-log` + `npm run build`

---

## 原表格索引（细节验收仍可参考下列语义）

（保留下列小节仅供对照「验收句」，条目状态以上方勾选为准。）

| 波段 | ID | 交付摘要 |
|------|-----|----------|
| 0 | PR-A000 | 链路审计文档 |
| 0 | PR-B000 | 消费矩阵文档 |
| A | PR-A010～062 | refine 全链路（略） |
| B | PR-B010～060 | director 契约与运行时容错（PR-B022 暂缓） |

更新时间：**2026-05-17**
