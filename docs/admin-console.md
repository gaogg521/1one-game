# 独立运营控制台（Operations Console）

产品与安全原则：**运营后台与用户产品面分离**，不应是挂在 C 端导航上的 `/admin` 单页。

## 访问地址

| 环境 | 默认路径 | 说明 |
|------|----------|------|
| 开发 / 生产 | **`/console`** | 可通过环境变量自定义 |
| 可选子域 | `ADMIN_CONSOLE_HOST=ops.example.com` | 与主站同代码，按 Host 识别（proxy 预留） |

旧路径 **`/admin`** → **308 永久重定向** 至控制台路径。

## 环境变量

```bash
# 自定义路径（生产建议非 obvious，如 /ops-7f3a）
ADMIN_CONSOLE_PATH=/console
NEXT_PUBLIC_ADMIN_CONSOLE_PATH=/console

# 可选：独立子域（需 DNS + 反向代理指向同一 Next 应用）
# ADMIN_CONSOLE_HOST=ops.example.com
# 生产控制台二次验证 PIN（留空则仅登录门禁）
# ADMIN_CONSOLE_2FA_PIN=
```

## 与 C 端差异

| 维度 | 用户产品 (`/`, `/studio`…) | 运营控制台 (`/console`) |
|------|---------------------------|---------------------------|
| 布局 | `SiteHeader` + 多语言前缀 | 独立深色 Shell + 侧栏模块 |
| SEO | 可索引 | `noindex` + `X-Robots-Tag` |
| 语言路由 | `/zh-Hans/...` | **无 locale 前缀**（固定运营 UI） |
| 能力 | 创作 / 试玩 / 发现 | 审核 · 治理 · 漏斗 · 用户 · **审计** · 网关/模型 |

## 模块（当前）

- **概览** — KPI、增长与内容产出图表、**系统健康**、运营快捷入口  
- **待审队列** — 批量通过 / 隐藏  
- **作品治理** — 可见性、精选、封面预览、试玩  
- **样品馆** — 14 款目录↔DB 同步、封面、批量精选、试玩链接  
- **分享漏斗** — 渠道与转化  
- **用户** — 角色、额度、升 super_admin  
- **计费治理** — 收入 KPI、订阅分布、配额流水、付费趋势、**订单 CSV 导出**
- **审计日志** — `AdminAuditLog` 筛选（动作 / 关键词 / 时间）+ 详情 JSON 展开  
- **网关 / 模型** — super_admin / legacy 密钥（`RuntimeConfigPanel`）

## 权限

与 [`docs/admin-super-admin.md`](./admin-super-admin.md) 一致：`admin` / `super_admin` 账号 + 可选 `SUPER_ADMIN_SECRET`。

| 环境 | 页面访问 | API |
|------|----------|-----|
| **生产** | 必须 **admin 登录会话**；可选 **`ADMIN_CONSOLE_2FA_PIN`** 二次验证 | legacy 密钥仍可用于脚本/CI |
| **开发** | 允许进入 Shell + 密钥面板 | 同左 |

API 均在 `/api/admin/*`；**页面与 API 策略分离**是刻意设计（减少生产面暴露 legacy 密钥输入）。

## 验证

```bash
npm run qa:b-tier-smoke          # 六模板 + 共创 + 文学规则 + 分镜 resilience（离线）
npm run qa:admin-console          # 路径 / 重定向 / 审计鉴权 / SSO
npm run test:e2e:admin-console-sso  # SSO stub 登录 + 登出
npm run qa:comic-storyboard-resilience
npm run build
PW_REUSE_SERVER=1 npm run test:e2e:admin-runtime-config
npm run qa:deploy-preflight       # migrate + build（部署前）
npm run seed:samples              # 样品馆 23 款 upsert（生产部署后亦需）
npm run qa:sample-gallery-db-sync # 目录↔DB 对账
```

## 生产样品馆

部署脚本默认在 build 后执行 `npm run seed:samples`（可通过 `SKIP_SEED=1` 跳过）。

| 场景 | 操作 |
|------|------|
| 首次上线 / 升级后 | `npm run seed:samples` 或 `/console` → **样品馆** → **同步全部样品** |
| 对账 | `npm run qa:sample-gallery-db-sync`（期望 23/23） |
| 公开页 | 访问 `/samples` 会 POST `/api/samples/ensure` 幂等同步 |

QA 快照写入 `.qa-cache/`（gitignore），概览 **系统健康** 可读取最近 smoke / 试玩 QA 结果。

## 企业 SSO（Phase 1）

与 C 端 OAuth 分离；配置见 [`docs/admin-console-sso.md`](./admin-console-sso.md)。

| 变量 | 说明 |
|------|------|
| `ADMIN_CONSOLE_OIDC_STUB=1` | 本地/E2E stub（login → callback?code=stub） |
| `ADMIN_CONSOLE_OIDC_ISSUER` + `CLIENT_ID` | 生产 Azure AD / Okta 等 |
| `ADMIN_CONSOLE_OIDC_ALLOWED_EMAIL_DOMAIN` | 邮箱域名白名单 |
| `ADMIN_CONSOLE_2FA_SKIP_WHEN_SSO=1` | IdP 登录后跳过 PIN |

Login Gate 显示「企业 SSO 登录」；SSO 会话侧栏可「退出 SSO 会话」。

E2E 入口已改为 `/console`；`/admin` 重定向仍可用。

## 后续扩展（建议）

- 独立子域 + Cookie `Domain` 隔离  
- 工单 / 内容安全策略 / 批量导出  
- SSO 生产 IdP 联调（Azure AD 等）  
