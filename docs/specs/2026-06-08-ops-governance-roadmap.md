# 1ONE 后台治理路线图（Phase 4）

**日期**：2026-06-08  
**状态**：规划 — 与产品重设计 Phase 1–3 并行准备

---

## 1. 用户与归属体系

| 阶段 | 能力 | 现状 |
|------|------|------|
| P0 | Cookie `ownerKey` 会话归属 | 已用 |
| P1 | 可选账号登录（邮箱/OAuth） | 未做 |
| P2 | 作品 `userId` 外键与迁移脚本 | Schema 待扩展 |
| P3 | 多设备同步工作室 | 依赖 P2 |

**决策**：短期保留 ownerKey；`DEV_SUPER_ADMIN` 仅开发期，生产必须关闭并换 RBAC。

---

## 2. 发布与审核治理

- **作品状态机**：`draft` → `generating` → `ready` → `published` / `archived`
- **审核队列**：发现页公开展示前可选人工/自动审核
- **推荐位**：编辑精选、本周最佳 — 需 `featuredUntil` + `editorPick` 字段
- **标签体系**：统一 game/novel/comic 卡片元数据（题材、适龄、模板）

---

## 3. 安全与限流（P0 技术债）

| 项 | 风险 | 建议 |
|----|------|------|
| Godot 导出 API | 无鉴权可被滥用 | 绑定 projectId + owner 校验 |
| 封面/配图生成 | 成本攻击面 | 按 ownerKey/IP 限流 + 队列 |
| 删除作品 | DB 删了 public 资产残留 | 删除钩子 GC `public/covers` 等 |
| SSE 长任务 | 中断无恢复 | 任务表 + 轮询 fallback |

---

## 4. 运营能力

- 超管面板扩展：批量下架、补封面、重算排行
- 监控：生成失败率、平均 wow 时长（创建 → 结果页）
- 审计日志：删除、发布、推荐位变更

---

## 5. 依赖与顺序

1. 限流 + 敏感 API 鉴权（可先做）
2. 删除资产 GC
3. 正式用户表与迁移
4. 审核 / 推荐位
5. 多实例存储（S3 + Postgres）— 与部署架构绑定

详见 [`2026-06-08-1one-product-redesign.md`](./2026-06-08-1one-product-redesign.md) Phase 4 节。
