# 超级管理员（super_admin）操作说明

本文说明如何授予 **super_admin** 角色，以及其与 **admin**、**SUPER_ADMIN_SECRET** 的权限边界。

## 角色对比

| 能力 | `user` | `admin` | `super_admin` |
|------|--------|---------|---------------|
| 访问 `/admin` 仪表盘 | — | ✓（308 → `/console`） | ✓ |
| 审核作品 / 用户管理 / 设为 admin | — | ✓ | ✓ |
| **升为 super_admin** | — | — | ✓（仅 super_admin 可操作） |
| **网关 / 模型** Tab（运行时配置） | — | — | ✓ |
| `PATCH /api/admin/runtime-config` | — | — | ✓ |

> **legacy 模式**：在请求头携带与 `.env` 中 `SUPER_ADMIN_SECRET` 相同的 `x-super-admin-key` 时，可临时获得 super_admin 级运行时配置权限（无需登录账号）。此方式**不能**在 UI 中将他人升为 super_admin（按钮仅对已登录 super_admin 账号显示）——升权请用 CLI / SQL，或先 `promote:super-admin` 再登录。

## 首名 super_admin（Bootstrap）

任选其一：

### 方式 A：CLI（推荐）

```bash
# 按邮箱
npm run promote:super-admin -- --email your@email.com

# 或按用户 id
npm run promote:super-admin -- --id clxxxxxxxx
```

脚本会直接更新数据库 `User.role = 'super_admin'`，无需已有超管。

### 方式 B：Prisma Studio / SQL

SQLite 示例：

```sql
UPDATE User SET role = 'super_admin' WHERE email = 'your@email.com';
```

改完后重启 `npm run dev`（若已在跑），用该账号登录即可。

### 方式 C：开发登录 + CLI

1. `.env` 设 `OAUTH_DEV_ENABLED=1`、`OAUTH_DEV_ADMIN=1`
2. `/login` → 开发登录（得到 **admin**，非 super_admin）
3. 执行方式 A 将该 dev 账号升为 super_admin

## 在后台 UI 升权（已有 super_admin 时）

1. 使用 **super_admin** 账号登录（或填入 `SUPER_ADMIN_SECRET` 后访问 `/console` 做运行时配置；升权按钮仍需 super_admin 账号）
2. 打开 **`/console`** → **用户** Tab
3. 目标用户当前为 **admin** 时，点击 **「升为 super_admin」**
4. 确认对话框后，调用 `PATCH /api/admin/users`，写入审计日志

`data-testid`: `promote-super-admin-{userId}`

## SUPER_ADMIN_SECRET 与运行时配置

| 变量 | 用途 |
|------|------|
| `SUPER_ADMIN_SECRET` | 请求头 `x-super-admin-key` 鉴权；广场删帖；可访问运行时配置 API |
| `RUNTIME_CONFIG_SECRET` | 加密 DB 中 API Key（可选；未设则回退 `SUPER_ADMIN_SECRET`） |

后台 **网关 / 模型** 页：`/console` → Tab「网关 / 模型」。保存后 **DB 覆盖 `.env`**，无需改部署环境变量即可轮换 Key / 模型。

架构说明见 **`docs/admin-console.md`**。

## 验证

```bash
# 加密、模型写入、读取合并（离线 + 可选 HTTP）
npm run qa:runtime-config-admin

# 后台页视觉 E2E（需 dev/start :8888，或由 Playwright 自动起服）
npm run test:e2e:admin-runtime-config
```

HTTP 探测需 dev 运行且 `.env` 含 `SUPER_ADMIN_SECRET`；可设：

```bash
set SUPER_ADMIN_SECRET=你的密钥
set QA_BASE_URL=http://127.0.0.1:8888
npm run dev
npm run qa:runtime-config-admin
```

**强制 HTTP roundtrip**（dev 未起则 FAIL）：

```bash
npm run qa:runtime-config-admin:http
```

本地 `dev.db` 迁移报错（如 duplicate column）见 **`docs/local-database.md`**。

E2E 截图输出：`qa-output/admin-runtime-config/`

Playwright 若 dev 已在 **8888** 运行：

```bash
set PW_REUSE_SERVER=1
npm run test:e2e:admin-runtime-config
```

## 生产注意

- 关闭 `DEV_SUPER_ADMIN` / `NEXT_PUBLIC_DEV_SUPER_ADMIN`
- 使用强 `SUPER_ADMIN_SECRET` 与 `RUNTIME_CONFIG_SECRET`
- 至少保留一名 super_admin 账号，避免仅依赖 legacy 密钥
- 升权 / 运行时配置变更均写入 `AdminAuditLog`
