更新时间：**2026-06-22**（生产部署 · 运行时素材同步）

## 生产部署 checklist（必做 · 2026-06-22 起）

代码 push 后在本机执行：

```bash
python scripts/deploy-prod-with-assets.py
```

或分步：`deploy-prod-cee8b1d.py` → `sync-sample-assets-to-prod.py` → `sync-literary-covers-to-prod.py`

验收：`check-prod-literary-covers.py` · `/novels` `/comics` `/samples` 封面不 404。

详见 `PROJECT_MEMORY/DECISIONS.md` · 2026-06-22。

---

## 迭代一百零九（当前）

1. ✅ **飞机大战 → shooter 模板**
   - `definitions.ts` / `create-studio-narrative` 关键词补齐
   - `qa:game-route-offline` 断言 `inferTemplateFromPrompt` + text/vision 路由
2. ✅ **共创方向改版**
   - `buildCoCreationDirections` 按 prompt 生成 4 条对话式选项（非固定三张卡片）
3. ✅ **HUD 叠字发糊**
   - 长 subtitle 不画顶栏；有 Goal 面板时 Banner 只闪标题
4. ✅ **游戏模型双路由 `game_text` / `game_vision`**
   - 无图文本池 · 有图/参考摘录多模态池；后台 Runtime 可配
   - 生成 recap 展示「模型路由」行（SSE + 创作台）
5. ✅ **LiteLLM 超时放宽**
   - `genTimeoutMs` 18s→45s · `totalTimeoutMs` 42s→120s
   - 网关错误文案澄清上游失败（非平台直连 Azure）
6. **下一步**
   - Console 保存 `game_text` / `game_vision` 两行模型
   - 用「设计一个飞机大战的游戏」实机生成验收 shooter 贴图与 HUD
   - 预发 `qa:staging-post-deploy`；LiteLLM 侧排查 Azure/Vertex 上游

## 迭代一百零八

1. ✅ **Staging 部署后抽测**
   - `qa:staging-post-deploy`：health · QA 路由 · Browser Bench · 复杂 SSE · 离线门禁
   - `STAGING_BASE_URL` 支持远程预发；报告 `qa-output/staging-post-deploy/`
2. ✅ **平台 QA 打包**
   - `qa:platform-bundle`：回放 + staging SSE +（`RUN_LLM_QA=1`）双用例生成
3. ✅ **文档**
   - `deploy-linux-ubuntu22.md` staging 部署后验收命令
   - `.env.staging.example` 补充 `GAME_SPRITE_OUTPUT_PX`
4. **下一步**
   - 预发服务器 `STAGING_BASE_URL=http://host npm run qa:staging-post-deploy`
   - 真实 `opengame` CLI：`OPENGAME_CLI_ALLOW_STUB=0`

## 迭代一百零七

1. ✅ **platform-test-user 创作台回放**
   - `qa:platform-create-replay`：DB + HTTP GET 验收 · 报告 `qa-output/platform-create-replay/`
   - `e2e/platform-test-user-replay.smoke.spec.ts`：**1/1 PASS**
2. ✅ **平台 E2E 收口**
   - `test:e2e:platform-smoke`：3/3（Agentic / 封面 / 回放）
   - 修复 `platform-complex-agentic`：`buildFallbackAgenticModule` 导入 + `page.goto` 拿 owner cookie
3. ✅ **Staging 复杂 prompt HTTP**
   - `qa:staging-complex-smoke`：离线 + **dev @8888 Agentic SSE 全绿**
4. **下一步**
   - `qa:platform-test-generate` 长跑验收（需 OPENAI_API_KEY）
   - staging 服务器 `OPERONE_STAGING=1` 部署抽测
   - 真实 `opengame` CLI：`OPENGAME_CLI_ALLOW_STUB=0`

## 迭代一百零六

1. ✅ **OpenGame CLI 实机管线（QA stub）**
   - `scripts/bin/opengame-qa-stub.mjs`：无本机 `opengame` 时走 headless→bridge→Debug Skill
   - `opengame-cli.ts`：`listOpenGameCliInvocations` / `resolveOpenGameCliInvocation`
   - `qa:opengame-cli-live`：**qa-stub 模式** · 报告 `qa-output/opengame-cli-live/`
2. ✅ **Staging 复杂 prompt 抽测**
   - `qa:staging-complex-smoke`：STAGING 默认 Bench + 可选 HTTP Agentic SSE
   - 报告：`qa-output/staging-complex-smoke/REPORT.md`
3. ✅ **创作台封面 E2E**
   - `e2e/platform-create-auto-cover.smoke.spec.ts`：**1/1 PASS**（mock background + 封面缩略图）
4. **下一步**
   - 生产/staging 部署后 `OPERONE_STAGING=1` 实机跑 `qa:staging-complex-smoke`
   - 本机安装真实 `opengame` 后 `OPENGAME_CLI_ALLOW_STUB=0 qa:opengame-cli-live`

## 迭代一百零五

1. ✅ **Phase C PM 上架清单**
   - `qa:sample-launch-checklist`：**14/14**（封面 / 精灵 / 背景 / parity / hook）
   - 报告：`qa-output/sample-launch-checklist/REPORT.md`
   - 已接入 `qa:astrocade-pipeline` · `qa:pm-handtest-signoff`
2. ✅ **创作台 Brief 自动封面预览**
   - `CreateClient`：保存时并行等待 `background` API，消费 `coverPath` 并在预览区展示
3. ✅ **Comfy 精灵二阶段输出**
   - `GAME_SPRITE_OUTPUT_PX=512|1024`（默认 512）
   - `qa:sensory-pipeline-offline` · `qa:comfy-game-sprite` 扩展
4. **下一步**
   - 本机 `npm link opengame` → `qa:opengame-cli-live` 实机
   - staging `OPERONE_STAGING=1` + Comfy + Browser Bench 复杂 prompt 抽测
   - `platform-test-user` 创作台 `/zh-Hans/create?from=<id>` 肉眼验收

## 迭代一百零四

1. ✅ **Staging Browser Bench**
   - `browser-bench-env.ts`：`STAGING=1` 默认开启 bench + repair
   - 部署：`OPERONE_STAGING=1` 写入 `.env` · `.env.staging.example`
2. ✅ **Comfy 精灵 256→512** · **BGM 五槽** · **CLI live QA**
3. **下一步**：本机 `npm link opengame` 后 `qa:opengame-cli-live` 实机；staging 服务器 `OPERONE_STAGING=1` 部署抽测

## 迭代一百零三

1. ✅ **Phase D 视听管线**
   - `brief-visual-direction` + `runProjectAssetPipeline`
   - 并行精灵 · Brief 自动封面 · 核心 3 精灵试玩门槛
   - 模板 BGM 槽 `public/game-bgm/{template}-{profile}.ogg`
2. ✅ **三阶段缺口**
   - E2E Agentic：`e2e/platform-complex-agentic.smoke.spec.ts`
   - Phase C：`qa:sample-behavior-signoff`
   - pipeline：`qa:brief-asset-cohesion` · `qa:platform-test-generate`（RUN_LLM_QA）
3. **下一步**
   - staging `OPENGAME_BROWSER_BENCH=1`
   - OpenGame CLI 实机 · Comfy sprite workflow

## 迭代一百零二

1. ✅ **平台用户路径 QA**
   - `scripts/qa-platform-test-generate.ts` + `npm run qa:platform-test-generate`
   - ownerKey=`platform-test-user`：简单 dedicated + 复杂 Agentic 双用例入库
2. ✅ **入库 Agentic 保留修复**
   - 根因：`coerceGameSpec` 丢弃 `agenticModule` / `agenticPlayRoute`
   - 修复：`normalize-spec.ts` 透传 + `buildCanonicalAstrocadeSpec` 强化写回
   - `qa:agentic-persist-coerce` ✅
3. ✅ **验证**：platform-test-generate **2/2** · SSE 抽测 OK
4. **下一步**
   - staging `OPENGAME_BROWSER_BENCH=1`
   - OpenGame CLI headless + bridge 实机
   - 消消乐/神庙 Playwright 实机抽测

## 迭代一百零一

1. ✅ **Phaser.Scene CLI bridge**
   - `wrapPhaserSceneAsCreateGame`：OpenGame 常见 Scene 类产物 → Agentic 单文件
   - fixture `phaser-scene` + `qa:opengame-cli-bridge` **3/3** 策略
2. ✅ **P0 玩法 polish**
   - 消消乐：关间星星飞入顶栏（`playAnipopStarFlyIn`）
   - 神庙：死亡 3 秒结算倒计时 + 底栏提示 · `qa:temple-death-flow` ✅
3. **下一步**
   - 本机 OpenGame headless + bridge 端到端
   - staging `OPENGAME_BROWSER_BENCH=1`
   - 消消乐全关通关星星动画 · 神庙与 GamePlayerInner 实机抽测

## 迭代一百 · CLI→Agentic bridge ✅

1. ✅ **Phase B bridge 适配层**
   - `mergeOpenGameCliSources` + `bridgeOpenGameCliWorkDir`
   - helper 文件先于 entry 合并；strip import/export
   - `OPENGAME_CLI_BRIDGE=1`：CLI 成功后 Debug Skill 通过 → `opengame_cli` 源
2. ✅ **Fixtures + QA**
   - `scripts/fixtures/opengame-cli-bridge/`（native / multi-file）
   - `qa:opengame-cli-bridge` ✅ · astrocade-pipeline 已接入
3. **下一步**
   - 本机 OpenGame headless 实机 + bridge 端到端
   - Phaser.Scene 类产物桥接（当前仅 `createGame` 契约）
   - staging `OPENGAME_BROWSER_BENCH=1` · 消消乐/神庙 P0

## 迭代九十九 · Phase C 全量 hook + Phase B CLI spike ✅

1. ✅ **Phase C 收口**
   - 4 款棋类样品 hook：象棋 / 国际象棋 / 围棋 / 斗兽棋
   - `qa:sample-template-skill-parity` **14/14**（全部样品有 Scene hook 断言）
2. ✅ **Phase B CLI spike**
   - `opengame-cli.ts`：probe + headless spawn + dry-run
   - `OPENGAME_CLI=1` 复杂 prompt 写入 `opengame_cli_spike` trace（不替换 Agentic 模块）
   - `qa:opengame-cli-spike` ✅ · astrocade-pipeline 已接入
3. ✅ **验证**：opengame-skills ✅ · build ✅
4. **下一步**
   - 本机 `npm link` OpenGame 后 `OPENGAME_CLI=1` 实机 headless 抽测
   - CLI 产物 → Agentic 模块适配层（多文件 → 单文件 bridge）
   - staging `OPENGAME_BROWSER_BENCH=1` · 消消乐/神庙 P0 抽测

## 迭代九十八 · Phase C 扩展 + dedicated Debug lint ✅

1. ✅ **OpenGame 生成摘要**
   - `generation-trace.ts`：`summarizeOpenGameGeneration` / `buildOpenGameRecapFromTrace`
   - 创作台 debug 区 + SSE recap 展示 tier / Agentic / Browser Bench
2. ✅ **Phase C Template→样品**
   - `template-sample-parity.ts`：14 款 archetype 对照 QA
   - Scene hook 试点扩至 **10 款**（消消乐/2048/神庙/crashy/TD merge/农场/陶艺等）
3. ✅ **Phase A dedicated 门禁**
   - `lintDedicatedRouteDebugSkill`：简单 prompt 生成后对 Template fallback 跑 Debug Skill
4. ✅ **验证**
   - `qa:sample-template-skill-parity` **14/14** · `qa:opengame-skills` ✅ · build ✅
5. **下一步**
   - 剩余 4 款棋类样品 hook 清单；staging `OPENGAME_BROWSER_BENCH=1`
   - Phase B spike：OpenGame CLI 最小子进程调用
   - 消消乐过关动画 / 神庙死亡结算连贯抽测（迭代九十四 P0）

## 迭代九十七 · refine 路由重算 + 创作台试玩引擎提示 ✅

1. ✅ **refine / attach 路由重算**
   - `resolveAgenticPlayRoute({ respectPersisted: false })`：生成/refine 不被旧 `agenticPlayRoute` 锁死
   - dedicated 路由显式 `stripAgenticModuleForDedicatedRoute`
2. ✅ **创作台 SSE recap**
   - 生成完成展示 dedicated vs Agentic 试玩引擎（5 语言 i18n）
3. ✅ **refine API**
   - 响应增加 `agenticPlayRoute`
4. **下一步**
   - staging `OPENGAME_BROWSER_BENCH=1` 抽测；创作台 refine UI 展示路由徽章

## 迭代九十六 · OpenGame 试玩路由接入用户管线 ✅

1. ✅ **复杂 prompt → Agentic + OpenGame Skills**
   - `agenticPlayRoute` 写入 GameSpec；`resolveAgenticPlayRoute`（默认 `complex_only`）
   - `attachAgenticModuleIfEnabled` / `normalizeAstrocadePlaySpec` 对齐
2. ✅ **可选 Browser Bench 进生成管线**
   - `OPENGAME_BROWSER_BENCH=1` → `maybeVerifyAgenticModuleInBrowser`
3. ✅ **验证**
   - `qa:opengame-skills` ✅ · `qa:opengame-browser-bench` 2/2 ✅ · build ✅
4. **下一步**
   - refine regenerate 补跑 Creative Brief；staging 开 `OPENGAME_BROWSER_BENCH=1` 抽测

## 迭代九十五 · OpenGame Browser Bench 闭环 ✅

1. ✅ **Browser Bench 修复**
   - payload base64url 浏览器安全编解码（`browser-bench.ts`）
   - `AgenticBenchClient`：`getScenes(true)` 延迟探测 `AgenticScene`，消除误报
   - Shell 无效 payload → `data-testid="agentic-bench-error"`
2. ✅ **验证**
   - `qa:opengame-browser-bench` **2/2** ✅
   - `qa:opengame-skills` ✅ · `qa:agentic-template-matrix` **16/16** ✅
   - `qa:astrocade-pipeline` 已接入 browser bench
3. **下一步**
   - 可选：`OPENGAME_BROWSER_BENCH=1` 时生成管线追加浏览器验证
   - 消消乐过关动画 / 神庙死亡结算连贯抽测（迭代九十四 P0）

## 迭代九十四

1. ✅ **GitHub 提交**
   - `5460b16` feat(samples): 样品14款深化 + 消消乐HUD + 沉浸试玩与生产80端口
   - 514 files；已排除 `test-prod-login-password.py`、`upload-literary-samples-to-server.py`
2. ✅ **生产部署**
   - `deploy-prod-playability-fix.py` → `git reset --hard origin/main` @ `5460b16`
   - `PORT=80` · setcap · build ✅ · `curl /api/health` → 200
   - 访问：`http://operone.1oneclaw.com`
3. **验收建议**
   - `/zh-Hans/create` 创作台（勿用 `:6666`）
   - `/play/sample-color-bloom` 消消乐 HUD + 三关
   - 样品馆沉浸试玩（无全屏/重开按钮）

## 迭代九十三

1. ✅ **消消乐顶栏 HUD 合并**
   - `drawAnipopTopBar` 单行：关卡 | 三目标牌（得分/破冰/小鸡）| 步数
   - 去掉重复进度条、y=52 金线、中央飘分数字
   - 操作提示移到道具栏上方并加半透明底；道具栏去掉穿按钮金线
   - 棋盘上移 `oy 118→88`
2. ✅ **全局关闭相机背景抖动**
   - `gameJuice.juiceShake` 改为 no-op（保留粒子/闪白/飘字）
3. ✅ **验证**
   - build ✅ · `qa:juice-quality-tier` ✅ · `qa:juice-semantic-presets` ✅

## 迭代九十二

1. ✅ **开心消消乐三关递进**
   - `ANIPOP_LEVEL_CONFIGS` 三档目标（得分/小鸡/破冰/步数递增）
   - 过关后自动进下一关；全关通关 banner；二/三关奖励道具
   - 胜利条件补齐：得分 + 小鸡 + 破冰三目标同时达成
   - `puzzle-blueprint` `levelCount: 3`
2. ✅ **样品 DB 清理**
   - `PRUNED_SAMPLE_IDS` + `seedSampleGalleryProjects` 删除下架 project
3. ✅ **杂项**
   - `CoasterScene` 移除 `rail-in-air` richVisuals 残留
   - 文档样品数 23→14
4. ✅ **验证**
   - build ✅ · seed + db-sync **14/14** ✅ · gameplay **14/14** ✅

## 迭代九十一

1. ✅ **样品馆商业标准裁剪**
   - 删除 9 款薄 demo / 重复 SKU：`ultimate-3d-chess`、`rail-in-air`、`whimsy-differences`、`memory-match-mania`、`kids-puzzle`、`car-color-palette`、`state-conquest`、`tiny-planet-chopper`、`blocky-sniper-hunter`
   - 保留 **14 款**：棋盘五款 + 2048 + 神庙 + 消消乐 + Crashy/Smash/Garden/Gun Merge/Elastic Thief/Blade Defender/Pottery
   - 同步 `samples.ts`、registry、QA、infer、封面脚本；删除对应封面 PNG 与 `e2e/sample-rail-en` / `qa-tiny-planet-parity-smoke`
   - 决策记入 `PROJECT_MEMORY/DECISIONS.md`
2. ✅ **验证**
   - build ✅ · offline clone **14/14** ✅ · gameplay **14/14** ✅ · sample-profiles ✅

## 迭代九十

1. ✅ **冰块下特殊块可见性**
   - `drawAnipopIcedSpecialGlow` 金色外圈穿透冰层；特殊标记 `underIce` 加粗高亮
   - 炸弹特殊块补绘橙色辐射图案
   - 点击冰封特殊块提示「先破冰，再激活特殊块」
   - 宝石贴图 depth 6 / 冰层+标记 depth 10 分层
2. ✅ **神庙死亡区域可读性**
   - 死亡遮罩改为上 48% 深压 + 中段轻压，跑者区域更清晰
   - 死亡时同步隐藏 `goalPanel`
3. ✅ **color-bloom 封面重截**
   - `capture:sample-covers` 专用预热（棋盘交换点击）→ `public/samples/color-bloom.png`
4. ✅ **验证**
   - build ✅ · gameplay **23/23** ✅ · 封面截图 ✅

## 迭代八十九

1. ✅ **开心消消乐动物宝石贴图**
   - `npm run generate:anipop-gem-atlas` → `public/game-sprites/sample-color-bloom/anipop-gems-v1.png`（5 种动物 64×64）
   - `anipop-gem-atlas.ts` spritesheet 加载；有图集时用 Image 渲染，无图集回退程序化绘制
2. ✅ **特殊块 × 冰块边界**
   - 四连/五连 spawn 优先非冰块格；锤子击中特殊块会引爆（行/列/炸弹/彩虹）
3. ✅ **神庙死亡 HUD 叠层修复**
   - 死亡时隐藏顶栏分数/金币/连击/提示/本地榜；摘要面板上移至 banner 上方（`h - panelH - 108`）
   - 重开时恢复 live HUD
4. ✅ **验证**
   - build ✅ · gameplay **23/23** ✅

## 迭代八十八

1. ✅ **开心消消乐特殊块真正可玩**
   - 四连/五连生成特殊块并**保留在棋盘**（spawn 格免清）
   - 匹配含特殊块时自动引爆：行消 / 列消 / 炸弹 / 彩虹同色清场
   - 与相邻宝石**交换特殊块**即可手动激活；双特殊组合额外 3×3
   - 下落时特殊块随宝石列堆叠；`collapseMatch3` 同步搬运 `match3Specials`
2. ✅ **破冰目标牌**
   - 顶栏三牌：得分 / 破冰 / 小鸡；破冰计数随冰块完全消除递增
3. ✅ **神庙里程碑降噪**
   - 里程飘字改为 400m 步长、仅偶数里程碑显示、灰色弱提示、去掉音效
   - 金币连击飘字仅 x5/x8；震动减弱
4. ✅ **验证**
   - build ✅ · color-bloom + temple QA **2/2** ✅ · match3-commercial-runtime ✅

## 迭代八十七

1. ✅ **开心消消乐（color-bloom）玩法深化**
   - **冰块障碍**：开局 10 格；匹配先破冰、邻格震裂；冰冻格不可选/不可交换
   - **底部道具栏**：锤子（点格消除+连锁）、重排、+5 步；次数扣减与武装态
   - **三星评价**：过关 banner 按分数倍率 1/2/3 星
   - `addMove` 在 anipop 模式走双目标 `checkAnipopWin`（步数耗尽不误杀）
2. ✅ **神庙逃亡死亡可读性**
   - `drawTempleDeathDim` 远景遮罩；障碍预警深度收窄 `0.38–0.55`
   - `HudBanner` 支持 `anchor: "bottom"`
3. ✅ **验证**
   - build ✅ · gameplay **23/23** ✅

## 迭代八十六

1. ✅ **神庙逃亡可读性再收紧**
   - 死亡 banner 移到底部；死亡时隐藏顶栏 HUD / 跑道 shader / 装饰粒子
   - 车道虚线、石板色、边线对比度加强
2. ✅ **开心消消乐（color-bloom）深化**
   - 交换三消 **连锁消除**（`resolveMatch3Cascade`）
   - 开局无自动三消 + 中心可一步教学局
   - 棋盘格底纹、木质目标牌（得分/小鸡）、特殊块标记
   - 双目标胜利：得分 ≥1200 且收集小鸡 ≥14；步数耗尽判负
3. ✅ **验证**
   - build ✅ · gameplay **23/23** ✅

## 下一步（P0）

- 消消乐：过关动画/星星飞入；样品馆 `photoCover` 肉眼验收新封面
- 神庙：死亡 3 秒结算流程与 `GamePlayerInner` 结算层连贯抽测

## 迭代八十五

1. ✅ **神庙/crashy 死亡回放摘要**
   - 局内死亡等待期显示摘要面板（距离/金币/连击/存活/死因/与最佳对比）
   - `runnerRecap` 经 `EndPayload` 传到 `GamePlayerInner` 结算层
2. ✅ **样品馆云端排行榜 API**
   - `GET/POST /api/samples/runner-leaderboard`（`.data/runner-leaderboards/` 文件存储 Top10）
   - 结算时自动提交并展示「样品馆榜」Top5 + 云端排名
3. ✅ **验证**
   - build ✅ · board-showcase ✅ · gameplay **23/23** ✅

## 迭代八十四

1. ✅ **波次随里程提速**（`wavePaceScale`）
   - 跑越远：波次冷却越短、障碍略提前出现、同屏上限 +1、滚动加速
2. ✅ **crashy 撞车无敌帧**
   - 撞车后 1.25s 无敌 + 车辆闪光；扣命后 banner 提示；无敌期免二次碰撞
3. ✅ **神庙/combo 本地排行榜**
   - `runner-leaderboard.ts` localStorage Top5（得分/连击/距离）
   - 局内右上角「本地榜」Top3；结算层 `GamePlayerInner` 完整榜单 + 新纪录 + 排名
4. ✅ **验证**
   - build ✅ · board-showcase ✅ · gameplay **23/23** ✅

## 迭代八十三

1. ✅ **神庙障碍波次套路**（`temple-run-patterns.ts`）
   - 10 组固定节奏波次（单障教学 → 双障 zigzag → 横梁/三车道压境 → 金币喘息）
   - `spawnTemplePatternWave` + `resolvePatternLane` 替代纯随机单发
2. ✅ **连击奖励 UI**
   - `drawTempleComboBadge` + 顶栏 `连击 xN` 文案；x3/x5/x8 里程碑飘字 + 加分
3. ✅ **crashy-roads 抛光**（`crashy-road-patterns.ts` / `crashy-road-visual.ts`）
   - 8 组波次（路障/残骸/锥桶/双障/之字/喘息）
   - 夜景透视车道、三种障碍造型、生命 HUD、远处预警框
   - 滑动手势换道、擦边连击加分 + `drawCrashyDodgeCombo` 徽章
   - 得分 = 距离×10 + 擦边奖励
4. ✅ **验证**
   - build ✅ · board-showcase ✅ · gameplay **23/23** ✅

## 迭代八十二

1. ✅ **神庙可玩性深化**
   - `pickTempleObstacleLane`：避免同屏堵死三车道，前期侧道教学，优先非当前道
   - 远处障碍 `drawTempleObstacleTelegraph`（车道色带 + 跳/铲图标）
   - 首次滚石/断柱/横梁 banner 教学；底部 hint 随逼近障碍动态切换
   - 弯道 QTE 时 `templeCurveBias` 与视觉弯道同步
2. ✅ **画面与手感**
   - 跑者地面阴影 `drawTempleRunnerShadow`；跳起尘土 + 轻震；滑铲略延长
   - 金币优先刷在安全车道
3. ✅ **验证**
   - build ✅ · board-showcase ✅ · gameplay **23/23** ✅

## 迭代八十一

1. ✅ **神庙逃亡画质重叠修复**
   - 统一顶栏 HUD（追兵条 / 得分 / 金币单行），隐藏 goalPanel，banner 1.6s 自动收起 + `banner.tick()`
   - 追兵独立 `chaserGfx`（depth 4.5）锚定跑者脚后，不再与精灵重叠
   - 移除车道柔光叠层、降低跑道 shader 强度（ADD→NORMAL，alpha 0.55→0.28）
   - 障碍/金币按深度排序绘制；弯道提示移至画面上方侧栏
   - 金币飘字改在跑者头顶，不再压 HUD
2. ✅ **可玩性调优**
   - 追兵压力增速放缓（0.013→0.0075），吃金币减压加大
   - 障碍生成延后（3.5s 热身）、间距拉大、碰撞窗口略放宽
   - 换道响应加快（lane lerp×18）、弯道 QTE 时限 2.05s、12s 后触发
3. ✅ **验证**
   - build ✅ · gameplay **23/23** ✅ · board-showcase ✅

## 迭代八十

1. ✅ **围棋提子 / 气 / 打劫**（`ChessScene.ts`）
   - `goSimulatePlay` / `goRemoveDeadGroups` / `goKoBan`
   - 自杀禁入、打劫禁回提；提子 banner + 计分 HUD
   - 空盘开局 + 天元 QA 点击提示
2. ✅ **神庙外部 sprite sheet**
   - `npm run generate:temple-runner-atlas` → `public/game-sprites/.../temple-runner-v7.png`（912×96）
   - `registerTempleRunnerAtlasLoader` + `CoasterScene.preload`；无图集时回退 v6 程序化纹理
3. ✅ **ops-health 三轨快照**
   - `npm run qa:ops-health-snapshots`（board + admin + play + db-sync）
   - 已刷新 `.qa-cache/` 三轨 JSON；后台 ops-health **overall=ok snapshots=3**
4. ✅ **验证**
   - build ✅ · gameplay **23/23** ✅ · seed **23** ✅

## 迭代七十九

1. ✅ **23 款样品实机封面 PNG**
   - `capture:sample-covers:all` / `:astrocade` 脚本；预热逻辑复用 gameplay QA 用例
   - `samples.ts` 全部改为 `/samples/{id}.png`（告别 astrocade webp/jpg）
   - 实跑截图 **23/23** 写入 `public/samples/`
2. ✅ **斗兽棋地形规则**（`ChessScene.ts`）
   - 河流：仅鼠可入；狮虎中央列跳河
   - 兽穴禁入；陷阱弱化攻防
3. ✅ **围棋开局**：`buildGoPieces` 随棋盘尺寸自适应落子
4. ✅ **验证**
   - build ✅ · board-showcase ✅ · gameplay **23/23** ✅
   - `seed:samples` **23 projects** ✅

## 迭代七十八

1. ✅ **国际象棋将军 / 应将 / 将死**
   - `intlPseudoMoves` / `intlApplyMove`（兵升后）
   - `intlInCheck` / `intlLegalMovesFiltered` 过滤自将
   - 与象棋共用 `afterMoveStatus` / `finishCheckmate` / `checkTarget` 高亮
   - 黑方 AI 仅合法应将着，优先吃王
2. ✅ **神庙死亡结算**（`CoasterScene.ts`）
   - 撞车/被追上后 3 秒内可重开，否则 `onEnd` 回传 `templeRunScore`
   - `finish()` 神庙模式用 `templeRunScore` 计分
   - 死亡 banner 提示「3 秒后结算」
3. ✅ **验证**
   - build ✅ · board-showcase QA ✅ · gameplay **23/23** ✅

## 迭代七十七

**今日复盘范围**：象棋 / 神庙 / 2048 / 围棋·斗兽棋·国际象棋演示 / 全量 23 款 QA

### 已优化

| 游戏 | 改动 |
|------|------|
| **中国象棋** | 将死横幅按胜负切换；困毙改 `finish(false)`；将军高亮将/帅红圈；黑方应将状态文案；去掉每帧 QA 重算 |
| **神庙逃亡** | QTE 边界车道可按对方向应；跳起可躲石头；无敌期不记擦边追兵；死亡写入 QA 分数；尘土粒子降频；追兵条图标；QTE 紧急闪红 |
| **2048** | 触控改为滑动手势（非恒向右）；无路可走 Game Over；取消步数上限误杀 |
| **围棋/斗兽棋** | 开局标注「演示模式」避免用户按正式规则误解 |

### 验证
- `npm run build` ✅
- `qa:board-showcase-samples` ✅
- 全量 `qa:sample-gameplay-interaction` **23/23** ✅

### 已知限制（未改，属演示级）
- 围棋/斗兽棋/国际象棋：非完整竞技规则（样品定位）
- 神庙：死亡后场内重开，不立即 `onEnd`（街机循环）

---

更新时间：**2026-06-17**（迭代七十六 · 象棋将军/应将/将死完整链路 ✅）

## 迭代七十六

1. ✅ **中国象棋将军 / 应将 / 将死**（`ChessScene.ts`）
   - `xiangqiPseudoMoves` + `xiangqiApplyMove` 局面模拟
   - `xiangqiIsSquareAttacked` / `xiangqiInCheck` / `xiangqiLegalMovesFiltered` 过滤自将
   - 走子后 `xiangqiAfterMoveStatus`：将军 banner + 震动音效；将死 / 困毙终局
   - 红方被将军时状态栏「⚠ 你被将军！必须应将」
   - 黑方 AI 仅选合法应将着（优先吃帅）
   - QA 状态暴露 `inCheck` / `redInCheck` / `blackInCheck`
2. ✅ **验证**
   - `npm run build` ✅
   - `qa:board-showcase-samples` ✅（含将军/将死源码断言）
   - `SAMPLE_AUDIT_IDS=classic-xiangqi-board` gameplay QA **1/1** ✅

## 迭代七十五

1. ✅ **中国象棋规则对齐**（参照 `Chinese_Chess.md`）
   - 黑方用 象/士/将；红方 相/仕/帅
   - 马：蹩马腿；象：塞象眼 + 不过河
   - 炮：走法如车，吃子必须隔一子（炮架）
   - 兵/卒：过河前只进，过河后可横走
   - 将帅九宫 + 白脸将（同线无子不可照面）
2. ✅ **神庙跑者 v6**
   - 12 帧、探险帽、火把、腰带；纹理 76×96
3. ✅ **封面批量**
   - `npm run capture:sample-covers:arcade` → crashy/rail/smash/garden/bloom PNG
   - smash/rail/crashy 样品元数据改指向 `/samples/*.png`
4. ✅ **验证**
   - build ✅ · qa:board-showcase-samples ✅

---

更新时间：**2026-06-17**（迭代七十四 · 追兵机制 + 弯道 QTE ✅）

## 迭代七十四（当前）

1. ✅ **追兵压力机制**
   - 左下逼近条随时间上涨；吃金币 −、擦边 +
   - 满条触发「被追上了」Game Over（独立于撞障碍）
   - 猴群视觉随压力靠近；高压力红色 vignette
2. ✅ **弯道 QTE**
   - 16s 后每 ~11–18s 提示 A/← 或 D/→ 漂移
   - 成功 +45 分并降低追兵条；失误追兵条 +20%
3. ✅ **验证**
   - build ✅ · 神庙 QA ✅

## 迭代七十三

**神庙逃亡可玩性评估**：核心循环已完整，**已达可玩样品标准**。

---

更新时间：**2026-06-17**（迭代七十二 · 首页样品精选 + 封面截图 ✅）

## 迭代七十二（当前）

1. ✅ **首页样品馆精选区**
   - `FeaturedSamplesSection`：6 款 featured 竖版封面 + 链到 `/samples`
   - 置于社区热门游戏之前；5 语言 i18n
2. ✅ **封面刷新（6/6 PNG）**
   - 清除 `SAMPLE_COVER_IDS` 后 `capture:sample-covers` 完成 6 款核心样品
   - 2048 / 象棋 / 围棋 / 动物棋 / 神庙 → `public/samples/*.png`
3. ✅ **验证**
   - build ✅ · qa:board-showcase-samples ✅
4. ⬜ **下一步**
   - 专业跑者 sprite sheet；Astrocade 样品封面批量截图；生产 seed

---

更新时间：**2026-06-17**（迭代七十一 · discover 样品馆入口 + 全量 QA 23/23 ✅）

## 迭代七十一

1. ✅ **发现页 → 样品馆**
   - `/discover` 顶栏与空状态增加「样品馆试玩」（复用 `lists.browseSampleGallery`）
2. ✅ **全量试玩 QA**
   - `Remove-Item Env:SAMPLE_AUDIT_IDS` 后 `qa:sample-gameplay-interaction` **23/23**
   - 神庙/枪战合并各 retry 1 次后通过
3. ✅ **三轨快照全绿**
   - admin-smoke 32/32 · sample-play 23/23 · sample-db-sync 23/23
4. ⬜ **下一步**（见迭代七十二）

---

更新时间：**2026-06-17**（迭代七十 · 游戏广场入口 + 生产 seed 文档 + QA 快照链 ✅）

## 迭代七十

1. ✅ **游戏广场 → 样品馆**
   - `/games` 增加「样品馆试玩」入口；空状态也可跳转
2. ✅ **生产运维文档**
   - `deploy-linux-ubuntu22.md` / `admin-console.md` 补充 seed、对账、后台同步说明
3. ✅ **QA 快照链**
   - `qa:sample-gallery-db-sync` → `.qa-cache/sample-db-sync.json`
   - ops-health 展示 DB 对账快照（三轨：admin / 试玩 / DB）
4. ✅ **全量试玩 QA**（见迭代七十一）
5. ✅ **验证**
   - build ✅ · qa:sample-gallery-db-sync 23/23 ✅

---

更新时间：**2026-06-17**（迭代六十九 · 跑者 v5 + 样品 QA 快照 ✅）

## 迭代六十九（当前）

1. ✅ **神庙跑者 v5 Explorer 精灵**
   - 10 帧跑步、背包/头巾/飘带、72×92 纹理；跳跃/滑铲/ lean 姿态
2. ✅ **QA 快照扩展**
   - `qa:sample-gameplay-interaction` → `.qa-cache/sample-play.json`
   - ops-health 展示 admin + 样品试玩双快照，失败 sampleId 提示
3. ✅ **验证**
   - build ✅ · qa:board-showcase-samples ✅ · qa:admin-console ✅
4. ⬜ **下一步**
   - 跑全量 `qa:sample-gameplay-interaction` 刷新快照；生产 seed

---

更新时间：**2026-06-17**（迭代六十八 · 神庙 WebGL + 样品馆搜索 + QA 快照 ✅）

## 迭代六十八（当前）

1. ✅ **神庙 WebGL 透视光晕**
   - `temple-run-road-shader.ts`：Phaser 4 Shader ADD 叠层，随弯道/滚动更新 uniform
   - CoasterScene 神庙模式接入 + shutdown 清理
2. ✅ **样品馆 UX**
   - `/samples` 搜索框、数量统计、失败重试
3. ✅ **运营健康 QA 快照**
   - `qa:admin-console` 写入 `.qa-cache/admin-smoke.json`
   - ops-health 展示最近 smoke 结果与过期提示
4. ✅ **验证**
   - build ✅ · qa:admin-console ✅ · qa:board-showcase-samples ✅
5. ⬜ **下一步**
   - 专业跑者 sprite sheet；生产 seed 后验收 `/samples`

---

更新时间：**2026-06-17**（迭代六十七 · 运营健康 + 作品封面 + 样品批量 ✅）

## 迭代六十七（当前）

1. ✅ **概览「系统健康」面板**
   - `GET /api/admin/ops-health`：DB、邮件、样品同步/封面、待审队列
   - QA 命令参考 + 一键跳转样品馆/待审
2. ✅ **作品治理封面列**
   - 游戏/小说/漫画 `coverPath` 缩略图预览
3. ✅ **样品馆批量精选**
   - 多选 + `PATCH projectIds[]` 批量 feature/unfeature
4. ✅ **验证**
   - build ✅ · qa:admin-console 33/33 ✅
5. ⬜ **下一步**
   - WebGL 透视跑道；生产 seed 后肉眼验收 `/samples`

---

更新时间：**2026-06-17**（迭代六十六 · 后台样品馆管理 ✅）

## 迭代六十六（当前）

1. ✅ **后台「样品馆」Tab**
   - `GET/PATCH/POST /api/admin/samples`：目录↔DB 对账、一键同步、精选切换
   - `SampleGalleryPanel`：封面预览、试玩链接、未同步/缺封面筛选
2. ✅ **概览运营快捷入口**
   - KPI「样品馆同步」+ 待审/样品馆/公开页快捷按钮
3. ✅ **作品治理增强**
   - 游戏「试玩」链接；「复制到样品馆」i18n（5 语言）
4. ✅ **验证**
   - build ✅ · qa:admin-console 30/30 ✅（含 admin samples API）
5. ⬜ **下一步**
   - 生产 `seed:samples`；可选 QA 健康面板；WebGL 透视跑道

---

更新时间：**2026-06-17**（迭代六十五 · 神庙玩法深度 + 视差氛围 ✅）

## 迭代六十五（当前）

1. ✅ **神庙玩法深度**
   - 擦边 near-miss 反馈（「擦边!/Near!」+ 轻震）
   - 金币连击 streak（≥3 显示 xN，额外加分 `templeCoinBonus`）
2. ✅ **神庙 v6 氛围**
   - 垂坠藤蔓视差、萤火虫粒子、当前车道柔光高亮
3. ✅ **验证**
   - build ✅ · board QA ✅ · 神庙互动 QA ✅ · 封面重截 ✅ · seed 23
4. ⬜ **下一步**
   - 生产 seed；Phaser Shader 透视跑道（WebGL）或专业 sprite sheet

---

更新时间：**2026-06-17**（迭代六十四 · 目标引导 + 神庙 v5 ✅）

## 迭代六十四（当前）

1. ✅ **CoasterScene 目标引导**
   - 接入 `HudGoalPanel` + `buildSceneGoalGuidance`；`racing/coaster` 模板含神庙/endless 专属文案。
2. ✅ **神庙 v5 视觉**
   - 透视车道虚线滚动；金币 spin 动画；追兵改为猿猴剪影（伸臂追逐）。
3. ✅ **QA 扩展**
   - `qa:hud-goal-panel` / `qa:scene-goal-guidance` 覆盖 CoasterScene。
4. ✅ **验证**
   - build ✅ · board QA ✅ · 神庙互动 QA ✅ · 封面重截 ✅
5. ⬜ **下一步**
   - 生产 `seed:samples`；WebGL 透视网格或专业跑者 sprite sheet。

---

更新时间：**2026-06-17**（迭代六十三 · 样品馆卡片 + 神庙 v4 + 封面全量刷新 ✅）

## 迭代六十三（当前）

1. ✅ **样品馆卡片 UX**
   - 6 款棋盘/益智/神庙样品加 `photoCover: true`：封面不再叠 emoji/标题，标题移到卡片下方（与 Astrocade 样品一致）。
2. ✅ **神庙 v4 视觉**
   - 两侧远景残柱 `drawTempleSideRuins`、金色夕阳 vignette、跑者脚下尘土粒子。
   - 跑者 v4 精灵（背包+头巾）；弯道 lean/bank；金币可 3 枚一串生成。
3. ✅ **封面全量刷新**
   - `capture:sample-covers` 增强棋盘/2048 预热交互；6 款 PNG 全部重截。
4. ✅ **验证**
   - `qa:sample-gameplay-interaction` **23/23** ✅
   - `qa:board-showcase-samples` ✅（含 photoCover + v4 contract）
   - `seed:samples` 23 · `npm run build` ✅
5. ⬜ **下一步**
   - 部署生产 `npm run seed:samples`；肉眼检查 `/samples` 与 `/games?sort=latest` 前 6 卡封面。
   - 商业级 Temple Run 仍缺专业美术/WebGL。

---

更新时间：**2026-06-17**（迭代六十二 · seed + 封面 + 神庙手感 polish ✅）

## 迭代六十二（当前）

1. ✅ **神庙手感 polish**
   - 得分 `scorePopT` 脉冲；捡金币 `camPulseT` 轻微 zoom；弯道幅度/频率加强。
2. ✅ **样品封面工具**
   - 新增 `npm run capture:sample-covers`（Playwright 截 canvas → `public/samples/*.png`）。
   - 已重生成 `temple-relic-runner.png`（v3 水域/分数面板/弯道）。
3. ✅ **DB 与门禁**
   - `npm run seed:samples` → **23 projects**
   - `qa:sample-gallery-db-sync` **23/23** ✅
   - `qa:board-showcase-samples` 增加 v3 contract（水域/分数面板/相机脉冲）
   - `npm run build` ✅ · 神庙互动 QA ✅
4. ⬜ **下一步**
   - 部署生产后 `npm run seed:samples` 或访问 `/samples` ensure。
   - 商业级 3D 仍缺专业 sprite sheet / WebGL 网格。

---

更新时间：**2026-06-17**（迭代六十一 · QA 闭环 + 神庙 v3 视觉 ✅）

## 迭代六十一（当前）

1. ✅ **修复 2 个旧 QA 失败样品**
   - `color-bloom`：`PuzzleScene` flood 消除补 `addMove()`；开局中心 4 连块保证一点即消。
   - `gun-merge-3d-zombie-apocalypse`：合成成功加 `juiceShake`/`juiceFlash` + 额外 `bumpQaTouch`。
2. ✅ **神庙 v3 视觉**
   - `temple-run-visual.ts`：跑道两侧暗水/深渊 `drawTempleWaterMoat`；顶部石质分数面板 `drawTempleScorePanel`。
   - `CoasterScene.drawTempleRunFrame` 接入分数面板（`templeRunScore` + 金币 pop 脉冲）。
3. ✅ **验证**
   - `npm run qa:sample-gameplay-interaction` **23/23** ✅（含 color-bloom、gun-merge）
   - `npm run qa:board-showcase-samples` ✅
   - `npm run build` ✅
4. ⬜ **下一步**
   - 生产 `npm run seed:samples` 确认 23 样品。
   - 神庙仍非商业级 3D：可选 WebGL 网格或专业 sprite sheet；封面 PNG 可随 v3 重生成。

---

更新时间：**2026-06-17**（迭代六十 · 神庙重做 + 统一 WASD/鼠标 ✅）

## 迭代六十

1. ✅ **神庙可玩性根因修复**
   - 梯形收敛透视跑道（非平行竖条）→ `temple-run-visual.ts`。
   - 开局 2.6s 无敌；同时仅 1 障碍；1 命撞停 + Space/点击原地重开；无尽模式。
   - 8 帧跑者 + jump/slide/lean 姿态；速度线、追兵剪影、金币 HUD 动效。
2. ✅ **统一输入 `phaser-input.ts`**
   - 全局 WASD+方向键+Space+Shift；Play/Shooter/Platformer/Coaster 全接 WASD+鼠标。
   - 跑酷：A/D 换道、W 跳、S 滑铲、鼠标点按/滑动。
3. ✅ **验证**：build ✅、神庙互动 QA ✅、`qa:board-showcase-samples` ✅。

---

更新时间：**2026-06-17**（迭代五十九 · 神庙逃亡 v2 机制 ✅）

## 迭代五十九（当前）

1. ✅ **神庙逃亡 v2 玩法**
   - 金币拾取：`roadPickups` + `drawTempleCoin`，`coasterCoins` 写入 QA 状态。
   - 跳跃 / 滑铲：↑/W/空格跳、↓/S 滑；低障碍 `pillar` 需跳、高障碍 `beam` 需滑、滚石 `rock` 需换道。
   - 弯道透视：`laneCenterX` + `roadCurvePhase` 正弦偏移车道。
   - 跑者动画：`runAnimPhase` 摆腿；跳/滑姿态区分。
   - HUD：`hudTempleRunControls` / `hudTempleRunScore`（五语系 i18n）。
   - 结算：金币 ×50 加分，神庙专属 banner 文案。
2. ✅ **验证**
   - `npm run qa:board-showcase-samples` ✅（含 v2 contract 断言）
   - `SAMPLE_AUDIT_IDS=temple-relic-runner npm run qa:sample-gameplay-interaction` ✅
   - `npm run build` ✅
3. ⬜ **下一步**
   - 商业级仍缺：精灵帧动画、连续弯道手感调优、失败即时重开、更强 3D 透视与金币 UI 动效。
   - 生产 `npm run seed:samples` 确认 23 样品。

---

更新时间：**2026-06-17**（迭代五十八 · 六款小游戏真实试玩 + 神庙逃亡样品 ✅）

## 迭代五十八

1. ✅ **真实试玩复核**
   - `qa:sample-gameplay-interaction` 聚焦 5 款：2048 / 中国象棋 / 国际象棋 / 围棋 / 斗兽棋 **5/5 PASS**。
   - Playwright canvas 截图复核：
     - 2048：可滑动合成，分数/最大数字变化。
     - 围棋：19x19 棋盘、棋子足够大，落子后 pieceCount 增长。
     - 斗兽棋：动物 icon + 标签 + 陷阱/河流/兽穴可辨。
     - 中国象棋：已从普通格子棋盘改为真实线盘、楚河汉界、宫格斜线、红黑圆棋子。
     - 国际象棋：已补全 32 子和基础后排/兵走法。
2. ✅ **神庙逃亡样品**
   - 新增 `temple-relic-runner`：`racing` → `CoasterScene` → `endlessRoad`。
   - 视觉：丛林/遗迹/石门、三条石板路、跑者 stick avatar、滚石/石柱障碍。
   - 操作：左右键 / A-D / 点击左右半屏换道。
   - 封面：`public/samples/temple-relic-runner.png`。
3. ✅ **验证**
   - `npm run qa:board-showcase-samples` ✅
   - `npm run seed:samples` ✅（23 projects）
   - `npm run qa:sample-gallery-db-sync` ✅（23/23）
   - `SAMPLE_AUDIT_IDS=temple-relic-runner npm run qa:sample-gameplay-interaction` ✅（1/1，首轮 retry 后通过）
   - `SAMPLE_AUDIT_IDS=number-merge-2048,classic-xiangqi-board,classic-international-chess,zen-go-board,jungle-animal-chess,temple-relic-runner npm run qa:sample-gameplay-interaction` ✅（6/6）
   - 神庙 runner 截图状态：`coasterDistance` 7 → 14，`coasterLives` 3。
   - `npm run build` ✅
   - Edited-file lints：无错误
4. ⬜ **下一步**
   - 如继续提升神庙逃亡质量：补金币拾取、跳跃/滑铲、连续弯道、角色动画帧、碰撞失败重开和更强 3D 透视。
   - 部署生产后执行 `npm run seed:samples`，确认生产 DB 也为 23 个样品。

---

更新时间：**2026-06-17**（迭代五十七 · 五款棋盘/益智样品可见 + 封面/围棋/抖动修复 ✅）

## 迭代五十七（当前）

1. ✅ **补齐用户要求的 5 款可见样品**
   - 新增 `classic-xiangqi-board`（Chinese Xiangqi，中国象棋）和 `classic-international-chess`（International Chess，国际象棋）。
   - 本地 DB 已 `npm run seed:samples`：`seed-sample-gallery: ok 22 projects`。
   - DB 最新 5 条已确认：International Chess、Chinese Xiangqi、Jungle Animal Chess、Zen Go Board、2048 Neon Merge。
2. ✅ **修复游戏广场封面**
   - 五款棋盘/益智样品改用 PNG 封面：
     - `/samples/number-merge-2048.png`
     - `/samples/classic-xiangqi-board.png`
     - `/samples/classic-international-chess.png`
     - `/samples/zen-go-board.png`
     - `/samples/jungle-animal-chess.png`
   - `qa:board-showcase-samples` 强制检查 PNG 文件存在，防止再出现破图/空白。
3. ✅ **修复围棋棋子过小**
   - `ChessScene` 新增 `drawGoStone()`，Go 棋子改为图形大圆盘（半径 `cell * 0.43`）+ 高光 + 阴影，不再依赖小号文本符号。
4. ✅ **修复 2048 背景抖动**
   - 2048 每次移动不再调用 `juiceCombo()`，避免 camera shake；保留局部 `juiceBurst()` 和音效反馈。
5. ✅ **验证**
   - `npm run qa:board-showcase-samples` ✅
   - `npm run qa:sample-gallery-db-sync` ✅（22/22）
   - `npm run seed:samples` ✅（22 projects）
   - `npm run build` ✅
   - Edited-file lints：无错误
   - `qa:sample-gameplay-interaction`：本次相关 5 款全部 ✅；全量 22 款仍有 2 个旧样品失败（`color-bloom` depth、`gun-merge-3d-zombie-apocalypse` interaction diff）。
6. ⬜ **下一步**
   - 若要继续推进质量闭环，优先修 `qa:sample-gameplay-interaction` 中两个旧样品失败。
   - 部署后在生产执行 `npm run seed:samples` 或访问 `/samples` 触发 ensure，确认生产 DB 也为 22 个样品。
   - 在 `/games?sort=latest` 肉眼检查前 5 个卡片封面是否加载为 PNG。

---

更新时间：**2026-06-17**（迭代五十六 · 斗兽棋棋子可读性修复 ✅）

## 迭代五十六（当前）

1. ✅ **斗兽棋棋子图标化**
   - `ChessScene` 中 `ruleset === "jungle"` 的棋子从纯汉字改成“动物 emoji 图标 + 汉字标签”。
   - 每个斗兽棋棋子先绘制高对比圆形底：红方浅底红边、蓝方深底深边，避免文字和棋盘/河流/陷阱混色。
2. ✅ **防回退 QA**
   - `qa:board-showcase-samples` 新增断言：
     - 必须有 `jungleAnimalIcon()`。
     - 必须有 `junglePieceText()`。
     - 必须绘制 `fillCircle(cx, cy, this.cell * 0.38)` 作为棋子底。
3. ✅ **验证**
   - `npm run qa:board-showcase-samples` ✅
   - `SAMPLE_AUDIT_IDS=jungle-animal-chess PLAYWRIGHT_BASE_URL=http://127.0.0.1:8888 npm run qa:sample-gameplay-interaction` ✅ **1/1**
   - `npm run build` ✅
   - Edited-file lints：无错误
4. ⬜ **下一步**
   - 肉眼再看斗兽棋截图，如果 emoji 字体在目标设备表现不稳定，可进一步替换为本地 SVG/PNG 动物 icon 资产。

---

更新时间：**2026-06-17**（迭代五十五 · 样品馆真实可见与控制台复制 ✅）

## 迭代五十五（当前）

1. ✅ **回答“为什么看不到”**
   - 根因：上一轮只新增了代码里的 `SAMPLES`、运行时和离线 QA；真实 `/games` / `/samples` 依赖数据库 `Project`。
   - 另外 `/api/samples/ensure` 原先只按数量判断，数量够时不会刷新已有 DB 样品，代码变更可能不落库。
2. ✅ **样品馆改为 DB catalog**
   - 新增 `/api/samples`，从 `ownerKey=__sample-gallery__` 的公开项目返回样品列表。
   - `/samples` 页面先触发 ensure，再用 `/api/samples` 渲染；控制台复制出来的样品不再被静态 `SAMPLES` 卡住。
3. ✅ **控制台复制到样品馆**
   - 新增 `copyProjectToSampleGallery()`：把任意 `Project` 复制/更新为 `sample-*`、公开、样品馆 owner。
   - 新增 super admin API：`POST /api/admin/samples/copy-project`。
   - 运营控制台 Works 表对 game 增加“复制到样品馆”按钮。
   - 新增 CLI：`npm run sample:copy-project -- <projectId> [sampleId]`，复制并生成本地 public 资产。
4. ✅ **真实可见性与试玩验证**
   - `npm run seed:samples` ✅（20 projects）
   - `npm run qa:sample-gallery-db-sync` ✅（20/20）
   - `/api/samples` HTTP 检查 ✅：返回 20 个样品，含 `number-merge-2048` / `zen-go-board` / `jungle-animal-chess`。
   - `agent-browser` 打开 `/zh-Hans/samples` ✅：页面可见三款新样品。
   - `SAMPLE_AUDIT_IDS=number-merge-2048,zen-go-board,jungle-animal-chess npm run qa:sample-gameplay-interaction` ✅ **3/3**
5. ✅ **回归验证**
   - `npm run qa:sample-gallery-copy` ✅
   - `npm run qa:b-tier-smoke` ✅ **47/47**
   - `npm run build` ✅
6. ⬜ **下一步**
   - 部署后跑 `npm run seed:samples` 或访问 `/samples` 触发 ensure，确认生产 DB 也有 20 个样品。
   - 用生产控制台测试“复制到样品馆”按钮，再让非登录访客打开 `/samples` 借鉴/克隆。

---

更新时间：**2026-06-17**（迭代五十四 · 彩色棋盘与 2048 样品扩展 ✅）

## 迭代五十四（当前）

1. ✅ **新增三款色彩鲜明展示样品**
   - `number-merge-2048`：4x4 数字合成、亮黄/橙/红/青色块、分数/目标反馈。
   - `zen-go-board`：19x19 围棋、木纹棋盘、黑白落子、最近交互可观测。
   - `jungle-animal-chess`：7x9 斗兽棋、河流/陷阱/兽穴、动物棋子与合法走法。
2. ✅ **规格与运行时扩展**
   - `PuzzleBlueprint.mode` 新增 `merge2048`，`PuzzleScene` 实现滑动合并、生成新块、彩色数字块、QA `merge2048Max`。
   - `ChessBlueprint.ruleset` 新增 `go` / `jungle`，`ChessScene` 实现围棋落子 AI、斗兽棋动物子力与地形着色。
   - 修复斗兽棋关键词误伤“中国象棋”的推断 bug。
3. ✅ **样品体系补齐**
   - 三款新样品加入 `SAMPLES`、`SAMPLE_PLAY_PROFILES`、竞品 scene 期望、玩法深度期望、交互用例。
   - 生成基础 `public/game-sprites/sample-*/*.png` 与 `public/game-bg/sample-*.png`，避免样品门禁和运行时资产缺失。
   - 新增 `qa:board-showcase-samples` 并纳入 `qa:b-tier-smoke`。
4. ✅ **验证**
   - `npm run qa:board-showcase-samples` ✅
   - `npm run qa:template-matrix` ✅（13 templates + 20 samples）
   - `npm run qa:competitor-clone-checks-offline` ✅ **20/20**
   - `npm run qa:gameplay-depth-offline` ✅ **20/20**
   - `npm run qa:sample-gameplay-interaction:offline` ✅
   - `npm run qa:b-tier-smoke` ✅ **47/47**
   - `npm run build` ✅
5. ⬜ **下一步**
   - 部署后跑真实生产 URL 样品审计。
   - 产品肉眼抽测：重点看 2048 色块层次、围棋棋盘可读性、斗兽棋地形/棋子辨识度。

---

更新时间：**2026-06-17**（迭代五十三 · 商业精品生成门禁与双样例落地 ✅）

## 迭代五十三（当前）

1. ✅ **商业精品专项门禁**
   - 新增 `qa:commercial-game-design-contracts`，用“开心消消乐”和“中国象棋”验证生成链路是否具备商业设计字段。
   - 新增 `qa:match3-commercial-runtime`，验证 PuzzleScene 有 swap 三消、三连检测、特殊块状态。
   - 新增 `qa:xiangqi-commercial-runtime`，验证 ChessScene 具备 xiangqi 规则集、9x10、完整子力、QA 状态。
2. ✅ **规格层扩展**
   - `GameSpec.puzzle` 增加 `matchMechanic`、`objectives`、`boosters`、`specialTiles`、`levelCount`。
   - 新增 `GameSpec.chess` 蓝图与 `src/lib/chess-blueprint.ts`，支持 `international` / `xiangqi`。
   - `mockSpecFromPrompt()`、`finalizeSpec()`、`applyHardQualityDefaults()` 均会补齐 puzzle/chess 商业蓝图。
   - `lintGameSpecForOrchestration()` 增加 puzzle/chess 模板感知检查，避免“纸面精品”。
3. ✅ **开心消消乐式三消**
   - `PuzzleScene` 支持 `matchMechanic: "swap"`：相邻交换，形成三连才消除。
   - 四/五连会记录特殊块状态，QA 暴露 `match3Specials` / `specialTilesCreated`。
   - 旧 flood 点击消除保留为普通 match3 / 样品兼容路径。
4. ✅ **中国象棋运行时**
   - `ChessScene` 支持 `ruleset: "xiangqi"`：9x10 棋盘、楚河汉界、红黑完整子力。
   - 增加基础合法走法、合法落点高亮、吃子优先黑方 AI、`boardRows` / `boardCols` / `pieceCount` QA 状态。
   - 默认国际象棋样品路径保留。
5. ✅ **验证**
   - `npm run qa:commercial-game-design-contracts` ✅
   - `npm run qa:match3-commercial-runtime` ✅
   - `npm run qa:xiangqi-commercial-runtime` ✅
   - `npm run qa:non-sample-game-quality` ✅
   - `npm run qa:b-tier-smoke` ✅ **46/46**
   - `npm run build` ✅
   - `npm run qa:sample-play-extended` ✅ **7/7**
   - `PLAYWRIGHT_BASE_URL=http://127.0.0.1:8888 npm run qa:prod-sample-play-audit` ✅ **17/17**
6. ⬜ **下一步**
   - 部署后跑真实生产 URL 样品审计。
   - 产品肉眼抽测：重点看 swap 三消手感、特殊块演出强度、中国象棋棋盘可读性与 AI 回应。

---

更新时间：**2026-06-17**（迭代五十二 · 次级入口 HUD/资产下限补齐 ✅）

## 迭代五十二（当前）

1. ✅ **Farming / Puzzle / Physics 目标卡接入**
   - 三个次级 Scene 引入 `HudGoalPanel` 与 `buildSceneGoalGuidance()`。
   - 开场 banner 改走统一 guidance，目标 / 操作 / 风险说明不再只靠旧 Ready 文案。
   - update 循环驱动 `goalPanel.update()`，目标卡从开场说明过渡到半透明常驻。
2. ✅ **Farming / Puzzle / Physics 背景可见度下限**
   - 三个 Scene 增加 `backgroundUrl` 的 `bgTex` preload。
   - 背景图展示统一使用 `assetBackgroundAlpha(projectId, qualityTier)`。
   - 非 rich 模式纯色底降低到背景图之后，避免文生图背景完全被盖住。
3. ✅ **防回退契约扩展**
   - `qa:hud-goal-panel` 覆盖扩展到 7 个 Phaser Scene。
   - `qa:asset-visibility-floor` 覆盖扩展到 7 个 Phaser Scene。
4. ✅ **验证**
   - `npm run qa:hud-goal-panel` ✅
   - `npm run qa:asset-visibility-floor` ✅
   - `npm run qa:b-tier-smoke` ✅ **43/43**
   - `npm run build` ✅
   - Edited-file lints：无错误
5. ✅ **Bug 审查与本地路径验证**
   - 发现并修复 Puzzle 背景层级 bug：文生图背景原本在不透明 puzzle backdrop 下面，实际不可见；现改到 depth `-7`，并在 `qa:asset-visibility-floor` 增加回归断言。
   - 清理 Farming / Puzzle / Physics 不再使用的 `hudReady` import。
   - 本地样品扩展试玩：`npm run qa:sample-play-extended` ✅ **7/7**。
   - 本地样品互动审计：`PLAYWRIGHT_BASE_URL=http://127.0.0.1:8888 npm run qa:prod-sample-play-audit` ✅ **17/17**。
   - 非样品与深度门禁：`qa:non-sample-game-quality` ✅、`qa:gameplay-depth-offline` ✅、`qa:sample-gameplay-interaction:offline` ✅。
6. ⬜ **下一步**
   - 等当前改动部署后，对真实生产 URL 跑 `PLAYWRIGHT_BASE_URL=<prod> npm run qa:prod-sample-play-audit`。
   - 继续做肉眼抽测/截图审查，重点看 HUD 是否遮挡 Farming / Puzzle / Physics 的关键交互区。

---

更新时间：**2026-06-17**（迭代五十一 · Systems 技能/道具可观察层 ✅）

## 迭代五十一（当前）

1. ✅ **共享 systems 冲击层**
   - 新增 `src/game/engine/systemImpact.ts`。
   - `applySystemImpact()` 将 `skill` / `powerup` 的可见反馈统一为 pickup / combo / boss 语义反馈。
   - `bomb` 用 boss 级冲击，`dash` / `doubleScore` 用 combo，`shield` / `timeSlow` / `heal` 用明显 pickup。
2. ✅ **核心 Scene 接入**
   - `PlayScene` / `PlatformerScene` 的 `applyPowerup()` 统一触发 powerup 观察层。
   - `PlayScene` / `ShooterScene` / `PlatformerScene` / `TowerDefenseScene` 的 `tryCastSkill()` 统一触发 skill 观察层。
   - 保留原有数值副作用：护盾、倍率、磁铁、回血、炸弹清场、dash、timeSlow 等。
3. ✅ **防回退契约**
   - 新增 `qa:systems-observable-impact`。
   - 已接入 `qa:b-tier-smoke`。
4. ✅ **验证**
   - `npm run qa:systems-observable-impact` ✅
   - `npm run qa:b-tier-smoke` ✅ **43/43**
   - `npm run build` ✅
   - Edited-file lints：无错误
5. ✅ **后续补齐**
   - Farming / Puzzle / Physics 目标面板与资产下限已在迭代五十二完成。

---

更新时间：**2026-06-17**（迭代五十 · Director 事件运行时冲击层 ✅）

## 迭代五十（当前）

1. ✅ **共享运行时事件冲击层**
   - 新增 `src/game/engine/runtimeEventImpact.ts`。
   - `applyRuntimeEventImpact()` 按 director 事件类型触发 pickup / hit / combo / boss 语义反馈，避免事件只剩 banner。
   - `coinRain` / `goldenPickup` / `breathingRoom` 用 pickup，`goalShift` 用 combo，`miniBoss` / `finalBarrage` 用 boss。
2. ✅ **核心 Scene 接入**
   - `PlayScene` / `ShooterScene` / `PlatformerScene` / `TowerDefenseScene` 的 `startEvent(ev)` 统一调用 `applyRuntimeEventImpact()`。
   - 保留原有数值副作用：倍率、boss/精英刷怪、目标窗口、护盾/奖励等。
3. ✅ **防回退契约**
   - 新增 `qa:runtime-depth-observable`。
   - 已接入 `qa:b-tier-smoke`。
4. ✅ **验证**
   - `npm run qa:runtime-depth-observable` ✅
   - `npm run qa:b-tier-smoke` ✅ **42/42**
   - `npm run build` ✅
   - Edited-file lints：无错误
5. ⬜ **下一步**
   - 继续 runtime-depth：把 systems skill / powerup 的状态变化做成更统一的可观察层。
   - 后续扩展目标面板与资产下限到 Farming / Puzzle / Physics 等次级入口。

---

更新时间：**2026-06-17**（迭代四十九 · 用户生成资产可见度下限 ✅）

## 迭代四十九（当前）

1. ✅ **运行时资产可见度下限**
   - `phaser-loaded-sprites.ts` 新增 `assetBackgroundAlpha()`：非样品 standard 背景从低透明度水印提升到 ≥0.18，showcase 更高。
   - 新增 `visibleSpriteTargetSize()`：为 player / hazard / collectible / power / boss 提供按 `qualityTier` 缩放的最小可见尺寸。
   - `sampleBackgroundAlpha()` 改为走新下限，保留样品更突出的背景表现。
2. ✅ **核心 Scene 接入**
   - `PlayScene` / `ShooterScene` / `PlatformerScene` / `TowerDefenseScene` 的文生图背景透明度改用 `assetBackgroundAlpha(projectId, qualityTier)`。
   - 清除核心 Scene 中背景 `0.1` / `0.12` 这类过低硬编码，减少“空模板/水印背景”观感。
3. ✅ **防回退契约**
   - 新增 `qa:asset-visibility-floor`。
   - 已接入 `qa:b-tier-smoke`。
4. ✅ **验证**
   - `npm run qa:asset-visibility-floor` ✅
   - `npm run qa:b-tier-smoke` ✅ **41/41**
   - `npm run build` ✅
   - Edited-file lints：无错误
5. ⬜ **下一步**
   - 继续 runtime-depth：让 director/systems 的阶段、技能、道具和高潮事件更明显地改变运行时体验。
   - 后续扩展目标面板与资产下限到 Farming / Puzzle / Physics 等次级入口。

---

更新时间：**2026-06-17**（迭代四十八 · HUD 目标任务卡 ✅）

## 迭代四十八（当前）

1. ✅ **统一 HUD 目标面板**
   - 新增 `src/game/engine/HudGoalPanel.ts`，常驻展示游戏目标、操作方式和风险/节奏提示。
   - 面板使用 `CohesivePresentation` 的 panel/hud 样式，按 `qualityTier` 控制收起后的透明度。
   - 初始完整展示，数秒后半透明常驻，避免遮挡核心玩法。
2. ✅ **核心 Scene 挂载**
   - `PlayScene` / `ShooterScene` / `PlatformerScene` / `TowerDefenseScene` 增加 `goalPanel` 实例。
   - update 循环驱动 `goalPanel.update()`，让任务卡从开场说明过渡到常驻辅助。
   - `TowerDefenseScene` 任务卡下移，避免挡住基地/波次 HUD。
3. ✅ **防回退契约**
   - 新增 `qa:hud-goal-panel`。
   - 已接入 `qa:b-tier-smoke`。
4. ✅ **验证**
   - `npm run qa:hud-goal-panel` ✅
   - `npm run qa:scene-goal-guidance` ✅
   - `npm run qa:b-tier-smoke` ✅ **40/40**
   - `npm run build` ✅（先抓到 `HudGoalPanel` 类型宽化问题，已修复）
   - Edited-file lints：无错误
5. ⬜ **下一步**
   - 扩展目标面板到 Farming / Puzzle / Physics 等次级入口。
   - 继续推进用户生成资产可见度下限与 director/systems 运行时深度。

---

更新时间：**2026-06-17**（迭代四十七 · 目标引导层第一步 ✅）

## 迭代四十七（当前）

1. ✅ **共享目标引导文案层**
   - 新增 `src/lib/scene-goal-guidance.ts`，统一生成 `title` / `objective` / `controls` / `stakes` / `banner` / `bottomHint`。
   - 覆盖 collector / shooter / platformer / towerDefense / farming / puzzle 的目标、操作与风险提示。
   - 目标文案由 `GameSpec` 标题、labels、winScore、skill 推导，不再只显示 `Ready` 或零散控制提示。
2. ✅ **首批 Scene 接入**
   - `PlayScene`、`ShooterScene`、`PlatformerScene`、`TowerDefenseScene` 的底部提示改用 `guidance.bottomHint`。
   - 四个核心入口开场 banner 改用 `guidance.banner`，首屏直接告诉玩家目标、操作和节奏风险。
3. ✅ **防回退契约**
   - 新增 `qa:scene-goal-guidance`。
   - 已接入 `qa:b-tier-smoke`。
4. ✅ **验证**
   - `npm run qa:scene-goal-guidance` ✅
   - `npm run qa:b-tier-smoke` ✅ **39/39**
   - `npm run build` ✅
   - Edited-file lints：无错误
5. ⬜ **下一步**
   - 阶段三继续：把文案层升级为统一 HUD 目标面板/任务卡，而不只是 banner 与底部 hint。
   - 随后推进用户生成资产可见度下限与 director/systems 运行时深度。

---

更新时间：**2026-06-17**（迭代四十六 · TowerDefense 语义反馈收口 ✅）

## 迭代四十六（当前）

1. ✅ **TowerDefenseScene 接入语义 feedback**
   - 合成格选择/合成、开波、建塔/升级、击杀、基地护盾/受击、全局技能、coinRain、胜负结算收敛到 `juicePickup` / `juiceHit` / `juiceCombo` / `juiceBoss` / `juiceWin` / `juiceFail`。
   - 新增 `baseFxPoint()`，统一用路径终点作为基地反馈坐标，避免硬编码目标位置。
   - 清空 `TowerDefenseScene` 内旧式 `juiceShake` / `juiceFlash` / `juiceBurst` / `juiceFloater` 直接调用。
2. ✅ **防回退契约**
   - 新增 `qa:tower-defense-semantic-juice`。
   - 已接入 `qa:b-tier-smoke`。
3. ✅ **验证**
   - `npm run qa:tower-defense-semantic-juice` ✅
   - `npm run qa:b-tier-smoke` ✅ **38/38**
   - `npm run build` ✅
   - Edited-file lints：无错误
4. ⬜ **下一步**
   - 阶段三：统一 HUD/目标引导层，解决“看起来像调试模板”的问题。
   - 随后推进用户生成资产可见度下限与 director/systems 运行时深度。

---

更新时间：**2026-06-17**（迭代四十五 · 语义化 Juice 横向推广 ✅）

## 迭代四十五（当前）

1. ✅ **Platformer / Farming / Puzzle 接入语义 feedback**
   - `PlatformerScene`：收集、受伤、护盾、胜负结算、boss/炸弹技能、章节切换改走 `juicePickup` / `juiceHit` / `juiceBoss` / `juiceWin` / `juiceFail`。
   - `FarmingScene`：播种、浇水、收获连击、丰收结算改走 `juicePickup` / `juiceCombo` / `juiceWin`，金币不足走 `juiceHit`。
   - `PuzzleScene`：match3 命中/错误、找不同、记忆翻牌、拼图落位、胜负结算改走语义 feedback。
2. ✅ **新增防回退契约**
   - 新增 `qa:platformer-semantic-juice`
   - 新增 `qa:farming-semantic-juice`
   - 新增 `qa:puzzle-semantic-juice`
   - 全部接入 `qa:b-tier-smoke`。
3. ✅ **验证**
   - `npm run qa:platformer-semantic-juice` ✅
   - `npm run qa:farming-semantic-juice` ✅
   - `npm run qa:puzzle-semantic-juice` ✅
   - `npm run qa:b-tier-smoke` ✅ **37/37**
   - `npm run build` ✅
   - Edited-file lints：无错误
4. ⬜ **下一步**
   - 阶段二剩余：单独处理 `TowerDefenseScene`，把造塔、击杀、漏怪、波次、胜负反馈收敛到语义 feedback。
   - 阶段三：统一 HUD/目标引导层，解决“看起来像调试模板”的问题。

---

更新时间：**2026-06-17**（迭代四十四 · 语义化 Juice 试点 ✅）

## 迭代四十四（当前）

1. ✅ **语义化反馈 preset**
   - `gameJuice.ts` 新增 `resolveJuicePreset()` 与语义封装：`juicePickup` / `juiceHit` / `juiceCombo` / `juiceBoss` / `juiceWin` / `juiceFail`。
   - preset 区分 pickup、hit、combo、boss、win、fail 的粒子数、shake 强度、flash 时长、floater 前缀。
   - 新增 `qa:juice-semantic-presets`，断言语义反馈层级不退化。
2. ✅ **Scene 试点接入**
   - `PhysicsScene`：点击命中、连击、胜利改走 `juiceHit` / `juiceCombo` / `juiceWin`。
   - `PlayScene`：收集、受伤、护盾、boss 入场/阶段/受击/击杀、胜负结算接入 `juicePickup` / `juiceHit` / `juiceBoss` / `juiceWin` / `juiceFail`。
   - `ShooterScene`：敌人受击、爆炸、玩家受伤、护盾、炸弹技能、胜负结算接入语义反馈。
3. ✅ **防回退契约**
   - 新增 `qa:physics-semantic-juice`
   - 新增 `qa:play-scene-semantic-juice`
   - 新增 `qa:shooter-semantic-juice`
   - 全部接入 `qa:b-tier-smoke`。
4. ✅ **验证**
   - `npm run qa:juice-semantic-presets` ✅
   - `npm run qa:physics-semantic-juice` ✅
   - `npm run qa:play-scene-semantic-juice` ✅
   - `npm run qa:shooter-semantic-juice` ✅
   - `npm run qa:b-tier-smoke` ✅ **34/34**
   - `npm run build` ✅
   - Edited-file lints：无错误
5. ⬜ **下一步**
   - 继续阶段二横向推广：`PlatformerScene` / `TowerDefenseScene` / `FarmingScene` / `PuzzleScene` 接入语义 feedback。
   - 阶段三：统一 HUD/目标引导层，解决“看起来像调试模板”的问题。

---

更新时间：**2026-06-17**（迭代四十三 · 游戏质量跃迁第一阶段 ✅）

## 迭代四十三（当前）

1. ✅ **非样品用户生成质量门禁**
   - 新增 `qa:non-sample-game-quality`：覆盖 collector / shooter / towerDefense / physics / farming 五类普通用户 prompt。
   - 断言非样品 spec 经 `applyHardQualityDefaults()` 后必须通过 orchestration lint，且至少有 4 幕、3 个运行时事件、主动技能、4 个 powerup、商业表现档。
   - 已接入 `qa:b-tier-smoke`。
2. ✅ **商业表现档进入 GameSpec**
   - `GameSpec.presentation` 新增 `qualityTier: minimal | standard | showcase`。
   - `withPresentationDefaults()` 对用户新建默认补 `qualityTier=standard`，避免非样品路径继续落到“低配模板”。
   - `describeCohesiveExperience()` 展示 tier，方便开发态一眼确认共享体验层是否生效。
3. ✅ **非样品硬质量兜底加强**
   - `game-quality.ts` 新增 commercial director 兜底：非样品路径至少具备奖励窗 / 限时目标 / 高压段这类可观察事件。
   - `systems.ts` 保底 4 个 powerup，避免局内道具密度太低。
4. ✅ **juice 反馈按表现档放大**
   - `gameJuice.ts` 新增 `resolveSharedJuiceStyle()`，由 `qualityTier` 分级影响 shake / burst / floater / flash。
   - 新增 `qa:juice-quality-tier`，断言 `showcase > standard > minimal` 的反馈强度阶梯。
   - 已接入 `qa:b-tier-smoke`。
5. ✅ **验证**
   - `npm run qa:non-sample-game-quality` ✅
   - `npm run qa:juice-quality-tier` ✅
   - `npm run qa:game-quality-contracts` ✅
   - `npm run qa:b-tier-smoke` ✅ **30/30**
   - `npm run build` ✅
   - Edited-file lints：无错误
6. ⬜ **下一步**
   - 继续阶段二：把语义化 juice preset（hit / pickup / combo / boss / win / fail）接入 `PlayScene` / `PhysicsScene` / `ShooterScene` 试点。
   - 之后做统一 HUD/目标引导层，避免用户打开后仍像调试模板。

---

更新时间：**2026-06-17**（迭代四十二 · 构建追踪治理 + 提交前整理 ✅）

## 迭代四十二（当前）

1. ✅ **构建追踪治理**
   - 新增 `src/lib/public-path.ts`，统一本地 `public/` 运行时资产路径，避免服务端模块到处直接 `path.join(process.cwd(), "public", ...)`。
   - `next.config.ts` 增加 `outputFileTracingExcludes`，排除 `public/**/*`、`qa-output/**/*`、`workspaces/**/*`、`data/**/*.log` 这类运行时/QA 产物进入 server trace。
   - 覆盖封面、小说封面、漫画角色参考、游戏背景/sprite、Godot 导出、blob-store 等直接 public 路径。
2. ✅ **QA 契约**
   - 新增 `qa:next-trace-config`：断言 Next output tracing 排除项存在。
   - 新增 `qa:public-path-contracts`：断言 `src/` 内不再直接拼 `process.cwd()/public` 或 `repoRoot()/public`。
   - 两个契约均纳入 `qa:b-tier-smoke`。
3. ✅ **验证**
   - `npm run qa:next-trace-config` ✅
   - `npm run qa:public-path-contracts` ✅
   - `npm run qa:b-tier-smoke` ✅ **28/28**
   - `npm run build` ✅（Turbopack broad-pattern warnings 从 39 → 19 → **0**）
   - Edited-file lints：无错误
4. ⚠️ **已知验证限制**
   - `npx tsc --noEmit` 仍被既有 `e2e/*.spec.ts` 类型问题挡住（agenticModule / Page / APIRequestContext 等），非本轮 public-path 改动引入。
   - `npm run lint` 在本地扫描长期无输出，已停止；本轮依赖 `ReadLints` + build + 契约验证。
   - 为消除 Turbopack 误追踪，对运行时动态文件访问补充 `/*turbopackIgnore: true*/`：封面字体读取、小说/漫画/游戏生成资产、Godot workspace、AI sprite 引用读取。
5. ⬜ **未收口**
   - 工作区 `git status` 输出已超过 1MB；提交前仍需筛选源码、QA 报告、截图/PNG 等哪些纳入 commit。
   - 尚未 commit / push / deploy，生产 6666 尚未复验。

**下一步**：做一次提交前审阅，优先纳入源码、脚本、项目记忆与必要 QA summary；谨慎筛选大体积截图/贴图/报告，然后 commit → push → deploy → 生产 `qa:prod-sample-play-audit` + `COMPETITOR_CLONE_BATCH=all` + 文学/漫画冒烟。

---

更新时间：**2026-06-17**（迭代四十一 · 三线风险修复 + 验证 ✅）

## 迭代四十一（当前）

1. ✅ **游戏线风险修复**
   - `qa:competitor-gates` 的 clone batch 结果改为结合子报告 `qa-output/competitor-clone-batch/summary.json` 判定，避免 Windows `execSync`/Playwright 假挂误杀。
   - `game-quality.ts` 同步 farming 双轨经济：硬质量底座抬高 `gameplay.startingCoins` 后同步 `farming.startingCoins`，避免用户新生成 farming 游戏规格与运行时开局金币不一致。
   - 新增 `qa:game-quality-contracts` 并纳入 `qa:product-lines:game` / `qa:b-tier-smoke`。
2. ✅ **小说线风险修复**
   - 新增 `literary-safety`：公开列表/详情统一只允许非 owner 读取 `visibility=public && status=ready`。
   - 长篇生成中草稿默认 `hidden`，避免 `draft_generating` 空壳泄漏到发现页。
   - `resumeNovelId` 续跑不再重复消耗首次小说生成额度。
   - 新增 `qa:literary-safety-contracts` 并纳入 `qa:product-lines:novel` / `qa:b-tier-smoke`。
3. ✅ **漫画线风险修复**
   - 同步 `POST /api/comic/[id]/panels` 补齐 `comicPanels` quota gate，与 SSE stream 路由一致。
   - 复审发现 quota gate 不能早于归属校验/完成态 no-op；已调整 sync + stream 路由顺序，避免不存在/非本人/已满格请求误扣额度。
   - `storyboardSource=emergency` 返回 `storyboardWarning`，不再静默低质降级。
   - panels stream / sync API 对部分完成返回 `resumeHint`，明确长篇配图可续跑。
   - 新增 `qa:comic-safety-contracts` 并纳入 `qa:product-lines:comic` / `qa:b-tier-smoke`。
4. ✅ **验证**
   - `npm run qa:game-quality-contracts` ✅
   - `npm run qa:literary-safety-contracts` ✅
   - `npm run qa:comic-safety-contracts` ✅
   - `npm run qa:product-lines:game` ✅（含 E2E）
   - `npm run qa:product-lines:novel` ✅（含 E2E）
   - `npm run qa:product-lines:comic` ✅（含 E2E）
   - `npm run qa:product-lines` ✅（三线汇总包含 game / novel / comic）
   - `npm run qa:b-tier-smoke` ✅ **26/26**
   - `npm run build` ✅
6. ✅ **报告收口**
   - 修复单线 `qa:product-lines:comic|novel|game` 覆盖三线总汇总的问题；现在只有全量 `qa:product-lines` 写 `qa-output/product-lines/summary.json`。
   - 新增 `qa:product-lines-summary-contracts` 并纳入 `qa:b-tier-smoke`。
7. ⬜ **未收口**
   - 工作区仍包含迭代四十的旗舰 AI PNG、共享表现层、Scene 收口、QA 产物及本轮三线修复；尚未 commit / push / deploy。
   - 生产 6666 尚未复验迭代四十/四十一改动。

**下一步**：做一次代码审阅/选择要纳入提交的 QA 产物，然后 commit → push → deploy → 生产 `qa:prod-sample-play-audit` + `COMPETITOR_CLONE_BATCH=all` + 文学/漫画冒烟。

更新时间：**2026-06-16**（迭代四十 · 本地调试优先）

## 迭代四十（当前）

1. ✅ 旗舰 5 款 AI 贴图本地生成（`seed:flagship-ai-sprites`，未 commit / 未推生产）
2. ✅ **parity / 克隆根因修复**（重启后 strict **17/17 + 克隆 5/5** 复验通过）：
   - `variantId` 回退 + `GamePlayerInner` canonical prompt
   - `duplicate` 走 `prepareGameSpecForPersist` 持久化 canonical spec
   - parity 每款独立 Playwright page + session 清理（防页面污染）
   - `ShooterScene` orbit 障碍确定性 seed（已移除 physics.pause，不影响试玩）
   - `seed:sample-assets` 跳过已有旗舰 5 款 AI 贴图
3. ✅ gameplay interaction **17/17**
4. ✅ 本地 `qa:competitor-gates` 实质全绿（parity/clone/gameplay/Godot 均 PASS；`cloneBatchOk` 曾误报 false → 已修 `execSync` 15min 超时 + `writeFinalSnap`）
5. ✅ **硬质量底座**：`game-quality.ts` + 生成 / 保存 / 补丁 / enrich 四条链路兜底，未来用户生成游戏也会自动补齐主题、节奏、技能与数值底线
6. ✅ **共享表现层可见化**：`cohesive-presentation` 状态带 + `gameJuice` 全局强化 + `gameSoundscape`/`webBleeps` 默认音画反馈升级 + 启动 banner 摘要
7. ✅ **Scene 收口**：12 个主要 Scene 统一接入 `buildSceneCohesion()`，不再各自手写共享气质与短反馈音色初始化
8. ✅ **启动链收口**：`createPhaserGame` 改为统一入口，启动 banner / 共享气质 / 短反馈音色均走同一协议
9. ✅ 关键回归：`qa:sample-gameplay-interaction` **17/17**、`qa:competitor-parity-validation` **17/17+克隆5/5**、`qa:competitor-clone-batch` **all 17/17**（2026-06-16T15:51）；Windows 子进程假挂 → `process.exit(0)` 收口
10. ✅ `qa:competitor-gates` 全量 wrapper **全绿**（2026-06-16T16:27 · `e2eAllOk=true` · 约 33min）
11. ✅ **commit + push + deploy** — `85bd56c` @ `http://43.163.105.71:6666` · health OK（2026-06-17）
12. P3：Console SSO
11. P3：Console SSO

**下一步**：如果你要，我可以继续把 `HudBanner` / `gameSoundscape` 再收薄一点，或者直接做 commit 收口。

更新时间：**2026-06-16**（迭代三十九 · sprite 深度渲染）

更新时间：**2026-06-16**（迭代三十八 · 生产 sprite + 17/17 ✅）

## 迭代三十八（当前）

1. ✅ `ad87851` + `e8e9cee` — 程序化贴图 · blocky-sniper QA 边界
2. ✅ 生产 `qa:prod-sample-play-audit` **17/17**
3. ✅ 生产 clone batch **17/17** · 本地 `qa:competitor-gates` 待跑
4. P3：Console SSO · 旗舰文生图贴图（可选 RUN_REAL_IMAGE_GEN）

更新时间：**2026-06-15**（迭代三十七 · 生产 17/17 ✅）

## 迭代三十七（生产闭环）

1. ✅ `451cee8` 部署 @6666
2. ✅ `qa:prod-sample-play-audit` **17/17**
3. ✅ `COMPETITOR_CLONE_BATCH=all` @prod **17/17**
4. ✅ P2：`seed:sample-assets` 旗舰 5 款 rich 贴图 + 背景 · `competitor-gates` 本地全绿（固定 PLAYWRIGHT_BASE_URL=8888）
5. 注意：全量 Playwright 串行偶发假失败；勿残留 `PLAYWRIGHT_BASE_URL=6666` 跑本地门禁

更新时间：**2026-06-15**（迭代三十七 · 本地 17/17 玩法+克隆 ✅）

更新时间：**2026-06-15**（迭代三十一 · 样品可玩性视觉升级 ✅）

更新时间：**2026-06-15**（迭代三十 · 宋辽满格+精选 ✅）

更新时间：**2026-06-14**（迭代二十九 · 全链路收口 ✅）

更新时间：**2026-06-14**（迭代二十八 · 竞品克隆批量门禁 ✅）

更新时间：**2026-06-14**（迭代二十七 · 竞品克隆三件套 ✅）

更新时间：**2026-06-14**（迭代十九 · QA 工程化 ✅）

更新时间：**2026-06-14**（迭代二十一 · 宋辽 QA 产物链 ✅）

更新时间：**2026-06-14**（迭代二十二 · 缓存解析 + 链式 QA ✅）

更新时间：**2026-06-15**（迭代三十二 · 全 17 款 action 视觉层 ✅）

更新时间：**2026-06-15**（迭代三十三 · Platformer+Coaster 视觉 ✅）

更新时间：**2026-06-15**（迭代三十五 · AI patch QA + 竞品基线 ✅）

更新时间：**2026-06-15**（迭代三十四 · 生产上线 cb03358 ✅）

## 迭代三十五：AI patch 实机 + 竞品截图基线

| 项 | 交付 |
|----|------|
| `qa:sample-ai-patch-audit` | 健康 / 拉规格 / POST patch / 试玩页 UI 四步验收 |
| 生产 patch | API 改 `gameplay.startingCoins=200` · UI 清空输入无报错 |
| 种田同步缺口 | LLM 未改 `farming.startingCoins` · 本地 `syncFarmingStartingCoins` 已补 |
| 竞品 batch @prod | **17/17 PASS** · `COMPETITOR_CLONE_BATCH=all` |
| 脚本 | `competitor-clone-batch` IPv4 health + 6666 Playwright + 远程跳过 seed |

**下一步**：主人 refine 链路生产抽测 · 用户肉眼抽测

## 迭代三十五（闭环）：deploy `271dd39` + patch 全绿

| 项 | 交付 |
|----|------|
| commit | `271dd39` fix(patch): 种田金币同步 + AI patch 生产验收脚本 |
| 生产 | http://43.163.105.71:6666 · health ok |
| `qa:sample-ai-patch-audit` | **4/4** · `farming.startingCoins=200` |
| `qa:competitor-clone-batch` all | **17/17** @ prod（上轮已验） |

## 迭代三十四：提交 + 生产部署

| 项 | 交付 |
|----|------|
| commit | `cb03358` feat(playability): 17 款样品视觉与手感全面升级 |
| 生产 | http://43.163.105.71:6666 · health ok · PORT=6666 |
| prod QA | `qa:prod-sample-play-audit` **17/17** |

生产试玩：`/play/sample-grow-a-garden` · `/play/sample-color-bloom` · `/play/sample-elastic-thief-2`

**下一步**：AI 修改链路实机验收 · 竞品截图基线更新 · 用户肉眼抽测

## 迭代三十三：Elastic Thief + 过山车/公路强化

| 项 | 交付 |
|----|------|
| `action-visual` 扩展 | 金库潜行背景、脉冲激光、主题天空、立体车厢、公路障碍车 |
| `PlatformerScene` | Elastic Thief 金库场景 + 宝藏光晕 + 激光脉冲 |
| `CoasterScene` | Rail in Air / Crashy Roads 主题渐变 + 立体车厢 + 公路虚线/障碍车 |
| QA | **17/17** |

试玩：`/play/sample-elastic-thief-2` · `/play/sample-rail-in-air` · `/play/sample-crashy-roads`

## 迭代三十二：action-visual 全覆盖剩余样品

| 项 | 交付 |
|----|------|
| `action-visual.ts` | 沙袋场、策略地图、象棋演播室、汽车/陶艺、环绕星球、狙击镜 |
| Scene 接入 | Physics / Strategy / Chess / Customization / Shooter |
| `registry.ts` | **17/17** 样品独立 theme 配色 |
| QA | `qa:sample-gameplay-interaction` **17/17** |

试玩：`/play/sample-smash-the-dummy` · `/play/sample-state-conquest` · `/play/sample-blocky-sniper-hunter`

## 迭代三十一：17 款样品可玩性视觉升级（本地 ✅）

| 项 | 交付 |
|----|------|
| `farming-visual.ts` | 田园背景、分阶段作物、Grow a Garden 种子栏/连收 |
| `puzzle-visual.ts` | Color Bloom 宝石块、Whimsy 插画找不同、Memory emoji、Kids 动物拼图 |
| `TowerDefenseScene` | 合成格 🔫/🗡️ tier 图标 |
| `registry.ts` | 6 款样品主题色 + 作物/经济参数 |
| QA | `qa:sample-gameplay-interaction` **17/17** · `qa:sample-profiles` OK |

试玩：`/play/sample-grow-a-garden` · `/play/sample-color-bloom` · `/play/sample-whimsy-differences`

**下一步**：`git commit` + `push main` → `python scripts/deploy-prod-playability-fix.py`（PORT=6666）

## 迭代三十：宋辽中篇实机复跑 + 发现页精选

| 项 | 交付 |
|----|------|
| 分镜实机 | 8 页 32 格 · **396s** · `cmqekk1ft000113f3f5y8qke8` |
| lib 配图 | **32/32 · 775s** · `full-medium-summary.json` |
| 精选 seed | `seed:comic-featured-songliao` → 发现页 featured API |
| 三线验收 | `qa:product-lines:novel` + `:comic` 离线+E2E 全 OK（`PW_EXTERNAL=1`） |

试看：http://127.0.0.1:8888/comic/cmqekk1ft000113f3f5y8qke8 · 首页/发现精选可见

## 迭代二十九：全链路收口

| 项 | 交付 |
|----|------|
| `qa:competitor-clone-checks-offline` | 17 款离线断言 · CI + b-tier **20/20** |
| `qa:pm-handtest-signoff` | 六模板 + 竞品 PM 自动化签收报告 |
| `qa:competitor-gates` | 接入 `qa:competitor-clone-batch` all=17 |
| 文档 | HISTORICAL #27–29 · CURRENT_STATUS 更新 |

## 迭代二十八：17 款竞品克隆批量对标

| 项 | 交付 |
|----|------|
| `competitor-clone-playability-checks.ts` | 17 款 per-sample 断言 + expectedScene |
| `competitor-clone-screenshots.ts` | 动画场景 burst 采样 · 独立 browser context |
| `qa:competitor-clone-batch` | smoke=8 / all=17 · 报告 `qa-output/competitor-clone-batch/` |
| `inferPuzzleMode` sampleId | whimsy / memory / kids / color-bloom |
| `qa-historical-closure` | dev 在线时跑 smoke batch |
| 实机 | smoke **8/8** · 全量 **17/17** |

## 迭代二十七：竞品克隆可玩度（Crashy + Elastic Thief + Pottery）

| 项 | 交付 |
|----|------|
| `inferPlatformerMode` / `inferCustomizationMode` | `sampleId` 强制 stealth / pottery |
| `PlatformerScene` | 激光束命中检测 + 闪红反馈 |
| `CustomizationScene` | 转盘点击拉坯增高 |
| `qa:platformer-stealth-mode` · `qa:pottery-mode` | 离线断言 · 接入 b-tier **18/18** |
| 实机 clone QA | crashy-roads ✅ · elastic-thief-2 ✅ · pottery-master-3d ✅ |

试玩：`/play/sample-elastic-thief-2` · `/play/sample-pottery-master-3d`

## 迭代二十二：漫画缓存解析 + 分镜→配图链

| 项 | 交付 |
|----|------|
| `listCachedComicRefs` | 按时间倒序 · **优先缺配图** comicId |
| `resolveCachedComicId({ ignoreEnv })` | 避免 shell 残留 `QA_COMIC_RESUME_ID` 覆盖 |
| `syncFullMediumSummaryIfComplete` | 满格后自动写 `full-medium-summary.json` |
| `qa:songliao:medium-chain` | storyboard → panels-resume 一条龙 |

## 迭代二十一：宋辽回归产物链 + env 泄漏修复

| 项 | 交付 |
|----|------|
| `songliao-regression-artifacts.ts` | 缓存 novelId/comicId · 别名报告（storyboard / full-medium / 4tier / resume） |
| `clearLeakedLiteraryQaEnv` | wrapper 清除 shell 残留 `QA_COMIC_RESUME_ID` / `QA_COMIC_PAGES` 等 |
| `qa:songliao:panels-resume` · `qa:songliao:artifacts` | 一键补配图 · 离线断言 |
| 实机 | 8 页分镜 **238s** · pipeline=light · 32 格 → `storyboard-summary.json` |

## 迭代二十：DATABASE_URL 全仓对齐 + CI 门禁

| 项 | 交付 |
|----|------|
| `applyLiteraryQaDatabaseUrl` / `applyQaOfflineDatabaseUrl` | QA 入口统一写入 env |
| `warnLiteraryQaEnv` | lib + ci.sqlite 误配告警 |
| `qa:songliao:storyboard` | 中篇 8 页分镜快测（跳过配图） |
| CI / deploy-preflight / product-lines | 接入 `qa:database-url` + director-pipeline |

验证：`npm run build` · `qa:b-tier-smoke` · `qa:product-lines:comic`

## 迭代十九：DATABASE_URL / 配图 runner 工程化

| 项 | 交付 |
|----|------|
| `src/lib/database-url.ts` | 误配 `file:./prisma/dev.db` 自动纠正；文学 QA / dev 解析 |
| `run-dev.mjs` | shell 残留 `ci.sqlite` 自动改回 `dev.db`（`DEV_ALLOW_CI_DB=1` 可保留） |
| `src/lib/qa/literary-panel-render.ts` | lib / http 配图复用；多轮直到满格 |
| 便捷脚本 | `qa:songliao:novels` · `qa:songliao:comic-full` · `qa:database-url` |
| `docs/local-database.md` | 文学实机命令与 `QA_PANEL_RENDER_MODE` 说明 |

验证：`npm run build` ✅ · `qa:b-tier-smoke` 13/13 ✅ · resume 配图 32/32 ✅

## 迭代十八：中篇默认 8 页仍走 director

| 现象 | 根因 | 修复 |
|------|------|------|
| 宋辽 E2E 中篇→8 页漫画 ~15min+ | `medium` + 8 页 ≥ `directorPipelineMinPages(6)` → `long_director` | **`mediumDirectorMinPages=12`**：中篇默认 8 页走轻量；≥12 页才 director |
| 改编仍多一轮 Brief LLM | `creativeBriefExpand` 对 `from_novel` 也跑 | **`shouldSkipComicBriefExpand`**：有 `novelId` 且无 `briefRevision` 时跳过 |
| 中篇仍跑 preread/blueprint | `shouldBuildAdaptationBlueprint` 阈值过低 | **medium**：≥12000 字且 ≥4 章才建蓝图 |

## 迭代十七：短篇/char-sheet（仍有效）

| 现象 | 根因 | 修复 |
|------|------|------|
| 短篇 4 页漫画 ~7min+ | 中文 4 页强制 `long_director` | 短篇/儿童一律轻量 |
| 分镜 defer 仍卡 char-sheet | 同步文生图人设图 | 延至 `renderComicPanels` |
| 轻量路径仍跑精读/蓝图 | roster 前全量 preread | 轻量仅拉 roster |

## 迭代十八：中篇 8 页轻量分镜（✅ 314s）

| 现象 | 根因 | 修复 |
|------|------|------|
| 中篇 8 页 600s 超时 | 仍走 `long_director` 或轻量 4 页×8 格=32 格 JSON 单次 LLM ~8min | **`mediumDirectorMinPages=12`**；**中篇默认四宫格**；**2 页/批**；**二分降级**替代逐页 180s×N |
| 改编多一轮 Brief | `creativeBriefExpand` 对 `from_novel` 也跑 | **`shouldSkipComicBriefExpand`** |
| 旧 draft Resume 错批大小 | grid_8/4 页批 checkpoint 与新区不兼容 | **layout/pipeline 不匹配则忽略 draft** |
| roster 仍用 raw SQL | 迁移前 Prisma Client 未 generate | **改用 Prisma `characterRosterJson`** |

验证（2026-06-14）：`pipeline=light`，8 页 32 格，314s，无 `QA_SKIP_CHAR_SHEETS`

```powershell
# 分镜路径（跳过配图，~5min）
$env:QA_COMIC_NOVEL_ID="cmqdub6vx0001t1ctchwz59rc"
$env:QA_COMIC_PAGES="8"
$env:SKIP_COMIC_PANELS="1"
npm run qa:songliao-literary-regression

# 离线断言（秒级，CI 可用）
npm run qa:comic-director-pipeline
```

## 待办

| 状态 | 项 |
|------|-----|
| ✅ | 三线独立验收 `qa:product-lines`（离线 + E2E） |
| ✅ | 四档小说实机 — `novels-4tier-summary.json` |
| ✅ | 中篇 8 页全量（分镜 267s + lib 配图 32/32） — `full-medium-summary.json` |
| ✅ | DATABASE_URL 规范化 + dev 防 ci 污染 + 文学配图 runner |
| ✅ | CI/deploy-preflight 接入 database-url · storyboard 快测脚本 |
| ✅ | 8 页分镜实机 238s · env 泄漏修复 · 产物别名报告 |
| ✅ | 分镜+配图链 238s+528s=32/32 · `cmqe2cos2000167xc8zuy9c86` |
| ✅ | 17 款竞品 clone batch + 离线断言 + CI |
| ✅ | 六模板 PM 自动化签收 `qa:pm-handtest-signoff` |
| ✅ | git commit `e098313` — 文学链路 + 竞品 clone 门禁 |
| ⬜ | Console SSO 生产 IdP 联调（需企业 Azure/飞书配置 · 文档已齐） |
| ✅ | 种田 patch 金币同步上线 `271dd39` |
| ✅ | `qa:sample-ai-patch-audit` 生产四步全绿 |
| ⬜ | 六模板章节感 **可选** PM 肉眼抽测（自动化已签收） |
