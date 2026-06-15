# Linux 部署指南（Ubuntu 22.04 · 单机 SQLite）

## 最快路径：一键脚本

在**新 Ubuntu 22.04 服务器**上：

```bash
# 1. 克隆（或上传源码后 cd 到仓库根目录）
git clone <你的仓库> /opt/operone
cd /opt/operone

# 2. 配置密钥（必填项）
export OPENAI_API_KEY='sk-...'
export OPENAI_BASE_URL='https://你的-litellm-网关'
export SUPER_ADMIN_SECRET='强密码-控制台与升权'
export RUNTIME_CONFIG_SECRET='另一强密码-可选'

# 3. 安装依赖 + 构建 + systemd（内网 8888）
sudo -E bash scripts/deploy/linux-ubuntu22-sqlite.sh --all

# 4. 对外域名 + HTTPS（DNS 已指向本机）
export OPERONE_DOMAIN='app.example.com'
export CERTBOT_EMAIL='ops@example.com'
sudo -E bash scripts/deploy/linux-ubuntu22-sqlite.sh --phase nginx
sudo -E bash scripts/deploy/linux-ubuntu22-sqlite.sh --phase ssl
```

或从空机器只设 `GIT_REPO`：

```bash
export GIT_REPO='https://github.com/you/game.git'
export OPENAI_API_KEY='...'
export SUPER_ADMIN_SECRET='...'
curl -fsSL .../raw/main/scripts/deploy/linux-ubuntu22-sqlite.sh | sudo -E bash -s -- --all
```

## Docker 路径（更简单）

```bash
export GIT_REPO='https://github.com/you/game.git'
export OPENAI_API_KEY='...'
sudo -E bash scripts/deploy/linux-docker-sqlite.sh
```

## 脚本分阶段

| 阶段 | 命令 | 说明 |
|------|------|------|
| 系统依赖 | `--phase deps` | Node 22、git、build-essential |
| 应用 | `--phase app` | npm ci、migrate、build、seed |
| 常驻 | `--phase systemd` | `operone.service` @8888 |
| 反代 | `--phase nginx` | 需 `OPERONE_DOMAIN` |
| HTTPS | `--phase ssl` | Certbot，需域名 + 邮箱 |

## 更新版本

```bash
cd /opt/operone
sudo -u www-data git pull
sudo -u www-data npm ci
sudo -u www-data npx prisma migrate deploy
sudo -u www-data npm run build
sudo systemctl restart operone
```

## 验收

```bash
curl -s http://127.0.0.1:8888/api/health
cd /opt/operone && npm run qa:b-tier-smoke
```

## 相关文档

- 环境变量：根目录 `.env.example`
- 数据库：`docs/local-database.md`
- 运营控制台：`docs/admin-console.md`、`docs/admin-console-sso.md`
- Godot Web 导出（可选）：`docs/godot-quickstart-cn.md`
