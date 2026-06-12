# 商业化 Phase 3–4 · 交付说明

**日期**：2026-06-08

## Phase 3 — 增长与变现

### 微信 JS-SDK 原生分享
- `GET /api/wechat/jssdk-config?url=` 签名接口
- `WeChatJssdkShare` + `SocialShareBar` 微信内自动配置分享卡片
- 环境变量：`WECHAT_MP_APP_ID` / `WECHAT_MP_APP_SECRET`（可与 OAuth 共用 `OAUTH_WECHAT_*`）

### 邀请奖励
- `ReferralReward` + `QuotaLedger` 流水
- 注册绑定 `?ref=` 后：邀请人 +50、被邀请人 +20（见 `product-config.commerce`）
- 新用户注册礼包 +30 点

### 套餐订阅 + 支付 Webhook
- 套餐：`free` / `creator` / `pro`（`SubscriptionPlan`）
- `POST /api/commerce/orders` 创建订单
- `POST /api/payment/wechat/notify` / `alipay/notify` Webhook
- `POST /api/payment/dev/simulate` 开发模拟支付（`PAYMENT_DEV_MODE=1`）
- 页面：`/billing`

### 生成额度 gate
- 已登录用户：游戏 1 / 小说 2 / 长篇 5 / 漫画 3 点
- 匿名用户：仍仅 rateLimit，不扣额度
- 不足返回 HTTP 402 `QUOTA_EXCEEDED`

---

## Phase 4 — 基础设施

### Postgres 迁移
```bash
# 1. 启动栈
docker compose -f docker-compose.stack.yml up -d postgres

# 2. 修改 prisma/schema.prisma datasource provider 为 postgresql
# 3. 设置 DATABASE_URL=postgresql://oneone:pass@localhost:5432/oneone
# 4. npx prisma db push
```

### S3 / MinIO 存储
- `src/lib/storage/blob-store.ts`：`STORAGE_MODE=local|s3`
- MinIO 见 `docker-compose.stack.yml`

### 任务队列
- `JobQueueItem` SQLite 表 + 可选 `REDIS_URL` 双写
- `POST /api/jobs/worker` 拉取任务（`JOB_WORKER_SECRET`）
- 长篇 SSE 迁移：调用 `enqueueJob({ type: 'novel_generate', payload })`

---

## 本地验证

```env
OAUTH_DEV_ENABLED=1
PAYMENT_DEV_MODE=1
PAYMENT_WEBHOOK_SECRET=dev_secret
```

1. 开发登录 → 账号菜单查看额度
2. `/billing` → 订阅创作者 → 模拟支付 → 额度增加
3. 邀请链接 `?ref=` 新用户登录 → 双方额度增加
4. 微信内打开作品页 → 分享栏显示「微信卡片已就绪」（需配 MP 密钥与备案域名）
