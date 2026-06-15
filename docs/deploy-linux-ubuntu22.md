# Linux 一键部署

脚本会读取 `/etc/os-release`，识别发行版与版本，并自动选择 **apt / dnf / yum** 及对应安装路径。

## 支持的系统

| 发行版 | 最低版本 | 包管理 | Nginx 配置路径 |
|--------|----------|--------|----------------|
| Ubuntu | 20.04（推荐 22.04+） | apt | `/etc/nginx/sites-available/operone` |
| Debian | 11+ | apt | 同上 |
| CentOS | 7+（7 已 EOL，建议迁移） | yum/dnf | `/etc/nginx/conf.d/operone.conf` |
| RHEL | 8+ | dnf/yum | 同上 |
| Rocky Linux | 8+ | dnf | 同上 |
| AlmaLinux | 8+ | dnf | 同上 |
| Oracle Linux | 8+ | dnf/yum | 同上 |
| Amazon Linux | 2 / 2023 | yum/dnf | 同上 |

未在表内的 **Debian 系 / RHEL 系** 衍生版会按 `ID_LIKE` 尝试兼容安装；无法识别时会提前报错退出。

### CentOS 7 特别说明

系统 glibc 2.17 **无法** 使用 NodeSource/yum 安装 Node 22+（会报 `GLIBC_2.28 not found`）。一键脚本会**自动**从 [unofficial-builds](https://unofficial-builds.nodejs.org/) 安装 `glibc-217` 包；若你已手动安装可跳过。

手动安装（与脚本相同来源，v22.21.0）：

```bash
cd /opt
wget https://unofficial-builds.nodejs.org/download/release/v22.21.0/node-v22.21.0-linux-x64-glibc-217.tar.gz
tar -zxvf node-v22.21.0-linux-x64-glibc-217.tar.gz
ln -sf /opt/node-v22.21.0-linux-x64-glibc-217/bin/node /usr/local/bin/node
ln -sf /opt/node-v22.21.0-linux-x64-glibc-217/bin/npm /usr/local/bin/npm
ln -sf /opt/node-v22.21.0-linux-x64-glibc-217/bin/npx /usr/local/bin/npx
node -v   # v22.21.0
npm -v
```

CentOS 7 自带 git 1.8.3 **不支持** `git -C`。若 `/opt/operone` 是旧 clone，再次 `curl | bash` 会先 `git pull` 或从 GitHub 拉最新 deploy 脚本；也可手动：

```bash
cd /opt/operone && git pull origin main && bash scripts/deploy/install.sh
```

**native 模块（better-sqlite3 / node-gyp）**：CentOS 7 的 glibc 2.17 与 Python 3.6 无法编译 `better-sqlite3`（需 glibc ≥ 2.29、Python ≥ 3.8）。一键脚本在 CentOS 7 上使用 `npm ci --ignore-scripts` 跳过 dev 工具的原生编译（生产运行不依赖 `better-sqlite3`），并单独补装 `sharp` 预编译包。若仍失败，建议迁移到 Rocky/Alma 8+ 或 Ubuntu 22.04。

**Prisma 迁移 `no such table: User`**：已在 `20260614090000_user_auth_foundation` 补建 User 等表。若此前首次安装迁移失败，脚本会自动 resolve 失败记录并重试；也可手动 `rm -f /opt/operone/prod.db` 后重新部署。

**`next build` 报 GLIBCXX_3.4.20 / `@parcel/watcher`**：CentOS 7 的 libstdc++ 过旧。脚本会在 build 前将 `@parcel/watcher` 替换为 noop 桩（生产不需要 i18n 文件监听）。若仍有 native 模块报错，建议迁移 Rocky/Alma 8+ 或 Ubuntu 22.04。

## 运行权限

| 登录方式 | 脚本行为 |
|----------|----------|
| **root 用户** | 直接安装，无需 sudo |
| **普通用户** | 自动 `sudo` 提权（首次会提示输入密码） |
| **curl \| bash** | 同上，非 root 时下载脚本后 `sudo` 执行 |

无需手动写 `sudo bash ...`，一条命令即可：

```bash
curl -fsSL https://raw.githubusercontent.com/gaogg521/1one-game/main/scripts/deploy/install.sh | bash
```

若系统未安装 sudo 且非 root，脚本会明确报错并提示用 root 登录。

## 一键安装

在 **Ubuntu 22.04 / Debian 12 / CentOS 7+ / RHEL 8+** 服务器上执行：

```bash
curl -fsSL https://raw.githubusercontent.com/gaogg521/1one-game/main/scripts/deploy/install.sh | bash
```

脚本会自动：从 GitHub 拉代码 → 安装依赖 → 构建 → 启动服务。

- **默认安装目录**：`/opt/operone`
- **默认监听端口**：`6666`（内网访问 `http://服务器IP:6666`）
- **再次执行同一条命令** = 自动更新版本

---

## 部署后常用配置

以下操作均在服务器上以 root 或 sudo 执行。修改配置后，一般需要：

```bash
sudo systemctl restart operone
```

### 1. 修改 API Key（LLM / 网关）

**文件位置**：`/opt/operone/.env`

```bash
sudo nano /opt/operone/.env
```

常用项：

| 变量 | 说明 |
|------|------|
| `OPENAI_API_KEY` | LLM / 文生图 API 密钥 |
| `OPENAI_BASE_URL` | LiteLLM 或兼容网关地址 |
| `SUPER_ADMIN_SECRET` | 广场「超级管理员」升权密码 |
| `RUNTIME_CONFIG_SECRET` | 运行时配置加密（可选，默认同 SUPER_ADMIN_SECRET） |

示例：

```env
OPENAI_API_KEY=sk-xxxxxxxx
OPENAI_BASE_URL=https://你的-litellm-网关
SUPER_ADMIN_SECRET=请改成强密码
```

保存后重启：

```bash
sudo systemctl restart operone
```

验证：

```bash
curl -s http://127.0.0.1:6666/api/health
```

> 上线后也可在运营控制台 `/console` →「网关 / 模型」轮换部分配置（数据库优先生效）。

---

### 2. 修改端口

**默认端口为 `6666`**。若需改为其他端口（如 `3000`），需改两处：

#### ① 应用端口 — `/opt/operone/.env`

```bash
sudo nano /opt/operone/.env
```

修改或添加：

```env
PORT=3000
```

#### ② 若已配置 Nginx 反代

- **Ubuntu/Debian**：`/etc/nginx/sites-available/operone`
- **CentOS/RHEL**：`/etc/nginx/conf.d/operone.conf`

域名访问时，Nginx 需把流量转到应用实际端口：

```bash
sudo nano /etc/nginx/sites-available/operone
```

找到 `proxy_pass`，改为新端口，例如：

```nginx
proxy_pass http://127.0.0.1:3000;
```

检查并重载 Nginx：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

#### ③ 重启应用

```bash
sudo systemctl restart operone
```

#### ④ 防火墙（若启用了 ufw）

```bash
sudo ufw allow 3000/tcp
```

> **说明**：`operone.service` 从 `.env` 读取 `PORT`，无需单独改 systemd 单元文件。

---

### 3. 绑定域名（Nginx 反代）

**适用场景**：已有域名，希望通过 `http://app.example.com` 访问，而不是 `:6666`。

#### 方式 A — 部署时一次性配置（推荐）

DNS 已指向服务器后，在安装**之前** export：

```bash
export OPERONE_DOMAIN='app.example.com'
export CERTBOT_EMAIL='ops@example.com'   # 可选，填写则自动申请 HTTPS
curl -fsSL https://raw.githubusercontent.com/gaogg521/1one-game/main/scripts/deploy/install.sh | bash
```

#### 方式 B — 部署完成后补绑域名

```bash
export OPERONE_DOMAIN='app.example.com'
export CERTBOT_EMAIL='ops@example.com'   # HTTPS 可选
sudo bash /opt/operone/scripts/deploy/linux-ubuntu22-full.sh
```

仅 HTTP 反代、不要 HTTPS：

```bash
export OPERONE_DOMAIN='app.example.com'
sudo bash /opt/operone/scripts/deploy/linux-ubuntu22-full.sh --no-ssl
```

脚本会写入 Nginx 站点：`/etc/nginx/sites-available/operone`

#### 方式 C — 手动配置 Nginx

参考模板：`/opt/operone/scripts/deploy/templates/nginx-operone.conf`

核心配置：将 `__DOMAIN__` 换成你的域名，`__PORT__` 换成应用端口（默认 `6666`），然后：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

#### HTTPS（Let's Encrypt）

```bash
export OPERONE_DOMAIN='app.example.com'
export CERTBOT_EMAIL='ops@example.com'
sudo bash /opt/operone/scripts/deploy/linux-ubuntu22-full.sh --phase ssl
```

或手动：

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d app.example.com
```

---

## 运维速查

| 项目 | 路径 / 命令 |
|------|-------------|
| 应用目录 | `/opt/operone` |
| 环境变量 / API Key / 端口 | `/opt/operone/.env` |
| systemd 服务 | `systemctl status operone` |
| 服务日志 | `journalctl -u operone -f` |
| Nginx 站点（Debian） | `/etc/nginx/sites-available/operone` |
| Nginx 站点（RHEL/CentOS） | `/etc/nginx/conf.d/operone.conf` |
| 健康检查 | `curl -s http://127.0.0.1:6666/api/health` |
| 更新版本 | 再次执行 `install.sh`，或 `sudo bash /opt/operone/scripts/deploy/linux-ubuntu22-full.sh --update` |

---

## 脚本文件

| 文件 | 说明 |
|------|------|
| `scripts/deploy/lib/os-lib.sh` | 发行版识别、版本校验、apt/dnf/yum 差异化安装 |
| `scripts/deploy/install.sh` | 用户入口，一键部署 |
| `scripts/deploy/linux-ubuntu22-full.sh` | 完整安装 / 更新 / 绑域名 |
| `scripts/deploy/linux-ubuntu22-sqlite.sh` | 分阶段部署（高级） |

## 相关文档

- 环境变量完整列表：仓库根目录 `.env.example`
- 数据库：`docs/local-database.md`
- 运营控制台：`docs/admin-console.md`
