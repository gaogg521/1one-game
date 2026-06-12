# 1ONE 商业化产品后端 · 架构与迭代清单

**日期**：2026-06-08  
**状态**：Phase 1–4 骨架已落地 · 生产密钥与 Postgres 切换待运维配置

---

## 1. 现状与目标

| 维度 | 改造前 | Phase 1（本次） |
|------|--------|-----------------|
| 用户 | 匿名 `ownerKey` Cookie | `User` + `OAuthAccount` + `UserSession` |
| 登录 | 无 | OAuth 注册表 + 微信实现 + dev 登录 |
| 分享 | `/s/{code}` 短链 | + `ShareEvent` 渠道归因 + `?ref=` 裂变 |
| 发现页 | 全量作品 | `visibility=public` 过滤 |
| 后台 | `DEV_SUPER_ADMIN` 删帖 | `/admin` 仪表盘 + 上下架 + 用户 role |

**商业目标**：支撑登录转化、社交裂变归因、内容治理，为付费与运营预留接口。

---

## 2. 数据模型（Prisma）

- **User**：`legacyOwnerKey` 桥接匿名作品；`referralCode` 邀请；`role` user/admin/super_admin
- **OAuthAccount**：微信/QQ/飞书/LINE/抖音绑定
- **UserSession**：`gcreator_session` 登录态
- **ShareEvent**：分享点击/复制归因
- **AdminAuditLog**：后台操作审计
- **Project / Novel / Comic**：新增 `visibility`、`featured`

---

## 3. API 一览

| 路径 | 说明 |
|------|------|
| `GET /api/auth/session` | 当前用户 + OAuth 提供商状态 |
| `POST /api/auth/logout` | 退出登录 |
| `GET /api/auth/oauth/{provider}/start` | 跳转授权 |
| `GET /api/auth/oauth/{provider}/callback` | OAuth 回调 |
| `POST /api/share/track` | 记录分享渠道 |
| `GET /api/admin/stats` | 运营指标 |
| `GET/PATCH /api/admin/works` | 作品列表与治理 |
| `GET/PATCH /api/admin/users` | 用户与角色 |

---

## 4. 社交登录接入清单（Phase 2）

| 平台 | 环境变量 | 状态 |
|------|----------|------|
| 开发 | `OAUTH_DEV_ENABLED=1` | ✅ 可用 |
| 微信 | `OAUTH_WECHAT_APP_ID/SECRET` | ✅ 代码就绪，待密钥 |
| QQ | `OAUTH_QQ_APP_ID/SECRET` | ✅ handler 就绪，待密钥 |
| 飞书 | `OAUTH_FEISHU_APP_ID/SECRET` | ✅ handler 就绪，待密钥 |
| LINE | `OAUTH_LINE_CHANNEL_ID/SECRET` | ✅ handler 就绪，待密钥 |
| 抖音 | `OAUTH_DOUYIN_CLIENT_KEY/SECRET` | ✅ handler 就绪，待密钥 |

**裂变**：分享 URL 追加 `?ref={referralCode}`；proxy 写入 `gcreator_ref` Cookie；注册时 `referredById` 绑定。

---

## 5. 后台迭代清单（Phase 2–4）

### P0 — 已交付
- [x] 后台首页指标
- [x] 作品上下架（visibility）
- [x] 用户 role PATCH
- [x] 审计日志写入

### P1 — 已交付（Phase 2）
- [x] 审核队列 UI（pending_review 批量通过）
- [x] 精选位 `featured` 运营配置
- [x] 分享漏斗报表（`/api/admin/shares` + 后台 Tab）
- [x] 全平台 OAuth handler（QQ / 飞书 / LINE / 抖音）
- [x] `DEFAULT_WORK_VISIBILITY` 新作品审核开关

### P1 — 下一步
- [ ] 删除作品时 GC `public/covers` 等静态资源

### P2 — 已交付（Phase 3）
- [x] 微信 JS-SDK 分享卡片（`WeChatJssdkShare` + `/api/wechat/jssdk-config`）
- [x] 邀请奖励 + `ReferralReward` + `QuotaLedger`
- [x] 套餐页 `/billing` + `SubscriptionPlan` / `UserSubscription`
- [x] 支付 Webhook（微信/支付宝 + 开发模拟）
- [x] 登录用户生成额度 gate（402）

### P2 — 下一步
- [ ] 短信/邮箱二次验证
- [ ] 微信支付 V3 证书验签（当前为 dev webhook）

### P3 — 已交付（Phase 4 骨架）
- [x] `docker-compose.stack.yml`（Postgres + Redis + MinIO）
- [x] `blob-store` S3/本地双模式
- [x] `JobQueueItem` + Redis 可选 + `/api/jobs/worker`

### P3 — 下一步
- [ ] `schema.prisma` 切 `postgresql` 并数据迁移
- [ ] 封面/素材写入统一走 `getBlobStore()`
- [ ] 长篇/漫画生成迁入 `enqueueJob` worker
- [ ] 订阅周期自动续费 Cron
- [ ] 企业版飞书 SSO 租户
- [ ] 多区域 CDN 与合规隐私政策

详见 [2026-06-08-commercial-phase3-4.md](./2026-06-08-commercial-phase3-4.md)

---

## 6. 本地验证

1. `npx prisma db push && npx prisma generate`
2. `.env` 增加 `OAUTH_DEV_ENABLED=1` 与 `OAUTH_DEV_ADMIN=1`
3. 访问 `/login` → 开发登录 → `/studio`
4. 访问 `/admin`（开发登录为 admin，或填 `SUPER_ADMIN_SECRET`）
5. 分享带 `?ref=邀请码`，新用户 dev 登录后检查 `User.referredById`

---

## 7. 与现有 `ownerKey` 的兼容策略

- 匿名创作：**不变**，proxy 仍发 `gcreator_owner`
- 首次访问 `/api/auth/session`：懒创建 `User.legacyOwnerKey`
- OAuth 登录：`linkOwnerKeyToUser` 合并当前浏览器作品
- API 鉴权：**短期仍用 ownerKey**；中期改为 `getEffectiveOwnerKey(authUser, cookie)`
