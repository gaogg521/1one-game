# Linux 一键部署

就四步：**拉代码 → 装环境 → 数据库 migrate → 启动**。装完改 `.env` 里的 API Key 即可。

## 选哪条命令？

| 你的系统 | 命令 | 说明 |
|----------|------|------|
| **CentOS 7** | `install.sh`（同 Ubuntu） | 可选 `OPERONE_USE_DOCKER=1` |
| **Ubuntu 22.04 / Debian 12 / Rocky 9+** 等 | `install.sh` | 宿主机源码部署，一条命令 |
| **任意有 Docker 的 Linux** | `install-docker.sh` | 容器内 build，最省心 |

### CentOS 7

与 Ubuntu 相同，**默认一条命令源码部署**：

```bash
curl -fsSL https://raw.githubusercontent.com/gaogg521/1one-game/main/scripts/deploy/install.sh | bash
```

可选 Docker（需显式加环境变量，不会自动切换）：

```bash
OPERONE_USE_DOCKER=1 curl -fsSL .../install.sh | bash
# 或
curl -fsSL .../install-docker.sh | bash
```

CentOS 7 已做适配：glibc-217 非官方 Node、sharp 延迟加载、vault yum 源、6666 端口 programmatic 启动等。

### 现代 Linux — 宿主机源码部署

```bash
curl -fsSL https://raw.githubusercontent.com/gaogg521/1one-game/main/scripts/deploy/install.sh | bash
```

适用于 Ubuntu 22.04+、Debian 12+、Rocky/Alma/RHEL 8+ 等。流程同样是：拉代码 → Node 22 → `npm ci` → migrate → build → systemd。

---

## 支持的系统

| 发行版 | 推荐方式 | 最低版本 |
|--------|----------|----------|
| CentOS 7 | **源码 `install.sh`**（默认同 Ubuntu） | 7 |
| Ubuntu | 源码 `install.sh` | 20.04（推荐 22.04+） |
| Debian | 源码 | 11+ |
| Rocky / Alma / RHEL / Oracle | 源码 | 8+ |
| Amazon Linux | 源码或 Docker | 2 / 2023 |
| 任意 Linux + Docker | `install-docker.sh` | 有 Docker 即可 |

未在表内的 Debian/RHEL 衍生版会按 `ID_LIKE` 尝试兼容。

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

- **默认目录**：`/opt/operone` · **端口**：`80` · **再执行同命令** = 更新

### 自定义安装目录

默认装到 `/opt/operone`；如需其他路径，安装前设置环境变量 **`OPERONE_DIR`**（全程生效，脚本内不写死路径）：

```bash
# 示例：装到 /data/operone
export OPERONE_DIR=/data/operone
curl -fsSL https://raw.githubusercontent.com/gaogg521/1one-game/main/scripts/deploy/install.sh | bash
```

一行写法：

```bash
OPERONE_DIR=/data/operone curl -fsSL .../install.sh | bash
```

Docker 版同样支持：

```bash
OPERONE_DIR=/data/operone curl -fsSL .../install-docker.sh | bash
```

后续运维命令把 `/opt/operone` 换成你的 `$OPERONE_DIR` 即可，例如：

```bash
sudo nano "$OPERONE_DIR/.env"
sudo bash "$OPERONE_DIR/scripts/deploy/linux-ubuntu22-full.sh" --update
```

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

#### Staging / 预发（OpenGame Browser Bench + Comfy 精灵）

一键部署时加 **`OPERONE_STAGING=1`**，会在 `.env` 写入：

- `STAGING=1` · `OPENGAME_BROWSER_BENCH=1` · `OPENGAME_BROWSER_BENCH_REPAIR=1`
- `QA_ROUTES_ENABLED=1` · `GAME_SPRITE_COMFY=1`

或手动复制模板：

```bash
cp /opt/operone/.env.staging.example /opt/operone/.env
# 再补 OPENAI_API_KEY / COMFY_UI_BASE_URL 等
```

本地验收：`npm run qa:opengame-staging-env`

部署后抽测（本机或远程 staging）：

```bash
# 默认探测 80 / 8888 / 3000；或指定预发地址
STAGING_BASE_URL=http://127.0.0.1 npm run qa:staging-post-deploy
```

含：health · `/qa/agentic-bench` · Browser Bench · 复杂 Agentic SSE · 离线 staging 门禁。报告：`qa-output/staging-post-deploy/REPORT.md`

验证：

```bash
curl -s http://127.0.0.1:80/api/health
```

> 上线后也可在运营控制台 `/console` →「网关 / 模型」轮换部分配置（数据库优先生效）。

---

### 2. 修改端口

**默认端口为 `80`**。Next.js 16 的 `next start -p 80` 需 root 或 `setcap`；本项目 `scripts/run-start.mjs` 使用 programmatic server，部署脚本会为 node 授予 `cap_net_bind_service`。

> **说明：勿再使用 6666**
>
> Chrome / Edge 将 **6666** 列为「不安全端口」（`net::ERR_UNSAFE_PORT`）。历史部署若仍写 `:6666`，请改为 **`http://你的域名/`**（80 端口，无后缀）。
>
> 若已配置域名 + Nginx：对外 **80**，应用可监听 **8080** 由 Nginx 反代；直连部署则应用监听 **80**（`setcap` 已自动处理）。

若需改为其他端口，需改两处：

#### ① 应用端口 — `/opt/operone/.env`

```bash
sudo nano /opt/operone/.env
```

修改或添加：

```env
PORT=80
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

## Rocky Linux 9 / Alma 9 / RHEL 9

与 Ubuntu 相同，一条命令即可（脚本会用 **dnf** 装依赖、**rpm.nodesource.com** 装 Node 22）：

```bash
curl -fsSL https://raw.githubusercontent.com/gaogg521/1one-game/main/scripts/deploy/install.sh | bash
```

安装前可确认系统：

```bash
cat /etc/os-release   # 应看到 ID=rocky 或 almalinux，VERSION_ID=9.x
```

若日志里出现 `apt-get`、`jammy` 字样，说明实际跑在 **Ubuntu/Debian** 上，不是 Rocky。

---

## 常见安装失败

### `npm error EACCES: mkdir '/var/www'`

**原因**：`www-data` 系统用户默认家目录是 `/var/www`，npm 缓存要写该目录但没有权限。

**处理**（将 `$OPERONE_DIR` 换成你的安装目录，默认 `/opt/operone`）：

```bash
OPERONE_DIR="${OPERONE_DIR:-/opt/operone}"
sudo usermod -d "$OPERONE_DIR" www-data
sudo mkdir -p "$OPERONE_DIR/.npm-cache"
sudo chown -R www-data:www-data "$OPERONE_DIR"
sudo rm -rf "$OPERONE_DIR/node_modules"
sudo -u www-data env HOME="$OPERONE_DIR" NPM_CONFIG_CACHE="$OPERONE_DIR/.npm-cache" \
  bash -lc "cd '$OPERONE_DIR' && npm install --no-audit --no-fund && npm run build"
sudo bash "$OPERONE_DIR/scripts/deploy/linux-ubuntu22-full.sh" --systemd-only
```

或拉最新脚本后重装：

```bash
curl -fsSL https://raw.githubusercontent.com/gaogg521/1one-game/main/scripts/deploy/install.sh | bash
```

最新版 deploy 脚本会自动修正家目录并设置 `HOME` / `NPM_CONFIG_CACHE`。

### `npm ci` 报 `ENOTEMPTY` / 半成品 `node_modules`

同上，先 `rm -rf "$OPERONE_DIR/node_modules"` 再 `npm install`。

---

## 运维速查

| 项目 | 路径 / 命令 |
|------|-------------|
| 应用目录 | `$OPERONE_DIR`（默认 `/opt/operone`） |
| 环境变量 / API Key / 端口 | `$OPERONE_DIR/.env` |
| systemd 服务 | `systemctl status operone` |
| 服务日志 | `journalctl -u operone -f` |
| Nginx 站点（Debian） | `/etc/nginx/sites-available/operone` |
| Nginx 站点（RHEL/CentOS） | `/etc/nginx/conf.d/operone.conf` |
| 健康检查 | `curl -s http://127.0.0.1:80/api/health` |
| **样品馆同步** | 部署脚本默认执行 `npm run seed:samples`；手动：`cd $OPERONE_DIR && npm run seed:samples`；或访问 `/samples` 触发 `/api/samples/ensure` |
| 样品 DB 对账 | `npm run qa:sample-gallery-db-sync`（应 14/14） |
| 运营后台 | `/console` → **样品馆** Tab → **同步全部样品** |
| 更新版本 | 再次执行 `install.sh`，或 `sudo bash "$OPERONE_DIR/scripts/deploy/linux-ubuntu22-full.sh" --update` |

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
