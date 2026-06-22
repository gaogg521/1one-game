# DECISIONS

更新时间：**2026-06-22**

## 2026-06-22 — 生产服务器可迁移性（备份/恢复脚本）

**背景**：生产在 CentOS 7（`43.163.105.71`），未来需迁到 Ubuntu 22 / Rocky 9 等新机。

**决策**：

| 能力 | 路径 |
|------|------|
| 统一 SSH 目标 | `scripts/prod_ssh.py` + 环境变量 `OPERONE_DEPLOY_*` |
| 旧机备份 | `scripts/backup-prod-for-migration.py` → `backups/*.tgz` |
| 新机恢复 | `scripts/restore-prod-migration.py --bundle ...` |
| 完整文档 | `docs/server-migration.md`（给 AI / 运维） |

**迁移口诀**：备份 → 新机 `install.sh` → restore → `deploy-prod-with-assets.py` → 切 DNS。

---

## 2026-06-22 — 生产部署必须同步运行时素材（不进 Git）

**背景**：`public/covers/`、`public/game-sprites/`、`public/game-bg/` 被 `.gitignore` 排除；`git pull + build` 只更新代码，**不会**带上本机生成的封面/精灵/背景。生产 DB 的 `coverPath` / 样品 `sample-*` 路径会 404。

**决策 — 每次推生产后在本机执行（有本地 `public/` 的机器）**：

| 步骤 | 脚本 | 同步内容 |
|------|------|----------|
| 1 | `python scripts/deploy-prod-cee8b1d.py` | 代码、migrate、build、seed:samples |
| 2 | `python scripts/sync-sample-assets-to-prod.py` | 样品 `sample-*` 精灵 + 背景 |
| 3 | `python scripts/sync-literary-covers-to-prod.py` | 生产 DB 引用的 `/covers/*`（小说/漫画封面） |

**一键**：`python scripts/deploy-prod-with-assets.py`（按序跑 1→2→3）。

**不同步**：用户自创 `cmq…` 项目整包 `public/`（DB ID 不一致）；仅同步 prod DB 实际引用的路径。

**仍可能无封面**：DB 里 `coverPath` 为空的 Novel/Comic 需在创作台重新生成封面。

**后续若漫画分镜缺图**：按 Comic `imageUrls` 扩展同步脚本（待补）。

---

## 2026-06-18 — coerceGameSpec 保留 Agentic 字段（迭代一百零二）

## 2026-06-18 — coerceGameSpec 保留 Agentic 字段（迭代一百零二）

**增量**：
1. `prepareGameSpecForPersist` 经 `coerceGameSpec` 时须保留 `agenticModule` / `agenticPlayRoute`（Zod 校验后透传）。
2. `buildCanonicalAstrocadeSpec`：凡 `hasAgenticArtifact` 均在 enrich 后写回 route + module。
3. 平台回归：`npm run qa:platform-test-generate`（ownerKey=`platform-test-user`）。

---

## 2026-06-17 — Phaser.Scene CLI bridge + P0 玩法 polish（迭代一百零一）

**增量**：
1. `wrapPhaserSceneAsCreateGame`：`Phaser.Scene` 子类 → `createGame`（`this`→`scene`，scale→ctx）。
2. 消消乐关间 **⭐ 飞入** 顶栏关卡位（`playAnipopStarFlyIn`）。
3. 神庙死亡 **3 秒结算倒计时** + `templeDeathCountdown` QA 状态。
4. `qa:temple-death-flow` 离线门禁。

---

## 2026-06-17 — OpenGame CLI → Agentic bridge（迭代一百）

**增量**：
1. `opengame-cli-bridge.ts`：扫描 workDir JS → 去 ESM → 合并 helper + `createGame` → Agentic 模块。
2. `OPENGAME_CLI_BRIDGE=1`：CLI 成功且 Debug Skill 通过后，生成源 `opengame_cli`（优先于 LLM）。
3. Fixtures + `qa:opengame-cli-bridge`（native / multi-file / merge）。

---

## 2026-06-17 — OpenGame Pro CLI 子进程 spike（迭代九十九）

**增量**：
1. `opengame-cli.ts`：`probeOpenGameCli` / `runOpenGameCliHeadless`（headless `-p` + `--yolo`）。
2. `OPENGAME_CLI=1` 且复杂 prompt 时在 `generateAgenticGameModule` 写入 orch `opengame_cli_spike`（**观测 only**，尚未替换 Agentic 模块）。
3. `OPENGAME_CLI_DRY_RUN=1` 离线 QA；产物目录 `.tmp-opengame/`（gitignore）。
4. QA：`npm run qa:opengame-cli-spike`。

---

## 2026-06-17 — OpenGame 试玩路由接入用户管线（迭代九十六）

**决策**：
1. `GameSpec.agenticPlayRoute`: `dedicated` | `agentic` — 持久化试玩路由，refine 可继承/重算。
2. `OPENGAME_AGENTIC_ROUTE=complex_only`（默认）：仅 `agentic_complex` prompt 走 `attachAgenticModuleIfEnabled` + AgenticScene；简单 prompt 仍走样品级专用 Scene。
3. `OPENGAME_AGENTIC_ROUTE=all|off` 全局开关；`AGENTIC_FORCE_LLM=1` 强制 agentic。
4. `OPENGAME_BROWSER_BENCH=1`：LLM 模块生成后可选 Playwright 真浏览器验证；`OPENGAME_BROWSER_BENCH_REPAIR=1` 失败时追加一轮 repair。

---

## 2026-06-17 — OpenGame Skills Phase B：Browser Bench + 复杂度路由

**增量**：
1. `complexity-route.ts`：复杂 prompt（多关/选角/Boss/卡牌）→ `agentic_complex`，跳过 template-first 强制 LLM+Skills。
2. `/qa/agentic-bench`：OpenGame-Bench 风格真 Phaser 探测页（生产需 `QA_ROUTES_ENABLED=1`）。
3. `browser-bench.ts` + `qa:opengame-browser-bench` Playwright 脚本（**2/2 PASS**：platformer + physics fallback）。
4. payload 编解码须浏览器安全（`TextEncoder`/`atob`，勿在 client 依赖 Node `Buffer`）；`sceneKey` 须在 Scene boot 后用 `game.scene.getScenes(true)` 读取。
5. `AgenticScene` 成功加载后 `schedulePhaserPlayReady`。
6. Debug Skill 修正 `MISSING_UPDATE_FOR_SPAWNER`（认可 `scene.events.on('update')`）。

---

## 2026-06-17 — 提炼 OpenGame Skills 接入 Agentic 管线

**背景**：用户生成质量瓶颈在「单 JSON + 单文件 Agentic」上限；[OpenGame](https://github.com/leigest519/OpenGame) 的核心是 **Template Skill（稳定 scaffold）** + **Debug Skill（verify→diagnose→repair 协议）**，而非单纯换模型。

**决策**：
1. 新增 `src/lib/opengame-skills/`：Debug 协议（提炼 seed-protocol + Operone 可玩性检查）、Template 族（6 archetype 映射 OpenGame modules → 单文件 Template Method 骨架）。
2. **Template Skill** 注入 `agentic-prompts` system/user/repair；按 prompt 关键词升级 archetype（如卡牌→ui_heavy、选角多关→platformer）。
3. **Debug Skill** 接入 `generate-game-module.ts`：`runDebugSkillPipeline`（proactive → runnable）失败时带协议 fix 多轮 LLM repair（最多 3 轮）。
4. 不替换 GameSpec 秒开主路径；Skills 仅强化 **Advanced Agentic LLM** 分支。完整 OpenGame CLI 多文件工程留作后续 Pro 模式。
5. QA：`npm run qa:opengame-skills`。

**归因**：Debug 协议思路源自 OpenGame（Apache-2.0, CUHK MMLab）。

---

更新时间：**2026-06-17**

## 2026-06-17 — 样品馆商业标准裁剪（23 → 14）

**背景**：用户要求淘汰不符合技术/商业标准的薄 demo 与重复 SKU，集中精力打磨保留款。

**删除（9 款）**：
| id | 理由 |
|----|------|
| `ultimate-3d-chess` | 与国际象棋重复 |
| `rail-in-air` | 跑酷/过山车重复（保留神庙 + Crashy） |
| `whimsy-differences` / `memory-match-mania` / `kids-puzzle` | 薄益智，无商业深度 |
| `car-color-palette` | 薄定制 demo |
| `state-conquest` | 薄策略 |
| `tiny-planet-chopper` / `blocky-sniper-hunter` | 薄射击 |

**保留（14 款）**：棋盘五款 + 2048 + 神庙 + 消消乐 + 街机/深度七款（Crashy、Smash、Garden、Gun Merge、Elastic Thief、Blade Defender、Pottery）。

**实现**：`src/lib/samples.ts` 及 registry / QA / infer / 封面脚本同步；用户 prompt 推断能力保留（非样品馆 SKU）。

---

更新时间：**2026-06-13**

## 2026-06-13 — 全局 canonical spec（Spec/资产/运行时同源）

**背景**：用户要求全面对标 Astrocade，非逐款 patch；样品 seed / 用户 POST / duplicate / 试玩须同效果。

**决策**：
1. **`buildCanonicalAstrocadeSpec`** 为唯一 spec 入口：已知样品 prompt 忽略 POST body 差异，始终同 mock 元数据 + enrich。
2. **`resolveAssetProjectId`**：有 `samplePlayProfile.variantId` 时，背景/精灵走 `sample-{id}`，不绑用户 projectId。
3. **`runtimeSeedFromSpec`** + **`schedulePhaserPlayReady`**：全 Phaser Scene（除 AgenticScene）确定性 RNG + QA 稳定截图帧；TD 首波 ≥1600ms。
4. **全局 canvas 阈值**（`GLOBAL_CANVAS_PARITY` / `GLOBAL_CLONE_PARITY`），不再 per-sample 分档。
5. **`qa:spec-canonical-parity`** 17/17 离线断言；**`COMPETITOR_PARITY_STRICT=1`** 为 gates/nightly/CI bundle-e2e 默认。

**产物**：`src/lib/astrocade-canonical-spec.ts` · `src/lib/runtime-seed.ts` · `qa-output/competitor-parity/`

**用户感知（2026-06-13 补）**：
- `SampleParityTrustBadge`：试玩页 / 创作预览告知「与样品馆同款」
- 样品馆「用此 prompt 创作」→ `buildCreatePrefillPath` / `/create?prefill=`
- 创作台 `sample-intent-hint` + 生成中同款文案；结果页 `parityTitle`
- `GamePlayerInner` loading 至 `__PHASER_PLAY_READY__`
- `qa:user-journey-parity`：PM 四条用户故事（含 prefill 深链）

**文学线用户感知（2026-06-13）**：
- `LiteraryAdaptationTrustBadge`：小说→漫画改编承诺（Brief + 对白绑定 + 题材视觉）
- 小说完成页 / `?adaptComic=1`：一键进改编面板
- `qa:literary-user-journey`：6 条 PM 故事（完整性 · 题材 · 8宫格 · 分镜策略 · 对白回填 · 按章进度）
- `qa:platform-user-journey`：汇总游戏+文学+`/start` 离线 QA；E2E 6 条（含 `/start` 分流）

**小说→漫画改编流水线（2026-06-13）**：
- 用户建议：先通读全书剧情 → 锁定人物/场景一致性 → 按章提炼关键情节 → 再用精简 beats 生成分镜。
- **`fetchComicAdaptationBlueprint`**：全书 `consistencyLock` + 每章 4–8 条 `keyBeats` + `sceneAnchor`。
- **`comic-pipeline`**：始终全书 preread，再拉 blueprint；light 分镜优先用章级 beats（`selectBlueprintBeatsForChunk`）。
- comic doc 持久化 `adaptationBlueprint`；进度文案 `blueprintStart` / `blueprintDone`。
- QA：`qa:comic-novel-product-rules` 含 blueprint 切片断言。

---

## 2026-06-13 — 独立运营控制台（非 /admin 单页）

**背景**：产品/安全/UX 要求运营面与用户面隔离；`/admin` 不应是挂在 C 端导航上的简单页。

**决策**：
1. 默认路径 **`/console`**（`ADMIN_CONSOLE_PATH` / `NEXT_PUBLIC_ADMIN_CONSOLE_PATH` 可自定义；可选 `ADMIN_CONSOLE_HOST` 子域）。
2. **`/admin` → 308 `/console`**；控制台**无 locale 前缀**；`noindex` + `Referrer-Policy` + `X-Frame-Options`。
3. **`AdminConsoleShell`**：深色侧栏 + 模块导航，去掉 `SiteHeader`。
4. 新增 **审计日志 Tab** + `GET /api/admin/audit-log`。
5. 文档：`docs/admin-console.md`；E2E 入口改为 `/console`。

**后续**：计费治理、SSO/2FA、子域 Cookie 隔离、内容安全策略。

---

**背景**：用户定义两条验收路径——(1) 同样提示词做出同样效果；(2) 随机克隆竞品样品后试玩效果一致。

**决策**：
1. 新增 **`qa:competitor-parity-validation`** + `src/lib/qa/canvas-image-parity.ts`：17 款同 prompt 截图对标 + 每日 seed 随机 5 款 duplicate 对标。
2. **硬门禁**：同 prompt 路由+profile 17/17；克隆结构（profile/Scene/无 Agentic）5/5。
3. **视觉门禁**：全局 canvas 阈值；**`COMPETITOR_PARITY_STRICT=1`** 为 gates / nightly / CI bundle-e2e 默认（本地单跑 parity 脚本默认 warn）。
4. 竞品矩阵新增支柱：**同 prompt 效果 parity**、**随机克隆效果 parity**；`qa:competitor-gates` 挂双验证。

**产物**：`qa-output/competitor-parity/` · `qa-output/astrocade-random-pick.json`

---

## 2026-06-13 — samplePlayProfile（Astrocade 式 per-game 定制）

**背景**：纯 template 族 polish 与竞品逐款独立 JS 仍有差距；用户确认可设计每款独立定制逻辑。

**决策**：
1. 新增 **`samplePlayProfile`** 烘焙进 `specJson`（`src/lib/sample-play-profiles/`），duplicate 可继承。
2. **seed / enrich** 时按 `sampleId` 写入；试玩时按 `variantId` 或 `projectId=sample-*` 重新套用 registry（代码升级无需改 DB）。
3. Scene 读 **`spec.samplePlayProfile`** 特征字段，**禁止** blueprint 内 `SAMPLE_MODES[sampleId]` 运行时查表。
4. 门禁：`npm run qa:sample-profiles`（17/17）。

**与 template 族关系**：template 族 = 默认；samplePlayProfile = 竞品样品/克隆的增量定制层。

---

## 2026-06-13 — 平台架构对齐 Astrocade（非单游戏补丁）

**背景**：逐款克隆竞品并加 `SAMPLE_MODES` / 单游戏 QA 不可扩展，与 Astrocade「统一生成→试玩→克隆」平台模型不符。

**决策**：
1. 建立 **`astrocade-architecture.ts`**：三层运行时（Primary Phaser / Secondary Godot / Advanced Agentic）+ 平台不变量 + `resolveAstrocadePlayRoute` / `checkAstrocadeParity`。
2. 玩法变体仅通过 **GameSpec 蓝图 + prompt 语义** 写入 specJson；**禁止** blueprint 运行时 `SAMPLE_MODES[sampleId]`。
3. QA 主门禁改为 **`qa:architecture-parity`**（全模板）；`qa:competitor-clone-compare` 降级为薄包装。
4. 文档：`docs/astrocade-architecture-parity-cn.md`。

**影响**：`*-blueprint.ts`、QA 流水线、PROJECT_MEMORY 优先级。

---

## 2026-06-13 — 用户生成路由专用 Scene（Astrocade 竞对对齐）

**背景**：样品馆走 PhysicsScene / CoasterScene 等专用运行时，polish 明显高于用户路径的 AgenticScene + template fallback。

**决策**：
1. 新增 `dedicatedSceneForTemplateFirst`（默认 `true`）：当模板在 `agenticTemplateFirst` 列表内时，**不 attach `agenticModule`**，路由与样品馆相同的专用 Scene。
2. `AGENTIC_FORCE_LLM=1` 或 `DEDICATED_SCENE_FOR_TEMPLATE_FIRST=0` 可回退旧 Agentic 路径（LLM 定制玩法）。
3. template fallback 模块仍保留，供 `qa:agentic-template-matrix` 与 LLM repair 沙箱使用。

**影响文件**：`product-config.ts`、`game-module.ts`、`generate-game-module.ts`、`projects/route.ts`、QA/E2E 全套。

---

## 2026-05-23 — AI 精灵分类策略

**背景**：AI 生成的 5 张精灵（player/hazard/boss/gem/power）通过 purpose 正则分类到 Godot 参考图系统（background/protagonist/monsters/towerSkins）。塔防场景下 player.png 应作为塔皮肤，但"主角 守护者"匹配 protagonist 正则。

**决策**：
1. **兜底策略**：`writeGodotReferenceAssets` 中增加双向 fallback，若一方为空而另一方有值则自动共享。此策略对所有模板通用，无副作用。
2. **精确策略**：新增 `adjustAiSpritePurposesForTemplate` 辅助函数，按 `spec.templateId` 调整 purpose。目前仅 `towerDefense` 需要特殊处理（player.png → "防御塔 植物 豌豆射手"）。

**原因**：
- 兜底策略简单安全，覆盖未来未知模板
- 精确策略在源头修正分类，避免依赖 fallback
- 两者共存，兜底作为精确策略的保险

**影响文件**：
- `src/lib/godot-export-refs.ts`
- `src/lib/godot-export-workspace.ts`

---

## 2026-05-23 — AI 精灵分类策略

**背景**：AI 生成的 5 张精灵（player/hazard/boss/gem/power）通过 purpose 正则分类到 Godot 参考图系统（background/protagonist/monsters/towerSkins）。塔防场景下 player.png 应作为塔皮肤，但"主角 守护者"匹配 protagonist 正则，导致塔防运行时 towerSkins 为空、塔显示默认几何造型。

**决策**：
1. **兜底策略**：`writeGodotReferenceAssets` 中增加双向 fallback，若 `towerSkins` 为空但 `protagonist` 有值则自动共享纹理，反向亦然。此策略对所有模板通用，无副作用（射击/平台等模板不读取 towerSkins）。
2. **精确策略**：新增 `adjustAiSpritePurposesForTemplate` 辅助函数，按 `spec.templateId` 调整 purpose。目前仅 `towerDefense` 需要特殊处理（player.png purpose 改为"防御塔 植物 豌豆射手"）。

**原因**：
- 兜底策略简单安全，覆盖未来未知模板
- 精确策略在源头修正分类，避免依赖 fallback
- 两者共存，兜底作为精确策略的保险

**影响文件**：
- `src/lib/godot-export-refs.ts`
- `src/lib/godot-export-workspace.ts`

---

## 2026-05-23 — AI 精灵分类策略（Godot 参考图系统）

**背景**：AI 生成的 5 张精灵（player/hazard/boss/gem/power）通过 `purpose` 字段的正则表达式分类到 Godot 参考图系统的四个类别：background / protagonist / monsters / towerSkins。塔防模板下 `player.png` 应作为塔皮肤，但硬编码 purpose "主角 守护者" 匹配 protagonist 正则，导致塔没有自定义贴图。

**决策**：
1. **兜底策略**：`writeGodotReferenceAssets` 中增加双向 fallback——若 `towerSkins` 为空但 `protagonist` 有值则自动共享纹理，反之亦然。此策略对所有模板通用，无副作用。
2. **精确策略**：新增 `adjustAiSpritePurposesForTemplate` 辅助函数，按 `spec.templateId` 调整 purpose。目前仅 `towerDefense` 需要特殊处理（player.png purpose 改为 "防御塔 植物 豌豆射手"），使其被 `classifyReferencePayloads` 正确分到 towerSkin。

**原因**：兜底策略简单安全，覆盖未来未知模板；精确策略在源头修正分类，避免依赖 fallback。两者共存，兜底作为精确策略的保险。

**影响文件**：
- `src/lib/godot-export-refs.ts`
- `src/lib/godot-export-workspace.ts`

---

## 2026-05-17 — 产品配置内聚

- **业务参数不进 `.env`**：模型 ID、超时、限流、漫画并发、长篇分段等统一在 **`src/lib/product-config.ts`**（长篇分段细节在 **`novel-long-config.ts`**）。**.env 仅密钥与网关**（`OPENAI_API_KEY`、`OPENAI_BASE_URL` 等）。发版改行为改代码并走 CI，避免终端用户/运营误配环境变量。
- **网关超时**：默认 `x-openclaw-timeout-ms` 由 product-config 注入；小说 **`createNovelOpenAIClient(tier)`** 按篇幅覆盖（中篇 10min、长篇 30min）。
- **测试资产入库**：`prisma/ci.sqlite`、`public/covers/openai-*.png` 等无敏感信息样例随仓库提交，供 E2E/手测/文档对照。

## 架构决策（三轮追加）

- **Director「B 档」对齐**：`buildDirector` 固定 **`actCount = 4`**（开场 / 加速 / 变奏 / 终局），便于各模板章节 banner 与难度弧线一致；**`avoider` / `collector` / `survivor`** 在随机 roll 之后 **保底注入 `coinRain`、`goalShift`、`miniBoss` 各至多一次**（模板差异化 title/message），避免一局「像无尽而没有关卡结构」。  
- **生成 JSON Schema（可选 director）**：默认不设 **`GAME_SPEC_JSON_SCHEMA_INCLUDE_DIRECTOR`**，LLM json_schema 仅绑定核心 GameSpec；设为 **`1`** 时允许可选输出 **`director`**。**`coerceGameSpec`** 对任意来源只要 Zod 通过即保留 **director / systems**。  
- **游戏生成产品形态**：不再把 `/create` 定义为“单轮 prompt -> 一次生成”，而是正式升级为 **4 步共创流程**：输入创意 → 提炼意图 → 候选方向 → 生成试玩。**B 档扩展目标**：在同一项目上叠加 **多回合 refinement**（见 `TASK_QUEUE`）。  
- **项目版本真相源**：`Project.prompt + Project.specJson` 作为游戏创作真相源；试玩页 patch 与 quick tune 允许回写项目，避免一次性产物。  
- **再编辑入口**：`/create?from=` 必须恢复 **完整项目上下文**（至少 prompt + spec），而不是只恢复旧 prompt。  
- **共享玩法层策略**：优先把 `systems.skill` 与 `director.events` 真正接入模板运行时，再继续扩 schema；先从 `shooter` 和 `towerDefense` 落地。  
- **塔防标杆策略**：TowerDefense 继续作为第一标杆模板，通过 **rush / elite / 守点事件 / 经济奖励** 抬高可玩性，而非仅做视觉换皮。

- **文生图主路径**：生产环境以 **OpenAI 兼容网关**（`IMAGE_GEN_OPENAI_MODEL`，默认 `gpt-image-2`）为准；**ComfyUI 仅当配置 `COMFY_UI_BASE_URL`**，且当前实现为逐张串行、内置 SDXL 工作流，与用户自建 Comfy 工具链不一致。  
- **短篇配图批量**：≤`IMAGE_GEN_BATCH_PANELS`（默认 4）格时 **单次 `images.generate` + `n=4`** + 合并 prompt；失败降级 **4 路并行逐张**。  
- **长篇漫画创建**：`panelCount > 4` 时 **不在 `POST /api/comic/generate` 内联配图**，状态 `pending_images`，由 **`POST /api/comic/[id]/panels/stream`** 流式补图（避免平台超时）。  
- **小说广场删除**：列表 API 返回 **`isOwner`**（不暴露 `ownerKey`）；仅作者在广场卡片可删；关联漫画 **级联删除**（Prisma `onDelete: Cascade`）。  
- **客户端耗时文案**：`formatImageGenElapsed` 放在 **`src/lib/format-duration.ts`**，禁止详情页从 `comic-panel-render` 导入（会拖入 `image-generation` → `fs`）。

## 2026-06-14 — 文学生产链 vs 单点生成

- **产品定位**：Operone 小说/漫画目标是 **长期连载的内容生产链**（对标 [轻灵AI 创作流程](https://www.qinglingdesign.cn/#features)），而非一次性随机生成。
- **五步工作链（MVP UI）**：`LiteraryProductionChain` — ① 大纲与情节推进 → ② 章节扩写 → ③ 角色一致性（资料+参考图）→ ④ 分镜结构化 → ⑤ 漫画生成与修正（项目内重绘/迭代）。
- **已有能力映射**：Brief/续写/章节规划（①②）、`characterRoster`+参考图生成（③）、导演包/light 分镜（④）、单格重绘+panels SSE（⑤）。
- **P1 缺口（2026-06-14 已闭合）**：工作室/详情页按项目状态高亮当前步 ✅；独立「角色资产库」UI ✅；可视化分镜编辑器 ✅；roster 服务端 Prisma ✅。
- **P1 仍待**：生产 SMTP；四档小说+漫画全量实机 QA（无 skip env）；Console SSO 生产 IdP。
- **账号**：邮箱注册 MVP（验证码 10 分钟、60s 冷却）；生产需 SMTP；dev 用 `EMAIL_AUTH_DEV_EXPOSE=1`。

## 架构决策

- **Studio「我的作品」**：游戏走 `/api/projects`（须 owner Cookie）；小说 / 漫画列表用 **`GET ?mine=1`**，与公开发现页（无 `mine`）分离。  
- **漫画分镜 LLM 输出**：不再要求模型 **恰好** 返回目标页数 × 4 格；服务端用 **`normalizeComicPagesForGeneration`** 补齐，降低 502 率。  
- **生成 API 请求体**：默认上限 **524288 字节**（`PRODUCT.api.bodyMaxBytes`）。

## 技术取舍

- **`director.events[].type` 未知**：各 Scene 仅对 `coinRain` / `goalShift` / `miniBoss` 做玩法映射；其它类型 **只展示横幅并按 `durationMs` 结束**，不改变 scoreMult / 刷怪池等，避免脏规格拖垮一局。  
- **`director.acts[].modifiers` 未知**：各模板用 `includes()` 识别；**未识别 modifier 静默忽略**。  
- Studio 加载：**部分失败仍展示已成功列表**，错误文案拼接展示，避免笼统「网络异常」。  
- `projects` **401**：视为「暂无游戏」，不阻断小说 / 动漫列表。  
- `mine=1` 且无 owner Cookie：返回 **空列表**（200），与 `projects` 401 策略略不同（历史兼容）。  
- 漫画路由 **未** 固定 `maxDuration`（避免部分运行环境空白 500）；长跑超时由部署平台配置。

## 历史兼容要求

- `parseComicImageUrls` 仍兼容旧版 **panel 数组** 存 `imageUrls`。  
- 公开列表 API 行为不变（无 `mine` 参数时仍为广场列表）。

## 禁止修改部分

- 勿在 `PROJECT_MEMORY/` 写入密钥、token、`.env` 原文。  
- 无用户明确要求时 **不代 git commit / push**（用户规则）。
