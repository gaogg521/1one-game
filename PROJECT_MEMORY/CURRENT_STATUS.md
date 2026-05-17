# CURRENT_STATUS

更新时间：**2026-05-17**（继续推进游戏模板结构：PlayScene 目标闭环 + Platformer 关卡段落深化）

## 项目整体进度

完成度：**主链路可用**  
当前阶段：小说 / 漫画 / 游戏三模块 + Studio；近期完成 **游戏创作台共创流程**、**试玩 patch/save 闭环**、**shooter 接入共享 systems/director**

## 各模块状态

| 模块 | 状态 | 备注 |
|------|------|------|
| 游戏生成 / 试玩 | ✅ | 创作台已升级为 4 步共创；试玩支持 patch / quick tune 后保存回项目；`PlayScene / PlatformerScene` 已继续补阶段目标与关卡段落 |
| 小说生成 / 阅读 | ✅ | 流式、章节、封面；书名最长 15 字 |
| 漫画生成 / 阅读 | ✅ | 分镜 + SSE 配图进度；>4 格创建时不内联配图 |
| 文生图 | ✅ | **默认 OpenAI 兼容网关**（`gpt-image-2`）；未配 `COMFY_UI_BASE_URL` 不走 Comfy |
| Studio 我的作品 | ✅ | 三源合并；`mine=1`；支持删除 |
| 发现 / 列表 | ✅ | 小说广场 **本人作品可删** |

## 文生图路径（已确认）

- **无 ComfyUI**：`.env` 未配置 `COMFY_UI_BASE_URL` → 仅 `images.generate` 经 LiteLLM
- **短篇 4 格**：`IMAGE_GEN_BATCH_PANELS=4` 时 **单次请求 n=4**（实测 ~4 分 25 秒 / 批）
- **>4 格**：`COMIC_PANEL_GEN_CONCURRENCY` 默认 **4** 路并行逐张
- 漫画配图 SSE：`/api/comic/[id]/panels/stream`，心跳含 **已用时**

## 实测数据（2026-05-16）

| 场景 | 结果 |
|------|------|
| 批量 4 张（HTTP stream） | 4/4 成功，**4 分 25 秒** |
| 《煤山崇祯》2 页 8 格配图 | comic `cmp8e84lk0001x6zgo8jrd8jg`，**12 分 12 秒** |
| 《煤山崇祯》中篇 8 页分镜（一次） | LLM 502，未返回有效分镜 |

## 构建与运行

- **`npm run build`**：已通过（含本轮 `PlayScene` / `PlatformerScene` 结构改动）
- 本地：**`npm run dev -p 8888`**
- Prisma：列表曾用 `$queryRaw` 绕过未 generate 的 `Comic.coverPath`；仍建议关 dev 后 **`npx prisma generate`**

## 游戏生成本轮升级（2026-05-16 夜）

- **Create 页**：由“单轮 prompt -> 一次生成”改为 **4 步共创**：
  1. 输入创意  
  2. 系统提炼意图  
  3. 选择 2~3 个候选方向  
  4. 再生成试玩结果
- **SSE 可视化**：生成日志中新增“当前理解 / 选中方向 / 成品提要”，不再只显示阶段名。
- **项目版本真相源**：
  - `PATCH /api/projects/[id]` 支持 **prompt + spec** 回写
  - `/create?from=` 可恢复 **完整 spec + prompt**，不是只回填一句描述
  - `play/[id]` 支持 **AI patch 后保存**，并把 quick tune 修改一起落库
- **共享运行时推进**：
  - `shooter` 已消费 `systems.skill` 与 `director.events`
  - 支持护盾、时停/减速、爆发火力、goalShift 演出窗口
- **塔防蓝图**：
  - `td-blueprint` 的波次已加入 **rush / elite** 差异化生成，避免只按线性数量堆怪

## 2026-05-17 继续推进（本轮新增）

- **PlayScene**：
  - `goalShift` 已从“只有文案提示”补成真实目标闭环
  - 目标完成会给奖励分与反馈 banner，失败也有事件反馈
- **PlatformerScene**：
  - `director.acts.modifiers` 已真正映射到关卡生成
  - 新增断层段落、精准跳段落、刺陷段落、终局守卫段落
  - 新增 `sentryHazards` 巡逻守卫，终局/危险章节不再只是随机平台
- **生成侧**：
  - `generate-spec.ts` 继续强化“玩法结构优先”，减少仅换皮的规格
  - `mock-spec.ts` 默认文案更偏阶段目标 / 波次 / 关卡推进

## 已知问题

1. **32 格全配图**：约 **40～50 分钟**（网关耗时），需流式接口 + 耐心等  
2. **Prisma Client 与 schema 漂移**：`lengthTier` / `coverPath` 写入已 raw SQL 兜底；本地 `prisma generate` 若 EPERM 需先停 8888/dev；部署前 **`migrate deploy` + generate**  
3. **中篇小说流式断连**：`.env` 网关 `x-openclaw-timeout-ms` 已从 25s 改为 600000；小说 LLM 另走 `llmNovelTextStream` 覆盖  
4. **六模板「肉眼玩一局」**：E2E 已覆盖加载与闭环，章节/事件动效仍需偶尔人工扫一眼  
5. **工作区大量未提交变更**，未形成新 commit

## 手测模拟（2026-05-17）

- `qa:template-matrix` 6/6 · Playwright **24** 项（核心游戏 **18** + 小说漫画页）· 漫画 **8 页/32 格** 分镜 ~206s  
- 报告：`PROJECT_MEMORY/HANDTEST_SIMULATION_REPORT.md` · 一键：`scripts/run-handtest-all.ps1`
