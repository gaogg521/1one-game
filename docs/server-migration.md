# 生产服务器迁移指南

> **读者**：运维、开发者、接续本项目的 AI Agent。  
> **目标**：从旧机（如 CentOS 7）迁到新机（推荐 Ubuntu 22.04 / Rocky 9），**保留用户、作品、封面、密钥**，停机约 30–90 分钟。

---

## 1. 架构速览

| 层级 | 位置 | 迁移时要不要带 |
|------|------|----------------|
| 应用代码 | Git `main` | ❌ 新机 `git pull` / `install.sh` |
| Prisma 迁移 SQL | Git `prisma/migrations/` | ❌ 新机自动 `migrate deploy` |
| **SQLite 业务库** | `{REPO}/prisma/prod.db` | ✅ **必须** |
| **环境密钥** | `{REPO}/.env` | ✅ **必须**（勿提交 Git） |
| 样品精灵/背景 | `{REPO}/public/game-sprites/sample-*`、`game-bg/` | ✅ 备份包或本机 sync |
| 小说/漫画封面 | `{REPO}/public/covers/` | ✅ 备份包或本机 sync |
| 上传/打包缓存 | `{REPO}/data/` | ✅ 建议 |
| Godot 工具链 | `{REPO}/tools/`、`.local/` | 可选 `--include-tools` |
| 域名 | DNS | 切到新公网 IP |
| HTTPS | Nginx + Certbot | 新机重装 |

默认安装目录 **`/opt/operone`**，systemd 服务名 **`operone`**，应用端口 **`80`**。

当前生产（撰写时）：`43.163.105.71` · 域名 `operone.1oneclaw.com`。

---

## 2. 环境变量（所有部署/迁移脚本共用）

在**执行脚本的机器**上设置（PowerShell / bash 均可）：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `OPERONE_DEPLOY_HOST` | `43.163.105.71` | SSH 目标 IP |
| `OPERONE_DEPLOY_USER` | `root` | SSH 用户 |
| `OPERONE_DEPLOY_REPO` | `/opt/operone` | 服务器上的仓库根 |
| `OPERONE_DEPLOY_APP_PORT` | `80` | 应用监听端口 |
| `OPERONE_DEPLOY_DOMAIN` | `operone.1oneclaw.com` | 日志提示用 |
| `OPERONE_DEPLOY_PASSWORD` | — | SSH 密码（**必填**，勿写入 Git） |

实现：`scripts/prod_ssh.py`（`deploy-prod-cee8b1d.py`、`sync-*.py`、备份/恢复脚本均引用）。

**换机后**：只需把 `OPERONE_DEPLOY_HOST` 改成新 IP，其余脚本无需改代码。

---

## 3. 什么在 Git 里、什么不在

```
Git 有                          Git 没有（靠备份或 sync）
─────────────────────          ─────────────────────────────
src/、prisma/migrations/       prisma/prod.db（用户/作品/订单）
scripts/deploy/                .env（API Key、管理员密钥）
package.json                   public/covers/*.jpg（多数封面）
                               public/game-sprites/sample-*
                               public/game-bg/sample-*
```

日常部署代码：**`python scripts/deploy-prod-with-assets.py`**（见 `PROJECT_MEMORY/DECISIONS.md`）。

---

## 4. 推荐迁移流程（标准路径）

### 阶段 A — 旧机备份（迁移前 1 天内）

在**有 SSH 权限的本机**（仓库根目录）：

```bash
# bash
export OPERONE_DEPLOY_HOST=43.163.105.71   # 旧机 IP
export OPERONE_DEPLOY_PASSWORD='***'

python scripts/backup-prod-for-migration.py
# 输出: backups/operone-migrate-YYYYMMDD-HHMMSS.tgz
```

```powershell
# PowerShell
$env:OPERONE_DEPLOY_HOST = "43.163.105.71"
$env:OPERONE_DEPLOY_PASSWORD = "***"
python scripts/backup-prod-for-migration.py
```

备份包内含：

- `.env`
- `prisma/prod.db`（及 wal/shm 若存在）
- `public/covers`、`public/game-sprites`、`public/game-bg`
- `data/`
- `data/migration-manifest.json`（库表行数、git 版本、时间戳）

可选 Godot：

```bash
python scripts/backup-prod-for-migration.py --include-tools
```

**安全**：`.tgz` 含密钥与全库，加密磁盘存放，**不要** `git add`。

---

### 阶段 B — 新机装机（空机）

推荐 **Ubuntu 22.04 LTS** 或 **Rocky 9**（比 CentOS 7 少 glibc/Node 补丁）。

```bash
# SSH 登录新机器后
curl -fsSL https://raw.githubusercontent.com/gaogg521/1one-game/main/scripts/deploy/install.sh | bash
```

或 Docker：

```bash
curl -fsSL .../install-docker.sh | bash
```

装完后应有：

- `/opt/operone`（或 `$OPERONE_DIR`）
- `operone.service` running
- 占位 `.env`（来自 `.env.example`）

绑定域名 + HTTPS（DNS 已指向新机后）：

```bash
export OPERONE_DOMAIN='operone.1oneclaw.com'
export CERTBOT_EMAIL='ops@example.com'
sudo bash /opt/operone/scripts/deploy/linux-ubuntu22-full.sh
```

详细装参：[`docs/deploy-linux-ubuntu22.md`](./deploy-linux-ubuntu22.md)。

---

### 阶段 C — 恢复数据到新机

在本机（**指向新机 IP**）：

```bash
export OPERONE_DEPLOY_HOST=<新机公网IP>
export OPERONE_DEPLOY_PASSWORD='***'

python scripts/restore-prod-migration.py \
  --bundle backups/operone-migrate-20260618-120000.tgz
```

脚本会：

1. 上传 bundle → `/opt/operone/data/migration-restore.tgz`
2. `systemctl stop operone`
3. 解压到 `/opt/operone`（覆盖 `.env`、`prod.db`、`public/*`）
4. `chown www-data`
5. `npx prisma migrate deploy`
6. `systemctl restart operone`
7. `curl http://127.0.0.1:80/api/health`

---

### 阶段 D — 更新代码 + 补素材（建议）

恢复后拉最新 `main` 并同步本机样品/封面（防止 bundle 略旧）：

```bash
export OPERONE_DEPLOY_HOST=<新机IP>
export OPERONE_DEPLOY_PASSWORD='***'

python scripts/deploy-prod-with-assets.py
```

等价于依次执行：

1. `deploy-prod-cee8b1d.py` — pull、build、seed:samples
2. `sync-sample-assets-to-prod.py`
3. `sync-literary-covers-to-prod.py`

---

### 阶段 E — 切 DNS + 验收

1. 将 `operone.1oneclaw.com` A 记录指向新机 IP（TTL 过期前可双机并行测 IP 直连）。
2. 验收清单：

```bash
curl -s https://operone.1oneclaw.com/api/health
# 浏览器：/arcade、/novel/feed、/play/sample-dou-dizhu
python scripts/check-prod-literary-covers.py
python scripts/verify-prod-doudizhu.py
```

3. 旧机关机前再跑**一次** `backup-prod-for-migration.py` 作归档。

---

## 5. 脚本速查

| 脚本 | 作用 |
|------|------|
| `scripts/prod_ssh.py` | 统一 SSH 主机/密码/路径 |
| `scripts/backup-prod-for-migration.py` | 旧机 → 本地 `.tgz` |
| `scripts/restore-prod-migration.py` | 本地 `.tgz` → 新机 |
| `scripts/deploy-prod-cee8b1d.py` | 仅代码部署 |
| `scripts/deploy-prod-with-assets.py` | 代码 + 样品 + 文学封面 |
| `scripts/sync-sample-assets-to-prod.py` | 样品精灵/背景 |
| `scripts/sync-literary-covers-to-prod.py` | DB 引用的 `/covers/*` |

---

## 6. 手动备份（无 Python 时）

在**旧服务器**上：

```bash
cd /opt/operone
tar czf /tmp/operone-migrate.tgz \
  .env prisma/prod.db \
  public/covers public/game-sprites public/game-bg data
scp root@旧机:/tmp/operone-migrate.tgz ./
```

在新机解压：

```bash
systemctl stop operone
cd /opt/operone && tar xzf /tmp/operone-migrate.tgz
chown -R www-data:www-data public data prisma/prod.db .env
cd /opt/operone && set -a && . ./.env && set +a && npx prisma migrate deploy
systemctl start operone
```

---

## 7. 回滚

若新机异常、DNS 尚未切换：

- 旧机保持运行，无需回滚。
- 若已切 DNS：把 A 记录指回旧 IP；或在新机 `restore` 旧 bundle 之前保留的旧机最后一包备份。

---

## 8. 常见问题

### Q: 只迁代码不迁数据可以吗？

可以，但会**丢失所有用户与作品**。仅适合全新环境演示。生产必须用备份包。

### Q: CentOS 7 → Ubuntu 22 要注意什么？

- 不必再手工 stub `@parcel/watcher`（Ubuntu 22 上通常不需要，但 deploy 脚本仍保留兼容逻辑）。
- Node 22 用官方源，无需 glibc-217 非官方包。
- 建议迁移后长期用 Ubuntu/Rocky，放弃 CentOS 7。

### Q: 备份后 public 仍缺图？

- 用户自创 `cmq…` 项目素材**不会**整包同步（DB ID 不一致）。
- 用 `sync-literary-covers-to-prod.py` 按 **生产 DB `coverPath`** 补图。
- DB 里 `coverPath` 为空的记录需在创作台重新生成封面。

### Q: `OPERONE_DEPLOY_PASSWORD` 放哪？

优先环境变量。本地 fallback 读取 `scripts/upload-literary-samples-to-server.py` 内 `PASSWORD=`（历史原因）；**新环境请只用环境变量**。

---

## 9. AI Agent 接续清单

新会话接手迁移时，按序读取：

1. **本文** `docs/server-migration.md`
2. `PROJECT_MEMORY/DECISIONS.md` — 「生产部署必须同步运行时素材」
3. `docs/deploy-linux-ubuntu22.md` — 装机细节
4. `CONTEXT.md` Session 50 — 最近功能与路由

执行顺序记忆口诀：**备份 → 新机 install → restore → deploy-with-assets → DNS → 验收**。

---

## 10. 相关文件

```
scripts/
  prod_ssh.py
  backup-prod-for-migration.py
  restore-prod-migration.py
  deploy-prod-with-assets.py
  deploy-prod-cee8b1d.py
  sync-sample-assets-to-prod.py
  sync-literary-covers-to-prod.py
  deploy/install.sh
  deploy/install-docker.sh
backups/                    # 本地备份目录（gitignore）
/opt/operone/               # 服务器安装根（默认）
```
