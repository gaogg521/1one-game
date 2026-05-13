<div align="center">

<img src="./public/brand/logo.png" alt="1ONE游戏平台 Logo" width="96" height="96" />

# 1ONE游戏平台

**AI 驱动的浏览器小游戏创作与分享**

用自然语言描述玩法 → 结构化规格 → **Phaser** 即时试玩 → 保存、短链分享与工作室管理。

[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://react.dev/)
[![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma)](https://www.prisma.io/)
[![Phaser](https://img.shields.io/badge/Phaser-4-ffb64c)](https://phaser.io/)

</div>

**语言 / Language**：[中文文档](#目录) · [English documentation](#english-overview)

---

## 目录

- [演示与录屏](#演示与录屏)
- [产品亮点](#产品亮点)
- [界面与素材预览](#界面与素材预览)
- [核心用户路径](#核心用户路径)
- [技术架构](#技术架构)
- [功能与路由](#功能与路由)
- [快速开始](#快速开始)
- [环境变量](#环境变量)
- [数据库与迁移](#数据库与迁移)
- [API 一览](#api-一览)
- [主题与 UI](#主题与-ui)
- [样品馆与封面](#样品馆与封面)
- [开发与构建](#开发与构建)
- [CI 与部署注意](#ci-与部署注意)
- [项目结构（节选）](#项目结构节选)
- [相关说明](#相关说明)
- [English — Overview](#english-overview)

---

## 演示与录屏

> 对外演示建议准备 **60～120 秒** 成片：首页 → 创作台输入 → 流式或单次生成 → Phaser 试玩 → 保存 → 工作室出现封面。

| 类型 | 占位 | 说明 |
|------|------|------|
| **在线演示** | `https://your-demo.example.com` | 替换为实际部署地址（VPS / Docker / 内网穿透等）。 |
| **演示视频（中文）** | `[哔哩哔哩 · 待上传](https://www.bilibili.com/)` | 将链接改为你的 BV 号视频。 |
| **演示视频（英文）** | `[YouTube · TBD](https://www.youtube.com/)` | 海外受众使用。 |

**README 内嵌封面式入口（可选）**：有视频后把下面链接与缩略图换成真实地址即可（缩略图可放在 `docs/screenshots/video-cover.png`）。

```markdown
[![1ONE 平台演示](./public/brand/logo.png)](https://your-video-url)
```

当前用 Logo 作为占位图；上传正式封面后把 `./public/brand/logo.png` 改为你的 `docs/screenshots/video-cover.png` 即可。

---

## 产品亮点

| 能力 | 说明 |
|------|------|
| **一句话创作** | 在创作台输入描述，调用大模型生成可解析的 **GameSpec**，并驱动 Phaser 场景（塔防 / 平台跳跃等模板）。 |
| **流式与多方案** | 支持 **SSE 流式生成** 与 **并行多套备选**，便于对比不同风味。 |
| **参考素材 ingest** | 支持上传文档 / 图片或 URL，解析后合并进 Prompt（需配置 API）。含图时参考贴图写入 **sessionStorage**：默认长边 ≤1920 且 JPEG；仍超上限则 **自动多轮降画质，再不行则从末尾删张**，无需手动选择。 |
| **作品库** | 基于 **HttpOnly Cookie** 的 `ownerKey` 归属；列表、搜索、删除、**Remix 复制**。 |
| **分享** | 完整链接 + **短链** `/s/[shareCode]`；试玩页支持复制。 |
| **自动封面** | 所有者在试玩页加载后，客户端截取 **Canvas 首帧** 为 JPEG，写入 `public/covers/` 并在工作室展示。 |
| **五套全局主题** | 与 [1oneclaw 宣传站](http://1oneclaw.com/) 一致的主题 ID、`data-theme` 与 `localStorage` 约定；含全站背景动效。 |
| **样品馆** | 类画廊的横向滑动卡片，竖版封面 + 播放量风格标签 + 一键试玩 / 微调。 |

---

## 界面与素材预览

以下为仓库内 **真实静态资源**（可直接在 GitHub / 本地预览 README 时渲染）。

### 品牌 Logo

<p align="center">
  <img src="./public/brand/logo.png" alt="1ONE游戏平台" width="120" />
</p>

### 样品馆竖版封面（SVG 海报）

同一套数据可在 `/samples` 以画廊形式浏览；运营可将 `src/lib/samples.ts` 中的 `coverImageSrc` 替换为 WebP 截图路径。

| 萝卜守护战 | 王国边境防线 | 霓虹防火墙 | 霓虹废墟跑酷 |
|:---:|:---:|:---:|:---:|
| ![](public/samples/td-carrot.svg) | ![](public/samples/td-kingdom.svg) | ![](public/samples/td-cyber.svg) | ![](public/samples/plat-ruins.svg) |

### 建议自行补充的截图位

若需对外文档更「产品化」，可在仓库中新增 `docs/screenshots/` 并放入 PNG/WebP，例如：

- `docs/screenshots/home.png` — 首页主视觉  
- `docs/screenshots/create.png` — 创作台 + Phaser 预览  
- `docs/screenshots/studio.png` — 工作室卡片与封面  
- `docs/screenshots/samples.png` — 样品馆横滑  

然后在本文对应小节引用 `![](docs/screenshots/xxx.png)` 即可。

---

## 核心用户路径

```mermaid
flowchart LR
  A[首页] --> B[创作台]
  B --> C{生成规格}
  C --> D[Phaser 预览]
  D --> E[保存作品]
  E --> F[试玩页 /play/id]
  F --> G[自动封面 PATCH]
  G --> H[工作室列表]
  F --> I[短链分享 /s/code]
  A --> J[样品馆]
  J --> K[一键试玩]
  K --> F
```

---

## 技术架构

```mermaid
flowchart TB
  subgraph Client [浏览器]
    UI[Next.js App Router + React 19]
    Theme[data-theme + ThemeProvider]
    Phaser[Phaser 4 运行时]
    Cap[Canvas 截图上传封面]
  end
  subgraph Server [Node Server]
    API[Route Handlers]
    OAI[OpenAI 兼容 SDK]
    Prisma[Prisma + SQLite]
    FS[public/covers 文件]
  end
  UI --> API
  Phaser --> Cap
  Cap --> API
  API --> OAI
  API --> Prisma
  API --> FS
```

---

## 功能与路由

| 路径 | 说明 |
|------|------|
| `/` | 首页：产品介绍、入口 |
| `/create` | 创作台：Prompt、参考素材、流式/多方案生成、预览、保存并跳转试玩 |
| `/studio` | 工作室：作品列表、搜索、打开、复制、删除；展示封面缩略图 |
| `/samples` | 样品馆：分区横滑、试玩 / 微调 |
| `/play/[id]` | 试玩页：元信息、分享、Remix、Phaser 全屏；**所有者**触发封面采集 |
| `/s/[code]` | 短链跳转试玩 |

---

## 快速开始

**环境**：Node.js **18+**（推荐与 CI 一致的 **22**）、npm。

```bash
# 安装依赖（会自动 prisma generate）
npm ci

# 配置环境变量（至少 DATABASE_URL；生成能力需配置 OpenAI 兼容项）
copy .env.example .env   # Windows
# cp .env.example .env  # macOS / Linux

# 应用数据库迁移（本地开发）
npx prisma migrate dev

# 启动开发服务（脚本已固定端口 8888，无需再传 -p）
npm run dev
```

浏览器打开 **http://localhost:8888** 即可（若 8888 已被占用，Next 会在终端提示并改用其它端口）。若仅未配置模型密钥，部分生成接口会走项目内 **mock / 规则推断**（行为以运行时提示为准）。

---

## 环境变量

复制 `.env.example` 为 `.env` 后按需填写。常用项如下：

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | SQLite 连接串，默认 `file:./dev.db`（相对 `prisma` 目录） |
| `OPENAI_API_KEY` | 兼容 OpenAI SDK 的密钥 |
| `OPENAI_BASE_URL` | 网关根地址（可对接 LiteLLM / OpenClaw 等） |
| `OPENAI_MODEL` | 主模型 ID |
| `OPENAI_MODEL_FALLBACKS` | 备用模型，逗号分隔 |
| `OPENAI_EXTRA_HEADERS_JSON` | 可选额外请求头 JSON |
| `OPENAI_USER_AGENT` | 部分网关校验 UA 时使用 |

---

## 数据库与迁移

- **ORM**：Prisma  
- **默认数据库**：SQLite（文件库，适合单机与快速迭代）  
- **核心模型**：`Project`（`ownerKey`、`specJson`、`shareCode`、`coverPath` 等）

```bash
npx prisma migrate dev    # 开发：改 schema 后生成并应用迁移
npx prisma migrate deploy # 生产/CI：仅应用已有迁移
npx prisma db push        # 无迁移文件时的快速对齐（团队规范优先 migrate）
```

---

## API 一览

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/health` | 健康检查 |
| `POST` | `/api/generate` | 单次生成 GameSpec |
| `POST` | `/api/generate/stream` | SSE 流式生成 |
| `POST` | `/api/generate/variants` | 并行多套方案 |
| `POST` | `/api/ingest` | 参考素材解析（multipart） |
| `GET` | `/api/projects` | 当前会话作品列表 |
| `POST` | `/api/projects` | 新建作品 |
| `GET` | `/api/projects/[id]` | 作品详情 + Spec |
| `PATCH` | `/api/projects/[id]` | 更新标题、短链、**封面 JPEG（base64）** |
| `DELETE` | `/api/projects/[id]` | 删除作品及封面文件 |
| `POST` | `/api/projects/[id]/duplicate` | 复制作品（含封面文件） |

---

## 主题与 UI

- 五套主题：**深海暗夜**、**极简浅色**、**蓝色科技风**、**橙色暖调**、**森林绿境**（定义见 `src/lib/themes.ts`）。  
- 根节点使用 **`data-theme`**，持久化键为 **`theme`**（见 `ThemeProvider` 与首屏内联脚本）。  
- 全站背景动效与噪点层对齐 **1oneclaw** 宣传站风格（`globals.css` + `layout.tsx`）。  
- 开发环境下已通过 `next.config.ts` 的 **`devIndicators: false`** 关闭右下角指示器（可按需改回）。

---

## 样品馆与封面

- **样品数据**：`src/lib/samples.ts` — 含 `coverImageSrc`、`coverAlt`、分区 `shelf` 等，便于运营改物料。  
- **用户作品封面**：试玩页内 Phaser `canvas` → 缩放 JPEG → `PATCH` 写入 `public/covers/{id}.jpg`；**无持久化磁盘的 Serverless 环境**需改为对象存储或 CDN URL（当前仓库以本地/容器卷为假设）。  
- **`.gitignore`**：忽略 `public/covers/*.jpg`，保留 `public/covers/.gitkeep`。

---

## 开发与构建

| 命令 | 说明 |
|------|------|
| `npm run dev` | 本地开发；`package.json` 已配置 **`next dev -p 8888`**，默认 **http://localhost:8888**，减少与常见 3000 端口冲突。 |
| `npm run build` | 生产构建（`next build`；首次 `npm ci` 时 `postinstall` 会执行 `prisma generate`）。 |
| `npm run build:full` | 显式 `prisma generate && next build`（CI 或改 schema 后想手动跑一遍时可用）。 |
| `npm run start` | 生产模式启动 **`next start`**，默认监听 **3000**；可用环境变量 **`PORT`** 覆盖（如 `set PORT=4000` 后 `npm run start`，命令因系统而异）。 |
| `npm run lint` | ESLint |

**创作台参考图**：解析出的位图会写入浏览器 **sessionStorage**（键由 `src/lib/assets/reference-image-payloads.client.ts` 管理）。策略为 **先尝试原样写入 → 多轮降低 JPEG 质量 → 仍失败则每次去掉队列末尾一张并重试**，直至写入成功或清空；界面会给出简要提示（如已降画质 / 已删尾张）。

**Docker**：仓库内 `Dockerfile` / `docker-compose` 面向生产 **`next start`**，容器内仍为 **3000**；与本地 **`npm run dev` → 8888** 互不冲突。

---

## CI 与部署注意

- **GitHub Actions**（`.github/workflows/ci.yml`）：`npm ci` → `prisma migrate deploy` → `lint` → `build`。  
- **封面文件**：部署多实例或无本地写权限时，需将封面上传逻辑对接 **S3 / OSS** 等，并把 `coverPath` 存为可公开访问的 URL。  
- **Phaser**：已在 `next.config.ts` 中 `transpilePackages: ["phaser"]`。  
- **服务端依赖**：`pdf-parse`、`mammoth` 等见 `serverExternalPackages` 配置。

---

## 项目结构（节选）

```text
game/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── public/
│   ├── brand/logo.png
│   ├── samples/           # 样品馆默认 SVG 封面
│   └── covers/            # 用户作品自动截图（git 忽略 *.jpg）
├── src/
│   ├── app/               # App Router 页面与 API
│   ├── components/        # 布局、主题、GamePlayer 等
│   ├── game/engine/       # Phaser 场景与工厂
│   └── lib/               # Spec、主题、封面工具、Prisma 等
├── .env.example
├── next.config.ts
└── README.md
```

---

## 相关说明

- 本项目使用 **Next.js 16**，部分约定可能与旧版文档不同；开发前可参考仓库规则（如 `AGENTS.md`）与官方升级指南。  
- 对外品牌名与 Logo 配置见 `src/lib/brand.ts`。  
- 若需对接 **OpenClaw / LiteLLM**，优先对齐 `.env.example` 中的注释示例。

---

<a id="english-overview"></a>

## English — Overview

**1ONE Game Lab** — AI-assisted creation of small browser games: describe gameplay in natural language, get a structured **GameSpec**, run it instantly with **Phaser**, then save, share (full URL + short link), and manage projects in **Studio**. Themes and gallery UX align with the [1oneclaw](http://1oneclaw.com/) marketing site palette and patterns.

### Language

- This section mirrors the Chinese README above.  
- For screenshots and brand assets, the same `./public/...` paths apply.

### Demo & screen recording

| Kind | Placeholder |
|------|-------------|
| Live demo | `https://your-demo.example.com` |
| Video (CN) | Upload to Bilibili and link here |
| Video (EN) | Upload to YouTube and link here |

Optional click-to-play row (replace URL and thumbnail when ready):

```markdown
[![Watch demo](./public/brand/logo.png)](https://your-video-url)
```

### Key features

| Feature | Description |
|--------|-------------|
| **Prompt → game** | LLM produces a parseable **GameSpec** driving Phaser (tower defense, platformer, etc.). |
| **Streaming & variants** | **SSE** streaming and **parallel variant** generation. |
| **Reference ingest** | Upload docs/images or paste URLs; merged into the prompt (API required). Image payloads go to **sessionStorage** (long edge ≤1920, JPEG); if still too large, **auto multi-pass quality reduction**, then **drop from the end** until it fits—no modal. |
| **Project library** | **HttpOnly cookie** `ownerKey`; list, search, delete, **duplicate / Remix**. |
| **Sharing** | Full play URL + short path `/s/[shareCode]`. |
| **Auto cover** | Owner’s play session captures the **first Phaser frame** as JPEG → `public/covers/{id}.jpg` → shown in Studio. |
| **5 themes** | Same IDs as 1oneclaw: dark, light, cyber-blue, warm-orange, forest-green (`data-theme` + `localStorage`). |
| **Samples gallery** | Horizontal shelves, portrait covers, one-tap try & refine. |

### Screenshots (in-repo assets)

| Radish TD | Kingdom TD | Cyber TD | Neon platformer |
|:---:|:---:|:---:|:---:|
| ![](public/samples/td-carrot.svg) | ![](public/samples/td-kingdom.svg) | ![](public/samples/td-cyber.svg) | ![](public/samples/plat-ruins.svg) |

Add under `docs/screenshots/` for marketing-grade UI captures and reference them here.

### User journey

```mermaid
flowchart LR
  A[Home] --> B[Create]
  B --> C{Generate spec}
  C --> D[Phaser preview]
  D --> E[Save project]
  E --> F[Play /play/id]
  F --> G[Auto cover PATCH]
  G --> H[Studio]
  F --> I[Short link /s/code]
  A --> J[Samples]
  J --> K[Try now]
  K --> F
```

### Architecture

```mermaid
flowchart TB
  subgraph Client [Browser]
    UI[Next.js App Router + React 19]
    Theme[data-theme + ThemeProvider]
    Phaser[Phaser 4 runtime]
    Cap[Canvas → JPEG upload]
  end
  subgraph Server [Node]
    API[Route Handlers]
    OAI[OpenAI-compatible SDK]
    Prisma[Prisma + SQLite]
    FS[public/covers]
  end
  UI --> API
  Phaser --> Cap
  Cap --> API
  API --> OAI
  API --> Prisma
  API --> FS
```

### Routes

| Path | Purpose |
|------|---------|
| `/` | Landing |
| `/create` | Editor: prompt, ingest, stream/variants, preview, save |
| `/studio` | Project list, search, thumbnails |
| `/samples` | Gallery-style samples |
| `/play/[id]` | Play, share, Remix; **owner** triggers cover capture |
| `/s/[code]` | Short link resolver |

### Quick start

Requires **Node.js 18+** (CI uses **22**).

```bash
# Install deps (postinstall runs prisma generate)
npm ci

# Env: at least DATABASE_URL; LLM keys for real generation
cp .env.example .env    # or: copy .env.example .env on Windows

# Apply DB migrations (local dev)
npx prisma migrate dev

# Dev server fixed to port 8888 in package.json (no extra -p flag needed)
npm run dev
```

Dev server listens on **`http://localhost:8888`** by default (`npm run dev` runs `next dev -p 8888` in `package.json`; no extra `-p` needed). If 8888 is busy, Next prints the actual port. Without API keys, some flows fall back to **mock / heuristic** generation.

### Environment variables

See `.env.example`. Main entries: `DATABASE_URL`, `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`, `OPENAI_MODEL_FALLBACKS`, optional `OPENAI_EXTRA_HEADERS_JSON`, `OPENAI_USER_AGENT`.

### Database

- **Prisma** + **SQLite** by default.  
- Model **`Project`**: `ownerKey`, `specJson`, `shareCode`, `coverPath`, timestamps.

```bash
npx prisma migrate dev
npx prisma migrate deploy
```

### API summary

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/health` | Health |
| `POST` | `/api/generate` | Single generation |
| `POST` | `/api/generate/stream` | SSE |
| `POST` | `/api/generate/variants` | Parallel variants |
| `POST` | `/api/ingest` | Reference ingest |
| `GET`/`POST` | `/api/projects` | List / create |
| `GET`/`PATCH`/`DELETE` | `/api/projects/[id]` | Detail, title/share/cover, delete |
| `POST` | `/api/projects/[id]/duplicate` | Clone (+ cover file) |

### Themes & UI

Themes live in `src/lib/themes.ts` and `globals.css`. Dev overlay indicator is disabled via `devIndicators: false` in `next.config.ts` (change if you want the Next.js dev badge back).

### Samples & covers

- Sample rows: `src/lib/samples.ts` (`coverImageSrc`, `coverAlt`, `shelf`).  
- User covers: written under `public/covers/` — on **ephemeral serverless** hosts, switch to **object storage** and store a public URL in `coverPath`.

### Scripts

| Script | Notes |
|--------|--------|
| `npm run dev` | `next dev -p 8888` — default **http://localhost:8888** |
| `npm run build` | `next build` (`prisma generate` runs on `npm ci` via `postinstall`) |
| `npm run build:full` | `prisma generate && next build` |
| `npm run start` | `next start` — default port **3000**; override with **`PORT`** |
| `npm run lint` | ESLint |

**Create / reference images:** blobs are stored in **sessionStorage** with automatic **recompress → drop last** until write succeeds or cleared; see `src/lib/assets/reference-image-payloads.client.ts`.

**Docker:** `Dockerfile` / compose target **`next start`** on port **3000** inside the container; local **`npm run dev`** uses **8888** — no conflict.

### CI & deployment

- GitHub Actions: `npm ci` → `prisma migrate deploy` → `lint` → `build` (see `.github/workflows/ci.yml`).  
- **Phaser** is transpiled via `next.config.ts`.  
- **Covers**: use durable storage in multi-instance production.

### Repository layout (excerpt)

```text
prisma/          schema + migrations
public/brand     logo
public/samples   default sample art
public/covers    auto thumbs (jpg gitignored)
src/app          pages + API routes
src/game/engine  Phaser scenes
src/lib          spec, themes, prisma helpers, cover utils
```

### Notes

- Next.js **16** may differ from older docs; see `AGENTS.md` / official upgrade guides.  
- Brand strings: `src/lib/brand.ts`.  
- OpenClaw / LiteLLM: follow comments in `.env.example`.

---

<div align="center">

**1ONE游戏平台** · 让一句话变成可玩版本 · *One prompt, one playable build*

</div>
