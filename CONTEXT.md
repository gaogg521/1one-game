# 项目工作进度快照

**最后更新**：2026-06-18  
**项目**：游戏生成与创意内容平台（Next.js + Prisma）

---

## 当前状态

### 工作进度概览
- **当前分支**：main
- **最近提交**：`cae33cc fix(llm): 修复游戏生成主动 abort 导致网关 context canceled`
- **修改文件数**：12 个核心模块被修改
  - 游戏引擎层：`PlayScene.ts`, `ShooterScene.ts`, `TowerDefenseScene.ts`, `PlatformerScene.ts`, `createPhaserGame.ts`, `HudBanner.ts`, `HudGoalPanel.ts`
  - 音频系统：`webBleeps.ts`
  - 业务层：`CreateClient.tsx`, `GamePlayerInner.tsx`
  - 配置层：`game-spec.ts`, `generate-spec.ts`, `enrich-game-spec.ts`, `product-config.ts`

### 已知待办
- [ ] 验证最近修改的 12 个文件是否完整闭环（编译、类型、测试）
- [ ] 复核 LLM abort 修复的影响范围
- [ ] 补齐涉及游戏生成 / 创意台的相关测试
- [ ] 评估是否需要更新 HUD 相关单元测试

### 外部资源
- 新增图片资源：`public/covers/` 目录下 20+ 个游戏封面（cmq*.jpg）
- 新增缓存与数据目录：`.data/`, `.qa-cache/`, `data/`, `prisma/prisma/`
- 数据库配置：`prisma/` 

### 下次启动清单
1. **读取本文件** 了解项目快照
2. **检查编译状态**：`npm run build:full` 验证类型与依赖
3. **本地开发启动**：`npm run dev` 启动 dev server
4. **运行回归测试**：选择合适的 `qa:*` 脚本验证核心链路
5. **查看待办内容**：本文件与 `git status` 双交叉确认

---

## 项目概况（不常变）

**技术栈**：  
- Runtime：Node.js + Next.js（API + SSR）  
- ORM：Prisma  
- 游戏引擎：Phaser 3  
- 前端：React + TypeScript  
- 内容生成：LLM 集成（OpenAI / Gemini）  

**核心功能**：  
1. **创意内容生成**：剧本、游戏规格、分镜脚本  
2. **游戏引擎**：Platformer / Shooter / Tower Defense / 3D 等多种模板  
3. **样品库**：预生成的游戏模板与资源库  
4. **播放器**：Phaser 驱动的游戏试玩与回放  

**常用命令**：
```bash
npm run dev              # 本地开发（监听 port 3000）
npm run build:full      # 编译 + Prisma generate
npm run qa:*            # 各类 QA 流程脚本
npm run lint            # ESLint 检查
```

---

## 会话记录

### 会话 1（2026-06-18）
- **操作**：建立 CONTEXT.md 与会话启动规范
- **变更**：修改 CLAUDE.md，新增「新会话初始化流程」条款
- **状态**：就绪，等待下次用户指令

---

**新会话时**：执行以上「下次启动清单」第 1 项。
