# Linux 一键部署

## 一键安装

在 **Ubuntu 22.04 / Debian 12** 服务器上执行：

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

#### ② 若已配置 Nginx 反代 — `/etc/nginx/sites-available/operone`

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
| Nginx 站点 | `/etc/nginx/sites-available/operone` |
| 健康检查 | `curl -s http://127.0.0.1:6666/api/health` |
| 更新版本 | 再次执行 `install.sh`，或 `sudo bash /opt/operone/scripts/deploy/linux-ubuntu22-full.sh --update` |

---

## 脚本文件

| 文件 | 说明 |
|------|------|
| `scripts/deploy/install.sh` | 用户入口，一键部署 |
| `scripts/deploy/linux-ubuntu22-full.sh` | 完整安装 / 更新 / 绑域名 |
| `scripts/deploy/linux-ubuntu22-sqlite.sh` | 分阶段部署（高级） |

## 相关文档

- 环境变量完整列表：仓库根目录 `.env.example`
- 数据库：`docs/local-database.md`
- 运营控制台：`docs/admin-console.md`
