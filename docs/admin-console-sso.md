# 运营控制台 · 企业 SSO（规划）

更新时间：**2026-06-13**

## 现状

| 层 | 能力 |
|----|------|
| 生产门禁 | admin 登录 + 可选 `ADMIN_CONSOLE_2FA_PIN` |
| **SSO Phase 1** | ✅ OIDC 路由 + stub 模式 + Login Gate「企业 SSO」按钮 |
| API | `SUPER_ADMIN_SECRET` / 会话角色 |
| 隔离 | `/console` 无 locale · noindex · 可选 `ADMIN_CONSOLE_HOST` |

## 目标

企业部署时：**仅运维账号**通过 IdP（飞书 / Azure AD / Okta）登录控制台，与 C 端 OAuth 分离；2FA 由 IdP 或现有 PIN 二选一。

## 建议接入（Phase 1）

### 环境变量（预留）

```bash
# 控制台专用 OIDC（与 C 端 WECHAT_* 等分离）
# ADMIN_CONSOLE_OIDC_ISSUER=https://login.microsoftonline.com/{tenant}/v2.0
# ADMIN_CONSOLE_OIDC_CLIENT_ID=
# ADMIN_CONSOLE_OIDC_CLIENT_SECRET=
# ADMIN_CONSOLE_OIDC_ALLOWED_EMAIL_DOMAIN=example.com
# ADMIN_CONSOLE_OIDC_ROLE_CLAIM=groups   # 映射 admin / super_admin
```

### 路由（已实现）

| 路径 | 说明 |
|------|------|
| `GET /api/admin/console/sso/login` | 302 → IdP authorize（stub 时直跳 callback） |
| `GET /api/admin/console/sso/callback` | code → token → 查/建 User(role=admin) → session |
| `POST /api/admin/console/sso/logout` | 清 session + SSO/2FA cookie |

### 与现有 Login Gate 关系

```
未登录 → ConsoleLoginGate → 「SSO 登录」+ 「本地 admin 账号」（可配置关闭后者）
已登录非 admin → 403
已登录 admin + 无 2FA PIN → ConsoleTwoFactorGate（若配置 PIN）
已登录 admin + SSO MFA 已由 IdP 完成 → 跳过 PIN（建议 env ADMIN_CONSOLE_2FA_SKIP_WHEN_SSO=1）
```

## 验收

- `qa:admin-console`：SSO state/stub/marker 离线断言 ✅
- `qa:console-sso-config`：Azure / 飞书 OIDC 端点解析 ✅
- `qa:console-sso-production-preflight`：生产 OIDC + 2FA + HOST 组合 ✅
- `qa:comic-director-chunk-stats`：导演 chunk batch/逐页统计 ✅
- E2E：staging IdP 或 `ADMIN_CONSOLE_OIDC_STUB=1` + 生产 `NODE_ENV=production` 验证 Login Gate

## 生产 IdP 联调清单（Azure AD 示例）

1. 应用注册 → 重定向 URI：`https://ops.example.com/api/admin/console/sso/callback`
2. 环境变量：
   ```bash
   ADMIN_CONSOLE_OIDC_ISSUER=https://login.microsoftonline.com/{tenant}/v2.0
   ADMIN_CONSOLE_OIDC_CLIENT_ID=
   ADMIN_CONSOLE_OIDC_CLIENT_SECRET=
   ADMIN_CONSOLE_OIDC_ALLOWED_EMAIL_DOMAIN=yourcorp.com
   # Azure 可省略以下两行（代码自动解析 oauth2/v2.0 端点）
   # ADMIN_CONSOLE_OIDC_AUTHORIZE_URL=
   # ADMIN_CONSOLE_OIDC_TOKEN_URL=
   ADMIN_CONSOLE_2FA_SKIP_WHEN_SSO=1   # 可选：IdP 已 MFA 时跳过 PIN
   NODE_ENV=production
   ```
3. 可选：`ADMIN_CONSOLE_OIDC_ADMIN_GROUPS=Console-Admins`（与 `ROLE_CLAIM=groups` 对齐）
4. 验证：`npm run qa:admin-console`（HTTP 应 302 到 IdP authorize，非 404）
5. 浏览器：访问 `/console` → SSO 登录 → 侧栏「退出 SSO 会话」
6. 自动化：`npm run test:e2e:admin-console-sso`（Playwright 注入 `ADMIN_CONSOLE_OIDC_STUB=1`）

## 飞书 / Lark OIDC（参考）

```bash
# 飞书开放平台 → 企业自建应用 → 安全设置 → 重定向 URL
ADMIN_CONSOLE_OIDC_ISSUER=https://passport.feishu.cn/suite/passport/oauth
ADMIN_CONSOLE_OIDC_CLIENT_ID=
ADMIN_CONSOLE_OIDC_CLIENT_SECRET=
# 飞书可省略以下两行（代码自动解析 /authorize 与 /token）
# ADMIN_CONSOLE_OIDC_AUTHORIZE_URL=https://passport.feishu.cn/suite/passport/oauth/authorize
# ADMIN_CONSOLE_OIDC_TOKEN_URL=https://passport.feishu.cn/suite/passport/oauth/token
ADMIN_CONSOLE_OIDC_ALLOWED_EMAIL_DOMAIN=yourcorp.com
```

回调 URI 与 Azure 相同：`https://{ops-host}/api/admin/console/sso/callback`

## 非目标（本阶段）

- 与 C 端用户 OAuth 合并
- SAML XML 手写解析（优先 OIDC）
