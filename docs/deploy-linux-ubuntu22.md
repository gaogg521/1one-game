# Linux 一键部署

## 用户只需这一条命令

在 **Ubuntu 22.04 / Debian 12** 服务器上：

```bash
curl -fsSL https://raw.githubusercontent.com/gaogg521/1one-game/main/scripts/deploy/install.sh | bash
```

无需事先 clone、无需配置环境变量、无需手动 `sudo`（脚本会自动提权）。

脚本全自动完成：拉代码 → 装依赖 → 构建 → 启动服务 → 输出访问地址。

**再次执行同一条命令 = 自动更新版本。**

---

## 装完后（可选）

编辑 API Key，然后重启：

```bash
nano /opt/operone/.env
systemctl restart operone
```

---

## 有域名时（可选，执行前 export）

```bash
export OPERONE_DOMAIN='app.example.com'
export CERTBOT_EMAIL='ops@example.com'
curl -fsSL https://raw.githubusercontent.com/gaogg521/1one-game/main/scripts/deploy/install.sh | bash
```

---

## 脚本文件

| 文件 | 说明 |
|------|------|
| `scripts/deploy/install.sh` | **用户入口**，一键部署 |
| `scripts/deploy/linux-ubuntu22-full.sh` | 内部完整流程 |
| `scripts/deploy/linux-ubuntu22-sqlite.sh` | 分阶段（运维高级用法） |

## 验收

```bash
curl -s http://127.0.0.1:8888/api/health
systemctl status operone
```

## 相关文档

- 环境变量：`.env.example`
- 数据库：`docs/local-database.md`
