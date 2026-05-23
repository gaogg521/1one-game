# CURRENT_STATUS

更新时间：**2026-05-23**（Godot 塔防精灵贴图修复 + 知识库整理）

## 项目整体进度

完成度：**主链路可用，可对外演示**  
当前阶段：游戏 / 小说 / 漫画三模块 + Studio；**业务参数在 `product-config.ts`**，`.env` 仅密钥与网关。

## 各模块状态

| 模块 | 状态 | 备注 |
|------|------|------|
| 游戏生成 / 试玩 | ✅ | 4 步共创；`refine` API；六模板 E2E **24/24**；PlayScene 目标闭环 |
| 小说生成 / 阅读 | ✅ | 短篇/中篇/长篇；**长篇分段续写**（大纲 + 多段）；流式网关超时已代码化 |
| 漫画生成 / 阅读 | ✅ | 分镜 + SSE 配图；8 页分镜手测 ~200s；32 格长测约 40～50min |
| 文生图 | ✅ | `gpt-image-2` 主路径；≤4 格批量 `n=4` |
| Studio | ✅ | 三源合并；游戏/小说/漫画 **duplicate** |
| 发现 / 列表 | ✅ | 点赞、排序、本人作品删除 |
| Godot Web 导出 | ✅ | 塔防精灵贴图修复完成；缓存失效机制已更新 |

## 配置与部署

| 项 | 说明 |
|----|------|
| 产品常量 | **`src/lib/product-config.ts`**（模型、超时、限流、漫画并发等） |
| 长篇分段 | **`src/lib/novel-long-config.ts`** |
| `.env` | 仅 `OPENAI_API_KEY`、`OPENAI_BASE_URL`、可选 `GEMINI_API_KEY` |
| 测试库 | **`prisma/ci.sqlite`** 已纳入仓库（E2E/手测） |
| 远程 | https://github.com/gaogg521/1one-game — `main` |

## 最近修复（2026-05-23）

### Godot 塔防精灵贴图
- **根因**：`player.png` 被 `classifyReferencePayloads` 分到 protagonist，塔防运行时从 towerSkins 取塔贴图 → 数组为空 → 回退到默认几何造型（绿色圆圈+三角形）
- **修复**：
  1. `writeGodotReferenceAssets` 增加双向 fallback（protagonist ↔ towerSkins 共享纹理）——通用兜底，所有模板受益
  2. 新增 `adjustAiSpritePurposesForTemplate`，`towerDefense` 模板下 player.png purpose 改为"防御塔 植物 豌豆射手"，正确分类为 towerSkin
  3. `GODOT_RUNTIME_BUILD_REV` 递增为 `"20260523-tower-skin-fallback"`，旧缓存自动失效重建

### 其他修复（前几轮会话）
- Node.js 僵尸进程：移除 `shell:true`，改为直接 spawn + 信号处理
- `game_audio.gd`：`DisplayServer.is_headless()` 不存在 → 改为 `get_name() == "headless"`
- `game_audio.gd`：`var scale` 与 Node 属性冲突 → 重命名为 `arp_scale`
- 前端等待精灵：saveAndPlay 跳转前 `waitForSprites()` 轮询，确保精灵先生成再进游戏

## 已知问题

1. **微调 UI**（金币、怪物数量、地图等参数调节）——用户有需求，SpecQuickTunePanel 已有基础，待完善
2. **Phaser 侧精灵贴图尺寸**——截图显示僵尸贴图可能覆盖全屏，需单独排查 Phaser 纹理加载逻辑
3. **32 格配图**耗时长，进程重启会中断长测
4. **Prisma generate** 本地偶发 EPERM（需停 dev）
5. **六模板动效**建议偶尔肉眼扫一眼
6. **工作室批量删除**未做

## 文档

- 本日总结：`PROJECT_MEMORY/iterations/2026-05-23.md`（待建）
- 决策记录：`PROJECT_MEMORY/DECISIONS.md` §2026-05-23
