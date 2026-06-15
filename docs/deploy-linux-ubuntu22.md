# Linux 一键部署

就四步：**拉代码 → 装环境 → 数据库 migrate → 启动**。装完改 `.env` 里的 API Key 即可。

## 选哪条命令？

| 你的系统 | 命令 | 说明 |
|----------|------|------|
| **CentOS 7**（以及坚持不换机的老 Linux） | 见下方 Docker | `install.sh` 会**自动**走 Docker，不在宿主机编译 |
| **Ubuntu 22.04 / Debian 12 / Rocky 9+** 等 | `install.sh` | 宿主机源码部署，一条命令 |
| **任意有 Docker 的 Linux** | `install-docker.sh` | 与 CentOS 7 相同，最省心 |

### CentOS 7 / 老系统 — 用 Docker（推荐，一条命令）

```bash
curl -fsSL https://raw.githubusercontent.com/gaogg521/1one-game/main/scripts/deploy/install.sh | bash
```

检测到 CentOS 7 后会**自动**改为 Docker 流程（无需另记命令）：

1. 安装 Docker  
2. `git clone` 到 `/opt/operone`  
3. 生成 `.env`  
4. **在容器内** `npm ci` → `next build` → `prisma migrate deploy` → 启动  

构建跑在 `node:22-bookworm` 镜像里，**与宿主机 glibc 2.17 无关**，不会再踩 Node/sharp/GLIBCXX 的坑。

也可显式：

```bash
curl -fsSL https://raw.githubusercontent.com/gaogg521/1one-game/main/scripts/deploy/install-docker.sh | bash
```

装完后：

```bash
nano /opt/operone/.env          # 填 OPENAI_API_KEY
cd /opt/operone && docker compose up -d --build
curl -s http://127.0.0.1:6666/api/health
```

### 现代 Linux — 宿主机源码部署

```bash
curl -fsSL https://raw.githubusercontent.com/gaogg521/1one-game/main/scripts/deploy/install.sh | bash
```

适用于 Ubuntu 22.04+、Debian 12+、Rocky/Alma/RHEL 8+ 等。流程同样是：拉代码 → Node 22 → `npm ci` → migrate → build → systemd。

**不要在 CentOS 7 上强制源码安装**（除非你知道后果）：

```bash
OPERONE_FORCE_SOURCE=1 curl -fsSL .../install.sh | bash   # 不推荐
```

---

## 支持的系统

| 发行版 | 推荐方式 | 最低版本 |
|--------|----------|----------|
| CentOS 7 | **Docker 自动** | 7 |
| Ubuntu | 源码 `install.sh` | 20.04（推荐 22.04+） |
| Debian | 源码 | 11+ |
| Rocky / Alma / RHEL / Oracle | 源码 | 8+ |
| Amazon Linux | 源码或 Docker | 2 / 2023 |
| 任意 Linux + Docker | `install-docker.sh` | 有 Docker 即可 |

未在表内的 Debian/RHEL 衍生版会按 `ID_LIKE` 尝试兼容；CentOS 7 一律 Docker。

## 运行权限

| 登录方式 | 脚本行为 |
|----------|----------|
| **root 用户** | 直接安装，无需 sudo |
| **普通用户** | 自动 `sudo` 提权（首次会提示输入密码） |
| **curl \| bash** | 同上，非 root 时下载脚本后 `sudo` 执行 |

## 一键安装（Ubuntu / Rocky 等现代系统）

```bash
curl -fsSL https://raw.githubusercontent.com/gaogg521/1one-game/main/scripts/deploy/install.sh | bash
```

- **目录**：`/opt/operone` · **端口**：`6666` · **再执行同命令** = 更新

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
