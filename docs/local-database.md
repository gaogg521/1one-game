# 本地 SQLite 数据库（dev.db）

开发默认使用 **`DATABASE_URL=file:./dev.db`**（相对 `prisma/schema.prisma`，即 `prisma/dev.db`）。QA / CI / Playwright 通常使用 **`file:./prisma/ci.sqlite`**，避免污染个人作品数据。

## 常见命令

```bash
# 开发（run-dev.mjs 会自动设 dev.db）
npm run dev

# 对当前 DATABASE_URL 应用迁移
npx prisma migrate deploy

# 打开数据浏览器
npx prisma studio
```

## 迁移漂移：`duplicate column` / failed migration

若 `prisma migrate deploy` 报错 **`duplicate column name: visibility`**、**`coverPath`**，或 **`P3009` failed migration**，说明 **`dev.db` 曾被手动改表或部分迁移已执行但未记入 `_prisma_migrations`**。

### 方案 A（推荐）：一键修复脚本

```bash
npm run fix:dev-db-migrations
```

脚本会检测 `Novel.visibility`、`Comic.coverPath`、`PlatformRuntimeConfig` 表是否已存在，自动 `migrate resolve --applied` 并重跑 `migrate deploy`。

### 方案 A'：手动 resolve

列已存在时，将对应迁移标记为已应用：

```bash
# Windows PowerShell — 在项目根目录
$env:DATABASE_URL = "file:./dev.db"
npx prisma migrate resolve --applied 20260521100000_work_visibility_featured
npx prisma migrate deploy
```

若仍有其它 duplicate column，对报错对应的 migration 目录名重复 `migrate resolve --applied <name>`。

### 方案 B：换用 CI 库做 QA / E2E

不碰 dev.db，与 CI 一致：

```bash
$env:DATABASE_URL = "file:./prisma/ci.sqlite"
npx prisma migrate deploy
npm run qa:runtime-config-admin
```

Playwright / 多数 `qa:*` 脚本默认已指向 `prisma/ci.sqlite`。

### 方案 C：删库重建（会丢失本地作品）

```bash
Remove-Item prisma/dev.db -ErrorAction SilentlyContinue
$env:DATABASE_URL = "file:./dev.db"
npx prisma migrate deploy
```

## 与 API / dev 服务对齐

若 `8888` 上的 dev 读 **`dev.db`**，而 QA 脚本写 **`ci.sqlite`**，会出现「API 看不到刚 seed 的数据」。对齐方式：

- 开发：`npm run dev`（`run-dev.mjs` 会自动把 shell 残留的 `ci.sqlite` 改回 `dev.db`，除非 `DEV_ALLOW_CI_DB=1`）
- QA 同库：`QA_USE_DEV_DB=1 npm run qa:runtime-config-admin`
- **勿用** `file:./prisma/dev.db`（会落到错误路径）；文学实机 QA 用 `file:./dev.db`

### 文学实机回归（宋辽）

```powershell
# 四档小说（跳过漫画）
npm run qa:songliao:novels

# 中篇 8 页 + 全量配图（默认 lib 直调，与 dev.db 同源）
npm run qa:songliao:comic-full

# 仅分镜（跳过配图，~5min；自动复用缓存中篇 novelId）
npm run qa:songliao:storyboard

# 分镜 → 配图 链式（~12min）
npm run qa:songliao:medium-chain

# 仅补配图（自动复用缓存 comicId）
npm run qa:songliao:panels-resume

# 仅补配图
$env:QA_COMIC_RESUME_ID="<comicId>"
$env:QA_PANEL_RENDER_MODE="lib"
npm run qa:songliao-literary-regression
```

`QA_PANEL_RENDER_MODE=lib`（默认）直接调用 `renderComicPanels`，无需 dev 进程；`http` 模式需 dev 与 QA **同一 `DATABASE_URL`**。

## 部署前检查（migrate deploy + generate）

生产或 staging 部署前：

```bash
npx prisma migrate deploy
npx prisma generate
npm run build
```

### Windows：`prisma generate` 报 EPERM

若 **`dev` 仍在跑（8888）**，Windows 会锁定 `node_modules/.prisma/client/query-engine-windows.exe`，`generate` 可能失败。**不影响已运行 dev**（引擎已加载）；部署机或 CI 上无此锁。

本地需要 regenerate 时：

1. 停掉 `npm run dev` / 8888 进程  
2. 再执行 `npx prisma generate`  
3. 重启 dev  

迁移本身可在 dev 运行时执行：`npx prisma migrate deploy`（只改 SQLite 文件，不替换 query engine）。

## 相关文档

- 超级管理员与 runtime-config QA：`docs/admin-super-admin.md`
- 环境变量示例：`.env.example`
