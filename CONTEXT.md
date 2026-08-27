# 项目工作进度快照
最后更新：2026-08-27（生产创作链路复查）

## 生产验收（本会话）

- 小说 / 小说转漫画：通过。`openrouter/free`；改编漫画分镜 `doubao-seed-2-1-turbo-260628`。
- 游戏创作 + 模型：通过。`litellm · deepseek-v4-flash-ga-260731` 已落库（`cmtbowrf6000d2yjp32ldru1x`）。
- 游戏 60s 试玩：未过。collector 468ms 内失败；QA 未点到「再来一局」。待部署 collector 无敌窗。

## 当前状态
- 游戏：LLM-first，内核只校验。文档 `docs/game-generation-pipeline.md`。
- 小说/漫画：**本来就是 LLM 作者**（没有 Phaser 内核可锁）。缺口是采集：长篇草稿、分镜 checkpoint、长导演/应急 `provider: ""`。
- 已补：草稿创建即写模型；checkpoint 带 provenance；空 provider 改为 `getActiveProvider()`。
- 铁律文档：`docs/literary-generation-pipeline.md`。
- 后台这一对字段记正文/分镜 LLM；逐格文生图不覆盖。

## 本会话修改文件表
- `src/lib/novel-generate-checkpoint.ts` / `src/app/api/novel/generate/stream/route.ts` — 长篇草稿创建即写 provenance
- `src/lib/comic-generate-run.ts` — 分镜 checkpoint 带 provider/model
- `src/lib/comic-pipeline.ts` — 长导演与应急分镜不再写空 provider
- `docs/literary-generation-pipeline.md`、`PROJECT_MEMORY/DECISIONS.md`

## 下次启动清单
1. 读 `docs/literary-generation-pipeline.md`（若动小说/漫画）。
2. 新小说/漫画在 `/console?tab=works` 应有 `provider · model`，不应因空 provider 变成「未记录」。
3. 游戏线仍见 `docs/game-generation-pipeline.md`。

## 会话记录（按日期追加）
### 2026-08-27 · 文学线采集
- 结论：不要给小说/漫画加内核作者。补草稿与空 provider 采集。
- 状态：`tsc` 与 `qa:work-generation-meta` 通过，准备提交部署。

## 当前状态
- 游戏默认管线改为 **LLM 围绕提示词出 spec**，内核只校验/兜底（`pipeline` 缺省 `"llm"`）。
- 采集与管线分离：debug 带 provider/model/scene/kernelFallback；空 debug 不再推断成 kernel。
- 铁律文档：`docs/game-generation-pipeline.md`（下一任必读）。
- 编译 / QA：`npx tsc --noEmit` 通过；`qa:work-generation-meta`、`qa:game-generation-kernel`、`qa:game-production-contract`、`qa:game-delivery-readiness` 通过。

## 本会话修改文件表
- `src/lib/generate-spec.ts` — 默认 llm-first；校验失败才 kernel fallback；debug 打全 provenance
- `src/lib/game-generation-plan.ts` — 注释改为「校验/兜底，不当作者」
- `src/lib/work-generation-meta.ts` — 真实模型优先于 source=kernel
- `src/lib/multi-agent-spec.ts` — 返回 model/scene
- `src/app/api/projects/route.ts` — 去掉空 debug→kernel 推断
- `src/app/create/CreateClient.tsx` — 上送 kernelFallback；source 不再默认 kernel
- `src/app/api/generate/stream/route.ts` — 进度文案改为围绕描述生成
- `scripts/qa-work-generation-meta.ts` / `qa-game-generation-kernel.ts` 等
- `docs/game-generation-pipeline.md`、`PROJECT_MEMORY/DECISIONS.md`、`CONTEXT.md`

## 下次启动清单
1. 读 `docs/game-generation-pipeline.md`（若动游戏生成）。
2. 生产实测：新游戏在 `/console?tab=works` 应显示真实 `provider · model`，不应再把 LLM 作品标成「内核编译」。
3. 「萤火虫护送」类提示词走默认管线时，玩法由模型选模板，不再被正则锁成 collector（无模型时内核兜底仍可能是 collector，那是兜底不是作者）。

## 已完成功能全表
- 管理后台作品表：日期 + 生成模型列（pending / works 共用）。
- 小说 / 漫画生成路径已写 provenance；游戏现与管线决策对齐。

## 会话记录（按日期追加）
### 2026-08-27 · LLM-first + 采集
- 操作：默认生成改为 LLM 作者；内核只 validate/fallback；采集补全；写决策文档。
- 状态：本地 QA 通过，准备提交部署。

> 本文件已按当前决策重建，只保留今天的项目状态、发现与计划，不保留旧会话历史。

## 当前状态（本会话）

- **复查范围**：生产环境游戏 / 小说 / 小说转漫画创作流程，以及后台业务模型路由是否真正生效。
- **生产现状（修前）**：健康检查通过，但近期游戏/小说/漫画 `generationProvider` / `generationModel` 大量为 null；游戏资产 worker 写死 `zh-Hans`，localeRoutes 在 job 内不生效；小说转漫画在列表无正文时不拉详情。
- **已修**：
  - 游戏保存按 debug 落 provenance；**空 debug 保持未记录**，不再推断成 kernel。owner GET 项目返回 provenance。
  - 游戏资产任务带请求 locale；worker ALS 注入 `uiLocale`，`runtimeLocaleGroupForCurrentRequest` 优先读 job locale。
  - 长导演分镜 `provider` 不再空字符串；漫画 SSE 加 `X-Accel-Buffering: no`。
  - 小说/漫画详情 owner 返回 generation 字段；短篇写作传递 AbortSignal。
  - 漫画创作选中小说后拉详情并 merge 正文；分镜按钮带上 `content`。
  - SSE `consumeSSE` 结束 flush 尾包，避免 provenance 丢失。
- **本地验证**：`npx tsc --noEmit` 通过；`qa:work-generation-meta` 通过；`qa:runtime-locale-routing`（含 job locale）通过。
- **生产实测（小说 / 小说转漫画）已通过**（约 16 分钟）：
  - 小说 `cmtbnmf56000xglpm5xxj9io8`：SSE 与落库均为 `openrouter/free`（1598 字，非 mock）。
  - 改编漫画 `cmtbnwqxj001nglpmqtswhtg3`：分镜模型 `doubao-seed-2-1-turbo-260628`（与中文池 comic_storyboard 一致），已绑定该小说。`generationProvider` 仍可能为空字符串规范化成 null，模型已落库。
- **游戏实测**：SSE 已发出；模型路由生效为 `litellm · deepseek-v4-flash-ga-260731`。失败点是 LLM spec 缺 production 合同（levelFlow/audio 等），校验把整份规格换成内核并标 `fallback:true`。已改为只补 production 合同，不再因此整份替换。

### 下次启动清单

1. 提交并部署 production 合同回填修复。
2. `$env:QA_PROD_GAME_CREATE="1"; npm run qa:prod-game-create-delivery`
3. 强刷 `/console?tab=works`：新小说/漫画应显示真实模型；新游戏应显示 LLM 模型而非仅内核。
4. （遗留）`GamePlayerInner.tsx` `telemetry.start()` 类型参数。
5. （已知）漫画 provenance 的 provider 在轻分镜路径仍可能为 null；模型字段已生效。

## 1. 产品与技术现状

### 产品定位

Operone 是一个多形态 AI 创作平台，包含三条独立产品线：

1. **游戏**：一句话创作、试玩、发布与社区发现。
2. **小说**：从灵感、故事圣经、章节规划到长篇续写和阅读。
3. **漫画**：从创意、脚本、分镜、角色设定到逐格配图和发布。

三条线共享账户、工作台、创作入口、作品展示、国际化与部分资产能力；生成链路彼此独立，不能因输入相同而默认互相创建或绑定内容。

### 当前技术架构

- Next.js 16 + React 19 + TypeScript + Tailwind 4 + next-intl（5 种语言）。
- Prisma；当前默认 SQLite，生产目标应迁移 Postgres。
- 游戏：**Phaser 2D 唯一主运行时**、模板优先路由、GameSpec 驱动（Godot 双轨已从 CI/产品门禁退役）。
- 游戏资产：背景、精灵、封面、运行时 asset manifest、音效/音乐、粒子与镜头反馈。
- 小说：长篇故事圣经、角色表、章节计划、续写、检查点、一致性/完整性修复。
- 漫画：导演包、角色 roster、角色参考图、分镜脚本、分格图像渲染、局部重绘。
- 通用能力：登录、工作台、分享、评论、样品馆、发现页、管理控制台、额度与订阅数据模型。

## 2. 已完成的展示体验改造

### 已发现问题

旧版手机首页把游戏、小说、漫画、站点入口拆成多组横向滚动导航卡片。导航占据大面积首屏，用户尚未理解产品价值就先面对复杂信息架构；窄屏展开体验差，首屏转化路径不清晰。

### 已交付

| 文件 | 完成内容 |
|---|---|
| `src/components/SiteHeader.tsx` | 将移动端多组横向滚动导航收敛为 61px 工具栏和可展开全量导航面板；游戏、小说、漫画、首页、创作、工作台入口均保留。 |
| `src/app/page.tsx` | 缩减手机首屏留白，放大核心价值主张；“立即开始创作”成为整行主操作，案例与工作台为次级入口。 |
| `e2e/home-mobile-ux.smoke.spec.ts` | 新增 375×812 手机端回归：首屏可见、无横向溢出、菜单包含游戏创作与工作台入口。 |

### 已完成验证

- `npx tsc --noEmit`：通过。
- `npx eslint src/app/page.tsx src/components/SiteHeader.tsx e2e/home-mobile-ux.smoke.spec.ts`：通过。
- `npx playwright test e2e/home-mobile-ux.smoke.spec.ts --workers=1`：1 passed。
- 浏览器实测 375×812：首屏可见、无横向溢出、导航弹层完整可见。

### 验证边界

- 全仓 `npm run lint` 已启动但因仓库扫描耗时过长被主动停止，不能视为全仓 lint 通过。
- 本次未做生产构建、未部署、未提交或推送。
- Playwright 测试会写入 `prisma/prisma/ci.sqlite` 测试库；提交前需按仓库约定处理该测试产物。

## 3. 商业化差距

### P0：不能正式收款

1. **真实支付未完成**：账单页固定使用开发模拟支付；订单仅写入内部 `PaymentEvent`，不会生成微信/支付宝真实付款凭证、二维码或跳转链接；回调仍是开发级密钥判断，缺少支付方原生签名验证、证书轮换、幂等对账和异常处理。
2. **订阅生命周期不完整**：缺少真实续费、主动取消、退款、拒付、失败重试、账期对齐、权益回收和账单通知。
3. **成本和毛利不可控**：当前只有套餐额度，尚未按模型、图片、重试、导出、存储记录成本；需要余额、限额、预估提示、超额加购和毛利熔断。

### P1：不能稳定商业运营

1. **生产基础设施**：默认 SQLite 与本地资产路径不适合正式高并发生产；需要 Postgres、对象存储、异步队列、失败重试、备份和恢复演练。
2. **漏斗与归因**：缺少首页访问 → 注册 → 首次生成 → 首次发布 → 付费的统一事件、渠道归因、留存分群和关键业务告警。
3. **企业交付**：专业版已有客服/审核承诺，但团队空间、组织权限、审计、合同、发票、SLA、内容治理未形成闭环。
4. **合规与信任**：需补齐用户协议、隐私政策、数据导出/删除、版权和商业授权、退款、发票和未成年人内容治理。

### 商业化推进顺序

1. 接通真实微信/支付宝支付、原生验签、订单对账和订阅生命周期。
2. 落地模型/资产级成本账本、套餐额度、按量加购与毛利护栏。
3. 接入转化漏斗、留存、付费、失败率和成本告警。
4. 建设企业化与合规信任层。

## 4. 产品质量总原则

### 当前核心问题

项目已有较强的“生成能力”，但尚未统一形成“生成成功不等于成品合格”的质量体系。未来每条产品线必须走如下闭环：

```text
用户输入
  → 创意 Brief / 体验承诺
  → 受控生产链
  → 自动质量评审 + 真实运行验证
  → 达标发布；不达标进入定向修复
```

### 质量系统边界

- 不重建现有模板优先、GameSpec、小说长篇、漫画导演包等既有架构。
- 不允许一句话无限制生成任意代码或素材后直接发布。
- 质量治理建立在现有受控模板、资产流水线、一致性数据和 E2E 能力之上。
- 每条线都要具备：生成前约束、生成中检查、发布前门禁、发布后真实数据。

## 5. 游戏：从“能运行”提升到“真正好玩”

### 当前已有基础

- 模板优先路由和专用 Phaser 场景，避免任意生成代码导致白屏和不可玩。
- GameSpec、玩法 blueprint、样品 profile、Phaser/Godot 双轨。
- 背景、精灵、封面、运行时 asset manifest、场景视觉 cohesion。
- 音效/音乐事件、`gameJuice`、粒子、镜头震动、连击、HUD 指引与可玩性 QA。

### 核心差距

1. “主题/规则可生成”，但缺少对首分钟节奏和玩家乐趣的硬性设计约束。
2. 背景、精灵、封面可分别生成，但还没有贯穿角色、场景、UI、特效和镜头的完整美术圣经。
3. 角色可能停留在静态或弱动作资产，缺少标准化状态机与动作质量验收。
4. 音乐、动作音效、受击反馈已有底层能力，但没有按玩法自动编排成完整情绪曲线。
5. 当前更多验证“能加载、能点击、无白屏”，尚未验证“有目标、选择、张力、奖励和重玩动机”。

### 目标生产链

```text
一句话
  → 玩家幻想：我是谁、要做什么、爽点是什么
  → 核心循环：输入 → 反馈 → 风险/选择 → 奖励
  → 已验证的玩法模板和首分钟节奏
  → 统一美术、角色、UI、音效、音乐、特效资产包
  → 自动试玩 + 质量门禁
  → 达标发布 / 定向修复
```

### 游戏质量合同

#### 1. 体验 Brief，而不是直接转代码

每个游戏必须明确玩家身份/幻想、一个主动作、一个主爽点、失败风险、短期奖励和目标设备。默认手机单手可玩；横屏仅在玩法明确需要时启用。

#### 2. 首分钟节奏合同

| 时间 | 必须发生的体验 |
|---|---|
| 0–5 秒 | 看懂目标并完成第一次输入。 |
| 5–20 秒 | 首次正反馈：命中、收集、合成、成长或成功躲避。 |
| 20–40 秒 | 出现新变化：难度、敌人、组合、路线或策略选择。 |
| 40–60 秒 | 出现小高潮、阶段奖励、升级或明确的“再玩一次”动机。 |

#### 3. 美术：Art Direction Pack

每个作品要生成并锁定一份美术包：风格关键词、主辅色、明暗材质、镜头距离与视角、角色剪影与比例、服装表情、道具、特效色、UI 字体与按钮规则。封面、游戏内背景、角色、道具、特效必须引用同一美术语义和资产锚点。

现有 `CohesivePresentation`、背景/精灵/封面流水线应升级为该 Pack 的执行载体，而不只做色彩协调。

#### 4. 角色：从“一张图”到可行动资产

最小动作集：idle、move、jump/dash、attack/use、hurt、victory/fail。每个动作要有时长、关键帧、位移、特效、音效和受击关联。Phaser 使用明确状态机；生成精灵必须检查透明边缘、尺寸、朝向、帧数和动画循环。

攻击类玩法必须包含前摇、命中帧、命中停顿、后摇和目标反馈。

#### 5. 手感与打击：关键输入的三层反馈

1. **视觉**：闪白、粒子、拖尾、数字、受击动画、命中特效。
2. **镜头/时间**：轻微震动、hit-stop、慢放或镜头推拉，只在关键时刻触发。
3. **听觉/状态**：动作音效、命中音、连击音阶变化、分数/血量/资源变化。

现有 `gameJuice` 与 Soundscape 必须由模板语义驱动，不能依赖场景临时拼接。

#### 6. UI 与移动端

- 只显示当前决策所需的信息；HUD 不得长期遮挡玩法区。
- 开局教学在用户理解操作后自动淡出。
- 触控目标不小于 44px，核心操作处于单手可达区。
- 开局、失败、胜利和重试必须在手机端一屏内完成。
- 所有模板都要在 375px、弱性能设备和触控输入下验证。

#### 7. 音乐与声音

每个模板至少有四种状态：菜单/准备、常态、紧张/连击、胜利/失败。输入、命中、拾取、升级、受伤、失败和胜利有独立且可辨识音效；连击、临近失败、Boss 或阶段目标应改变音乐张力。

### 游戏发布门禁

| 门禁 | 最低标准 |
|---|---|
| 运行 | 手机端无横向溢出、无控制台错误、60 秒内无卡死或软锁。 |
| 可理解 | 5 秒内显示目标与操作，首次操作有明确反馈。 |
| 可玩 | 首分钟至少 3 次有效决策、1 次变化、1 次阶段奖励或失败重试。 |
| 手感 | 核心动作均有视觉、音效、状态三层反馈。 |
| 美术 | 封面、角色、场景、UI、特效使用同一 Art Direction Pack。 |
| 真实体验 | 自动试玩/E2E、Canvas 截图评审和真实用户首分钟数据共同通过。 |

### 游戏优先级

1. **P0：旗舰模板垂直切片**：先做跑酷、消除、物理解压、平台跳跃、农场五类，补齐首分钟节奏、美术包、角色动作、音画和质量门禁。
2. **P1：质量评分系统**：玩法、美术一致性、移动端交互、运行稳定性、首分钟遥测写入统一 scorecard；不达标作品不能直接公开发布。
3. **P2：扩展**：将已验证的质量语义包扩展到其余模板，不平均地给所有模板加少量效果。

## 6. 小说：从“能续写”提升到“值得读完”

### 当前已有基础

- 长篇故事圣经、角色信息、章节计划、断点续写、检查点、完整性和一致性修复。
- 章节编辑与移动端阅读组件。

### 核心差距与标准

1. 现有链路偏“章节生成”，尚未把读者留存目标变成质量门槛。
2. 需要更严格检查开篇钩子、章节推进、人物口吻、因果、伏笔回收和重复注水。
3. 故事圣经必须成为全过程不可违反的编辑约束。

质量标准：开篇 800 字内给出角色、冲突、悬念；每章完成推进/反转/揭示/关系变化/收束之一；角色目标、能力、关系、口吻、时间线不漂移；章节末形成继续阅读动机；长篇可追踪伏笔与回收；手机阅读舒适且连续。

### 小说生产链与计划

```text
故事承诺 → 故事圣经 → 全书大纲 → 章节卡 → 草稿
→ 连续性/节奏/重复检查 → 定向润色 → 阅读体验检查 → 发布
```

1. 为每章增加开篇钩子、推进、人物一致性、重复率、章节结尾张力评分。
2. 发生问题时只重写对应章节/段落，不重生成整部作品。
3. 采集章节完成率、跳出位置、续读率和编辑率，反哺生成策略。
4. 不同题材定义文风合同与示例，禁止一个通用模型语气覆盖所有作品。

## 7. 漫画：从“逐格出图”提升到“能翻页的作品”

### 当前已有基础

- 导演包、角色 roster、角色参考图、风格引用、分镜脚本和面板级渲染。
- 已有“角色设定图优先”和避免无参考批量出图造成画风漂移的保护逻辑。

### 核心差距与标准

1. 单格图像可用不代表整页叙事、人物一致性和阅读节奏成立。
2. 场景、道具、时间、光线和镜头语言也需要持续记忆。
3. 文本气泡、人物脸部、关键动作和画面安全区需要版式校验。
4. 必须先评“页”，再评“格”；单图评价不能覆盖跨格动作和视线连续性。

质量标准：先锁定角色外观、服装、表情、比例和关键道具；每页有建立/推进/情绪/转折/页尾钩子之一；镜头、角色方位、视线、光线、场景跨格可解释；对白不可遮挡关键信息；重绘必须是局部可控修复。

### 漫画生产链与计划

```text
故事/创意 → 导演包 → 角色/场景/道具设定图
→ 页级分镜与文字安全区 → 锚定首格 → 逐格渲染
→ 页级一致性与阅读节奏检查 → 局部重绘 → 发布
```

1. 将参考资产扩展为角色、场景、关键道具三类锚点。
2. 新增页级质检：角色一致性、镜头连续性、文本安全区、对白可读性、页面节奏和页尾钩子。
3. 建立局部修复：只改指定角色、脸部、服装、道具、文字区或单个镜头，不全页重画。
4. 以移动端竖向阅读验证翻页完成率、停留时长、重绘率和阅读中断位置。

## 8. 跨产品线数据与商业化联动

### 必须采集的数据

- 游戏：首分钟完成率、失败位置、重试率、核心动作使用率、首局时长、分享率。
- 小说：开篇后续读率、章节完成率、跳出位置、编辑率、继续生成率。
- 漫画：页面完成率、格级重绘率、阅读停留、分享率、角色/画风问题反馈率。
- 商业：注册转化、首次成品率、免费额度耗尽率、付费转化、单作品成本和毛利。

### 商业化原则

质量能力应成为付费价值，而不只是售卖次数：高质量导出、高清资产、长篇一致性、角色资产包、商业授权、优先队列、团队协作和企业审核都可成为可解释的付费权益。套餐必须受真实成本、成品成功率和用户留存数据约束。

## 9. 下一步执行清单

1. 确认旗舰游戏垂直切片范围，建议跑酷、消除、物理解压、平台跳跃、农场五类。
2. 为这五类建立体验 Brief、首分钟节奏合同、Art Direction Pack、角色动作合同和发布门禁。
3. 实现统一质量 scorecard，并接入现有游戏生成、试玩与作品发布链路。
4. 为小说和漫画分别补齐章节级/页级质量评分与定向修复入口。
5. 同步推进真实支付、成本账本和转化事件；没有这些数据不能正确验证质量投入是否带来商业结果。
6. 首批质量门禁稳定后，再扩展到其余模板和企业化能力。

## 10. 当前交接状态

### 本次完成

- 移动端首页和导航完成首轮改造并通过定向验证。
- 商业化差距完成审计并记录。
- 三条产品线的质量问题、边界、标准和推进计划完成定义。
- 游戏首批质量能力已落地：新增 `src/lib/game-vertical-slice.ts`，为跑酷、消除、物理解压、平台跳跃、农场五类生成物建立固定的 0–5 / 5–20 / 20–40 / 40–60 秒体验合同。
- 生成链路在所有规格收敛后计算确定性的 `verticalSlice` 评分卡并写进 `GenerationDebug` 与编排追踪；评分维度为目标清晰度、节奏、操作选择、表现层和手感。评分卡现已包含 Art Direction Pack：实际解析的画风、着色、粒子、动画档位、音乐/SFX、创意锚点，以及五类旗舰游戏各四个关键动作节点。它不调用模型、不改变运行时玩法，也还不是自动拦截发布的硬门禁。
- 新增 `npm run qa:game-vertical-slice`：五类旗舰模板必须有四段首分钟合同，节奏和表现层达到最低分，且不得被判为 `blocked`。已通过 TypeScript、该新增检查和现有三项游戏质量合同检查。
- 已补齐最小化匿名试玩事件链：`GameplayEvent` 只记录作品（可空）、模板、随机回合 ID、事件、时长、分数、胜负和静态质量分；明确不存 prompt、原始输入、用户身份或设备指纹。试玩开始、首次操作、满一分钟、结算、重试都会 fire-and-forget 上报，不影响对局。对应前向迁移为 `20260822020000_add_gameplay_event`，尚未在生产应用。管理后台概览已接入启动数、首次操作率、首分钟完成率、重试、平均失败时长和平均质量分。

### 本次未做

- 未实现真实支付、成本账本、漏斗分析或生产基础设施升级。
- 未实现运行时资产生产/角色状态机本体，以及将首分钟质量 scorecard 及试玩遥测接入管理看板和作品发布硬门禁。
- 小说/漫画质量已细化到章节/页面：小说未达标章节可一键聚焦编辑，漫画当前页可复用既有的页面重绘与单格文本修改入口。
- 未做生产部署、全仓 lint、全量 E2E 或推送。

### 接手顺序

1. 运行 `npx tsc --noEmit` 确认基线。
2. 为试玩看板增加按模板/质量分的下钻和核心动作使用率，再用真实数据校准评分阈值。
3. 补齐运行时资产生产与角色状态机本体，再将稳定的评分卡逐步接入作品发布门禁；不要跳过可玩性验证而只增加视觉特效。
4. 为小说和漫画分别补齐章节级/页级评分与定向修复入口。

### 本轮续接：统一质量 API（提交 `ae00cd48`，未推送）

- 新增 `src/lib/creator-quality.ts`，把游戏既有 vertical slice、小说完整性/章节/重复率、漫画页格/文字/锚点/渲染完成度收敛为共享 `CreatorQualityReport`。评分仅输出证据和建议状态，未启用发布拦截。
- 游戏 `POST /api/projects`、游戏详情、小说普通/流式生成与详情、漫画生成与详情现在均返回统一的 `workflow: { stage }` 和 `quality: { verdict, score, evidence[] }`。
- 新增 `npm run qa:creator-quality`；在真实本机开发服务中抽取公开的游戏、小说、漫画作品并确认三类详情 API 都返回质量外壳。
- `20260822020000_add_gameplay_event` 已在全新的临时 SQLite 数据库用 `prisma migrate deploy` 完整验证，之后移除了临时数据库；生产库未迁移。
- 本轮验证：`npx tsc --noEmit`、定向 ESLint（0 error）、`qa:creator-workflow`、`qa:creator-quality`、`qa:game-vertical-slice`、`qa:gameplay-telemetry`、`npx prisma validate` 均通过；`next build` 成功生成 `.next/BUILD_ID` 和生产 manifests。定向 ESLint 的两个未使用类型告警已在改动文件中清理。

### 本轮续接：创作台质量修复闭环（待提交）

- 新增 owner-only `GET /api/studio/quality`：在服务端对最近 100 个游戏、小说、漫画分别评估，仅返回 `workflow` 与 `quality` 摘要。小说正文不再随工作台列表传输。
- 创作台汇总并显示质量判定、分数和前两条证据；质量未达标作品会进入“质量检查”优先列表，并提供直达详情编辑/修复的入口。返回工作台会重新拉取评估结果，构成“评估 → 修复 → 再评估”闭环。
- 本轮验证：`npx tsc --noEmit`、目标 ESLint、五份 locale JSON 解析、`qa:creator-quality`、`qa:creator-workflow` 均通过；真实开发服务验证质量 API 的未授权 401 与 owner 会话 200。浏览器实际加载工作台无前端错误，但该浏览器会话没有作品，因此未能观察到非空质量卡。

### 本轮续接：章节/页级质量与局部修复（待提交）

- `CreatorQualityReport` 现在可携带可修复单元：小说按章节返回 `chapter-N`，漫画按页面返回 `page-N`，每项都有独立分数、判定和证据。
- 小说详情对 owner 展示章节质量，并将“去修复”直接聚焦到既有章节编辑器的目标章；漫画详情对当前页展示页级质量，未达标且已有配图时复用既有“重绘本页”确认流程，空页仍走已有的开始渲染流程。
- 修复交接中两处目标 lint 遗留：漫画渲染 ETA 改用状态快照而非渲染期读 ref；小说创作 URL 参数改为初始化解析，避免 effect 内同步派生状态。
- 本轮验证：`npx tsc --noEmit`、上述核心文件 ESLint（0 error/0 warning）、`qa:creator-quality`、`qa:creator-workflow` 均通过。真实开发 API 对公开作品实测：小说返回 `chapter-1`，漫画返回 8 个 `page-N` 单元。

### 本轮续接：消费数据进入详情质量报告（待提交）

- `CreatorQualityReport.engagement` 增加匿名汇总消费信号，不含账号、提示词、输入或设备指纹；该层只追加证据，不会静默改写静态质量分或启用发布拦截。
- 游戏详情聚合已保存作品的 `GameplayEvent`，返回启动样本、首操作率、首分钟率、重试率、平均失败秒数；小说返回已有阅读/点赞计数，漫画返回点赞计数。
- 本轮验证：`npx tsc --noEmit`、目标 ESLint、`qa:creator-quality`、`qa:gameplay-telemetry` 均通过。真实开发 API 对公开小说确认 `reads:2, likes:0`、公开漫画确认 `likes:0`；该测试 cookie 下没有自有游戏，因而无法实测非空游戏事件聚合。

### 下一步（按优先级）

1. 在后台增加媒介/模板的质量明细，基于上述观测信号校准阈值；在有足够样本前不阻断发布。
2. 完成五个旗舰模板的运行时角色状态机、资产制作和真实 60 秒 E2E 后，再把质量门禁分阶段启用。
3. 建设成本账本、转化漏斗与毛利报表，并基于真实数据校准套餐权益。
4. 真实支付、生产迁移/部署需在具备商户凭据、财务规则和发布窗口后单独执行；不得以当前开发模拟支付替代。

## 本轮续接：后台媒介/模板质量明细（待提交）

- `GET /api/admin/analytics` 现对每种媒介最多聚合最近 200 部作品的确定性质量结果，返回已评估、就绪、待润色、阻断和平均分；响应不会携带正文、prompt、作品 ID、owner 或图片 URL。
- 游戏模板同时显示静态质量均分/就绪数和匿名试玩启动、首分钟率；无法解析的历史规格不计入低分样本，零样本不构成发布门禁。后台概览与五语文案已接入。
- 验证：TypeScript、定向 ESLint、五语 JSON、`qa:creator-quality`、`qa:gameplay-telemetry` 均通过。

## 本轮续接：运行时兼容与真实首分钟验收（待提交）

- 对旧 Prisma Client 增加安全降级：长驻进程尚未加载 `GameplayEvent` 时，游戏详情与后台分析仍可工作并报告零样本；遥测写入返回非阻断 503，避免把作品误判为损坏。
- 新增五个旗舰模板的 `e2e/flagship-first-minute.spec.ts`，每条真实等待 61 秒，随后检查启动、首次操作和首分钟事件已进入质量报告；`e2e/global-setup.ts` 改为直接运行本地 Prisma CLI，不再依赖 Windows `npx` shim。
- 验证：`node node_modules/typescript/bin/tsc --noEmit`、定向 ESLint、`qa:creator-quality`、`qa:gameplay-telemetry`、已有 avoider 试玩 E2E 均通过。
- 未通过项：avoider 的真实首分钟 E2E 实际等待完成后仍为零样本。原因是当前 8888 开发进程持有迁移前的 Prisma Client；绝不能以 fake timer 或缩短阈值替代。需在允许维护窗口内安全重启该服务、运行普通 `prisma generate`（不要 `--no-engine`），再运行 `npm run test:e2e:first-minute` 完成五模板验收。

## 本轮续接：开发库与真实五模板验收已完成（待提交）

- 已安全停止并重启本地 8888 开发链，普通 `prisma generate` 成功恢复二进制 Client；修复脚本现覆盖 `Comment`/`bgmNotesJson` 的历史迁移漂移并不依赖 `npx` shim。`dev.db` 的 24 条迁移已全部应用。
- Strict Mode 探测挂载不再制造额外 `start` 遥测分母；同时修复 `GamePlayerInner` 的目标 effect lint。`npm run test:e2e:first-minute` 在当前源码下完整通过五个模板、每条真实等待 61 秒，耗时 7.6 分钟。
- 运行中捕获并修复 BGM 路由对 JSON 文本直接校验的错误；真实测试项目的缓存 BGM 接口已返回成功。TypeScript、目标 ESLint、垂直切片/质量/遥测和四类 semantic-juice QA 均通过。

## 11. 生产发布状态（2026-08-22 已核验）

- 线上站点：`https://operone.1oneclaw.com/zh-Hans` 可访问，页面标题为 `Operone - AI 创作`，首页主标题正常渲染。
- 本机存在有效的 `scripts/deploy.local.env` SSH 发布配置；可连接生产服务器，服务器仓库为 `/opt/operone`。
- 生产服务器 `operone` 和 `nginx` systemd 服务均为 `active`；生产仓库当前提交为 `b4228f65 fix(proxy): use HTTP for internal locale rewrite`。
- 日常发布脚本是 `python scripts/deploy-prod-with-assets.py`：先让服务器同步 `origin/main`、迁移、构建、重启，再同步样品资产和文学封面。
- **关键约束**：底层部署脚本在服务器执行 `git reset --hard origin/main`。因此必须先在本机只暂存本次拥有的文件、提交并推送到 `origin/main`；绝不能把未提交本地代码或他人工作区改动直接当成可发布内容。
- 发布自检已修复并验证：服务器的健康检查现在通过 `--resolve operone.1oneclaw.com:443:127.0.0.1` 在回环地址访问正式 HTTPS 虚拟主机，确认返回 `{"ok":true,"db":"up","email":"configured"}`。这避免了 Nginx 默认虚拟主机的 404 和 HTTP→HTTPS 301 被误判为成功；该检查可作为后续发布硬门禁。
- 本次已完成完整资产发布与代码上线：生产数据库 24 条迁移均为 up to date，样品精灵/背景与文学封面已同步。发布配置的应用监听端口已校正为 `8888`，与 Nginx 上游一致；线上首页此前的 HTTPS loopback 重写导致 500，已由 `b4228f65` 改为 HTTP loopback 后恢复。最终桌面与移动端 HTTPS 首页均返回正确标题和内容，服务健康检查通过。

## 12. 续接：旗舰模板运行时角色状态机（进行中）

- 新增 `src/game/engine/runtime-actor-state.ts`，统一 `intro / idle / move / jump / dash / action / hit / victory / defeat` 生命周期；短暂命中/动作不会被下一帧移动覆盖，结算状态保持可观察。
- 跑酷、躲避/收集、物理解压、消除、农场五类场景已接入并把 `actorState`、`actorStateTransitions` 写入 Phaser QA 状态，作为后续真实运行质量门禁的数据基础。
- 验证通过：TypeScript、`qa:runtime-actor-state`、`qa:game-vertical-slice` 与五类既有 semantic-juice QA。下一步将把运行时状态/首分钟遥测汇入作品发布前的质量门禁；商户支付和财务计费仍依赖外部商户与定价规则，不能用模拟支付冒充完成。

## 13. 续接：真实首分钟回归稳定性（2026-08-23）

- `e2e/flagship-first-minute.spec.ts` 的总时限由 100 秒调整为 150 秒：保留生产同等的 61 秒真实等待和 12 秒落库轮询，只补足项目创建与 Phaser 冷启动的时间预算。
- `ensureOwnerSession` 改为等待 `domcontentloaded` 而非非关键资源的完整 `load`，避免首页字体/展示资源拖垮后续 API 会话验收。
- 完整 `npm run test:e2e:first-minute` 已通过 5/5（avoider、puzzle、physics、platformer、farming，7.3 分钟）；每条均验证 `start`、`first_action` 和 `first_minute` 已回写项目质量报告。

## 14. 续接：最低公开发布质量保护（2026-08-23）

- 新增 `visibilityWithQualityGuard`：仅当默认可见性为 `public` 且统一质量报告明确为 `blocked` 时，自动落为 `pending_review`；`needs_polish` 仍可发布，显式 `hidden`/`pending_review` 配置保持不变。
- 游戏创建、小说普通/流式生成和漫画生成已接入。漫画在生成结束后依据完整面板质量更新可见性；不把未校准的消费指标作为自动拒绝条件。
- 验证通过：TypeScript、`qa:creator-workflow`（含三条门禁断言）、`qa:creator-quality`、`qa:game-vertical-slice`。

## 15. CTO 接管：创作者平台重构（2026-08-23，进行中）

- 已在 `docs/creator-platform-rebuild-plan.md` 固化总路线：保留 Next.js 应用壳、账户、发现、商业化和 Phaser 播放器；重构创作内核为 Project / Revision / Artifact / GenerationJob / Evaluation / Publication。
- 当前数据库的 Project、Novel、Comic 分别以 `specJson`、`content`、`imageUrls` 承载关键状态，长生成多由请求内 SSE 或进程内后台调用承担；`JobQueueItem` worker 仍是确认任务的占位实现。P1 先补可恢复任务和版本化产物，再以小说作为首条迁移样板。
- 三条产品线目标：游戏为结构化设计与可执行试玩；小说为 Story Bible→纲要→场景→正文；漫画为角色/风格锁定→可编辑分镜→逐格可恢复渲染。禁止继续把一次性生成成功误报为创作者作品完成。

### P1 第一段：统一创作内核落地

- 前向迁移 `20260823010000_add_creator_core` 新增 `CreativeProject`、`CreativeRevision`、`CreativeArtifact`、`GenerationJob`，不改写旧 Project/Novel/Comic，供双轨迁移使用。
- `src/lib/creator-core/` 已实现输入边界、不可变 revision 序号/父版本关系、带内容哈希的 artifact、幂等/租约/退避重试任务，以及首个真实 `artifact_write` worker handler。`/api/jobs/worker` 优先执行新任务，旧队列继续兼容。
- `npm run qa:creator-core` 已在本地真实 SQLite 执行：创建项目和两条 lineage revision、验证幂等任务重放、worker 落库 Story Bible artifact，最后级联清理测试项目。TypeScript、Prisma schema、creator workflow QA 均通过。

### P1 第二段：小说影子版本链

- 前向迁移 `20260823011000_creator_project_legacy_unique` 为 `(legacyType, legacyId)` 增加唯一约束，防止请求重连或重试生成重复 Core Project。
- `mirrorNovelToCreatorCore` 将一个已完成的旧 Novel 映射为单个 Core Project、一个不可变生成 revision、Story Bible、纲要、逐章 scene artifact 和 manuscript artifact；旧阅读/编辑数据未被改写。
- 普通与流式小说生成在持久化旧 Novel 后同步镜像，并在 API 输出 `core` 结果；若迁移桥失败则明确返回 `core.status=degraded` 并记录错误，不会把内核同步假报成功。
- QA 已验证 story bible、纲要和两个章节产物实际落库且按级联清理；TypeScript、creator core/workflow/quality QA 均通过。

### P1 第三段：小说保存与创作快照一致性

- 小说详情 API 对作者返回仅最新的 Core revision 快照；快照包含 project/revision 元数据和同一 revision 的 artifacts，避免 Story Bible、纲要和正文跨保存版本混用，非作者不获得该数据。
- 小说正文或标题经 `PATCH /api/novel/:id` 保存后，会用 `refine` 原因写入新的不可变 Core revision；迁移失败时旧小说保存仍成功，但 API 明确返回 `core.status=degraded` 并记录服务端错误，禁止把旧快照伪装为新版本。
- `qa:creator-core` 扩展为“生成镜像 → 编辑旧小说 → 再镜像 → 读取快照”，确认快照必定定位最后 revision 且正文为编辑后的文本。

### P2 第一段：作者可控 Story Bible 与纲要

- 作者在长篇小说详情页可查看和修订 Story Bible（世界观、冲突、结局、基调、禁忌、角色关系）及每章标题、摘要和叙事阶段；非作者与没有长篇元数据的作品不显示该面板。
- 新增 `PUT /api/novel/:id/story-plan`：必须为作品 owner，使用既有 Zod 规则校验至少两名角色和三条有效章节纲要；生成中的小说拒绝修订，避免与流式长生成相互覆盖。
- 保存先更新旧长篇元数据，再以 `refine` 写入一条新的完整 Core revision（Bible、纲要、场景、正文）；任何旧 revision 保持不可变。新的 `qa:novel-story-plan-api` 用本机真实 Next HTTP 服务、临时 owner Cookie 与临时作品验证了保存响应和最终 Core snapshot。
- 本机浏览器控制环境不能连接宿主机 `127.0.0.1:8888`（网络命名空间隔离），故未能进行该面板的浏览器截图/点击验收；TypeScript、定向 ESLint、五语 JSON、creator core/workflow/quality QA 和真实 HTTP API 回归均通过。

### P2 第二段：作者可见连续性审查

- 已复用长篇生成阶段的同一 `checkSegmentConsistency` 规则，在作者详情 API 返回 Story Bible/纲要与现有正文的一致性报告；不新增模型调用，也不静默重写正文。
- 长篇详情新增“设定与正文一致性”面板，清晰区分阻断与提示，并明确要求作者修订正文或纲要。非作者不会获得报告。
- `qa:novel-story-plan-api` 扩展为真实 owner HTTP 详情断言，确认保存 Story Plan 后详情确实返回连续性报告；TypeScript、定向 ESLint、五语 JSON、core/workflow/quality QA 全部通过。

### P3 第一段：漫画影子版本链

- `mirrorComicToCreatorCore` 将 Comic 映射为唯一 Core Project 和不可变 revision，分别保存完整 `comic_document`、`style_lock`（画风、版式、导演包、角色 roster/reference sheets）与每页 `storyboard_page` artifact。
- 普通与流式漫画生成在旧 Comic 持久化后都执行镜像，响应明确返回 Core revision；桥接失败返回 `core.status=degraded`，不把漫画创作资产同步误报为成功。
- `qa:creator-core` 现用真实 SQLite 创建带画风与角色参考图的漫画，验证完整文档、画风/角色锁和逐页分镜全部落库。TypeScript 和定向 ESLint 已通过。

### P3 第二段：编辑后的分镜版本化

- 漫画详情中同页重排、跨页移动、增删格、增页、合页和单格文本编辑现统一经 `saveStoryboardRevision` 保存旧 Comic 后镜像为新的 `refine` Core revision；响应会返回 revision 或明确 `core.status=degraded`。
- 这保证角色/风格锁、分镜文案和逐格图片的改动都有可追溯版本，而不是只覆盖 `imageUrls`。TypeScript、creator core QA 和该详情路由定向 ESLint 已通过。

### P3 第三段：逐格渲染可恢复任务化

- `GenerationJob` 增加可续租 heartbeat；`comic_panel` worker 校验 payload/作者归属、支持全册/页/单格重绘、每格完成持久化进度和图片，结束后将最终 Comic 再镜像为新的 Core revision。图像服务等待期间 25 秒续租，避免 90 秒默认 lease 被误回收。
- 非流式 `POST /api/comic/:id/panels` 现支持 `durable:true`，返回 `202` 与幂等任务 ID；已有实时 SSE 渲染体验保持兼容。`GET /api/jobs/:id` 修复为优先读取新任务并按 Core Project owner 鉴权，返回安全的进度、重试与错误摘要。
- `qa:creator-core` 现验证已完成图片的 `comic_panel` 任务完成“入队→认领→执行→完成→最终 Core revision”闭环，不调用付费模型。TypeScript、定向 ESLint 和 Prisma 校验均通过；缺图的真实供应商调用未用假结果替代。

### P3 第四段：生产消费者与作者任务可见性

- 新增独立 `operone-generation-worker.timer`：每次通过本机 loopback 只消费一个 `GenerationJob`，`OnUnitInactiveSec=15` 确保长图像任务不会重叠；凭据仅从服务器 `.env` 读取，首次部署自动生成 `JOB_WORKER_SECRET`，不经过公网代理或写入 unit 文件。常规完整部署和 Linux 一键部署都会安装/启用该 timer。
- 漫画页仍保留 SSE 快速生成，同时提供“后台可恢复渲染”入口。作者重新打开作品时，`GET /api/comic/:id/panels` 会按 Core Project owner 仅返回当前活跃的 `comic_panel` 任务及脱敏进度；页面轮询该状态并在后台渲染期间禁止与 worker 冲突的编辑/重绘。
- durable worker 的全册重绘现在与同步路径保持封面重生和风格参考跳过规则一致。新 `qa:comic-panel-job-api` 以真实本地 Next HTTP 服务验证 `202 入队 → 作者恢复任务 → worker 完成/100% → 非作者 403 → 活跃任务消失`；测试用已有图片分镜避免触发付费供应商。TypeScript、定向 ESLint、shell 语法、五语 JSON 与 `qa:creator-core` 均通过。

### P3 生产验收（2026-08-23）

- 已完整发布 `0619ba2a` 与首次凭据修复 `c68b3da8`：公开 HTTPS 健康检查返回 `ok/db:up/email:configured`，服务器与 `origin/main` 均为 `c68b3da8`。
- 服务器 `operone-generation-worker.timer` 为 active。手动执行一次空队列 worker 返回 `{"ok":true,"processed":false}`，systemd 显示 `Result=success`、`ExecMainStatus=0`；此前首次生成 `JOB_WORKER_SECRET` 后 Web 进程未重载造成的 403 已被修复，安装脚本不再吞掉 worker 启动错误。

## P4 第一段：游戏影子版本链（待提交）

- 新增 `mirrorGameToCreatorCore`：每个旧 `Project` 对应一个 Core game project，创建/编辑时写入不可变 game spec、可选 Creative Brief、统一质量评估和 playable route artifact；Core revision 会保留模板、提示词、可见性与运行状态的意图快照。
- `POST /api/projects` 与会改变标题/提示词/spec/Brief/封面的 `PATCH /api/projects/:id` 已双写并返回 Core revision；镜像异常时仅明确返回 `core.status=degraded`，不阻断旧 Project 的既有保存流程。作者 `GET /api/projects/:id` 仅可读取最新 Core snapshot，非作者不暴露。
- 新 `qa:game-core-api` 使用本机真实 Next HTTP 验证创建 → owner snapshot → 编辑新 revision → 非 owner 不可读；`qa:creator-core` 也覆盖 game spec/evaluation artifact 与 revision lineage。验证通过 TypeScript、定向 ESLint、Prisma、creator core/workflow QA；生产构建与发布待本段提交后执行。

### P4 后续：作者试玩反馈与可恢复资产生产（2026-08-23）

- 作者试玩页已显示只基于匿名汇总样本的改进建议：样本不足、首个操作、首分钟、过早失败、重试摩擦和健康状态均有明确下一步；不回传用户身份、提示词或设备信息。`qa:game-playtest-advice` 通过。
- 游戏创建不再仅在 Web 进程内 fire-and-forget 生成背景、精灵和 Brief 封面。创建 Core revision 成功后，`game_asset` 会以 revision 级不可变 spec/Brief 入 `GenerationJob`，由现有生产 worker 租约、进度、退避与重试机制消费；worker 复核 Core/旧 Project 作者归属，并把 `asset_manifest` 写进同一 revision。
- 背景生成补齐本地缓存复用，重试不会对已成功的背景再次计费。Core 写入失败时保留原有非阻塞资产管线，API 会明确返回 `core.status=degraded`，而不把保存失败伪装为任务已入队。
- 新 `qa:game-asset-job-api` 用真实本机 Next HTTP 验证“创建 → durable job queued → worker 完成 → 作者可查 100% 进度 → Core revision 保留 asset_manifest”闭环；测试预置本地资产缓存，不触发付费图像供应商。后续仍需让试玩页显示该活跃任务并提供作者发起的显式重绘入口。

### P4 收尾：游戏资产任务作者可见性（2026-08-23）

- 作者试玩页不再在加载时静默调用同步资产生成接口；公开访客也无法触发该接口。作品详情仅向 owner 返回当前 `game_asset` 的脱敏状态和进度，试玩页每 3 秒轮询任务状态，并显示“补齐美术资产”这一显式、可恢复动作。
- `POST /api/projects/:id/background` 保持旧同步兼容路径，但作者传 `durable:true` 时会先建立新的 Core revision 后返回 `202` durable job；任务由 production generation worker 完成，作品与版本归属均在 worker 中复核。
- `qa:game-asset-job-api` 扩展验证 owner 详情可恢复活动任务、首次任务完成后作者可显式入队第二次恢复任务并由 worker 完成。生产构建通过。Windows 开发链残留的孤立 `.next/dev` PostCSS 进程会破坏 `routes.d.ts`；本次已终止两条无父进程的陈旧 worker 后，在独占环境中完成构建，不应将该缓存问题误判为业务类型回归。

## P5 第一段：Provider 成本账本（2026-08-23）

- 前向迁移 `20260823012000_add_provider_usage_event` 新增 `ProviderUsageEvent`。账本只含 provider、model、媒介、操作类型、成功/失败、耗时、输出单位、可选估算成本和错误代码；明确不存 prompt、正文、密钥或原始响应。
- 图像主入口 `generateImageDetailed`、非流式 `llmJson`/`llmText` 和流式 `llmTextStream` 都统一写入账本；流式调用在结束或异常时写入字符输出量与结果。账本写失败不会中断用户生成。
- 管理分析 API 新增按 provider/模型/媒介/结果的调用聚合，以及总事件数、已定价事件数、成本覆盖率和估算成本。单价未配置时保持 `null`，不将未知成本伪装为零成本或毛利。
- `qa:provider-usage` 使用真实 SQLite 验证事件落库、耗时/输出单位保留，并检查 schema 不包含 prompt/content/secret/token/response 字段。开发库已通过 `prisma migrate deploy` 应用迁移；标准 Prisma binary client 已恢复，勿使用 `--no-engine` 后直接跑本地 SQLite QA。

### P5 第二段：成本控制台读数（2026-08-23）

- Console 的“变现与额度”面板现展示 provider 成本覆盖率、账本调用数和估算成本；没有配置单价时明确显示“待配置单价”，避免将未知成本误报为零。
- 同一面板按 provider / model 展示调用数、媒介、成功状态和平均耗时，聚合来自安全账本 API，不含作品内容或提示词。五语文案和生产构建通过。

### P5 第三段：可审计的单价规则（2026-08-23）

- Runtime Config 现在可保存最多 100 条 Provider 单价规则，按 `provider + model + modality + operation` 精确匹配；服务商或模型可以填 `*` 作为受控兜底。金额是“每次调用的估算成本（微单位）”，不是伪造的 token/invoice 数据。
- 规则和密钥同样由现有加密 Runtime Config 存储，公开管理视图只返回规则本身；PATCH 审计日志仅记录规则数量。写账本时异步加载当前 Runtime Config，精确规则优先于兜底规则；没有规则仍保存 `null`，因此经营看板继续真实显示“待配置”。
- 管理控制台新增“成本估算规则”页签，支持新增、编辑、删除和保存规则。`qa:runtime-config-admin` 已覆盖精确匹配、通配兜底和未匹配为 null；`qa:provider-usage` 与完整 production build 通过。已修复 Runtime Config 合并时漏掉 providers/routes 等 DB 持久化字段的问题，确保运行时使用已保存配置。

### P5 第四段：真实裂变付费漏斗（2026-08-23）

- 管理分析的社交漏斗不再把“全平台所有付费订单”暗示成分享转化：新增“裂变付费”阶段，仅统计付款用户具有 `referredById` 的已付订单；“全平台付款”继续单列，方便对比总体收入但不污染归因漏斗。

## P6 第一段：作者显式发布与私有作品保护（2026-08-23）

- 新作品的代码默认可见性从 `public` 改为 `pending_review`（环境变量仍可明确覆盖）；生成完成不再等同于自动公开。作品详情页为 owner 提供统一的“发布作品 / 下架作品”动作，覆盖游戏、小说和漫画。
- `POST /api/works/:type/:id/publication` 强制校验 owner、`ready` 状态和当前统一质量报告。质量为 `blocked` 的作品只能先修复，不能公开；发布和下架会在同一个 Prisma 事务中同步旧作品与对应 `CreativeProject` 的 visibility/status，且不会篡改 immutable revision。
- 游戏和漫画详情 API 补齐了与小说一致的公共读取保护：不是 owner/管理员且不是 `public + ready` 的作品一律返回 404，避免 pending 或 hidden 作品通过直链泄露。详情响应现在带 visibility，供作者界面反映真实状态。
- 新增 `qa:creator-publication`（默认可见性、owner、质量阻断、Core 同步）与 `qa:creator-publication:http`（匿名 404 → owner 读取 → 发布公开 → 下架后再次 404）。“HTTP” 用例必须以 `DEV_SUPER_ADMIN=0` 启动本地服务；开发环境的 admin bypass 会刻意让匿名请求通过，不能拿来验证访问控制。完整 production build、creator workflow/quality QA 和五语 JSON 解析通过。

## P7 第一段：支付闭环诚实性与安全门禁（2026-08-23）

- 已确认旧支付链路没有真实微信/支付宝商户 checkout 或官方回调验签，却允许生产页创建 `dev` pending 订单；这会误导创作者且存在用通用 webhook secret 伪造支付完成的风险。
- 现在支付能力显式分为 `development` 与 `unavailable`：只有 `PAYMENT_DEV_MODE=1` 才能创建 `provider=dev` 订单和使用模拟完成；其他环境的订单 API 在写库前返回 `paymentUnavailable`，账单页禁用购买并说明支付接入中。
- 微信/支付宝 notify 在非开发模式一律拒绝，开发模拟也只会完成 `provider=dev` 订单；保留的 V2 MD5 函数不再把开发模式当成签名绕过。后续真实支付必须实现官方 merchant checkout、证书/平台公钥轮换、回调验签、金额/商户号核对与退款/对账后，才可开放任一生产支付入口。
- 新增 `qa:payment-safety`：验证生产态不创建订单、显式开发态仅创建 dev pending 订单并可模拟完成，测试数据会清理。

## P8 第一段：游戏结构化设计资产（2026-08-23）

- 每次游戏镜像进入 Creator Core 时，除原始 `game_spec`、质量报告和 playable route 外，还会从同一份已校验的 GameSpec 确定性生成不可变 `scene_graph` 与 `behavior_graph` artifact。场景图明确开场/主循环/结算与玩家、威胁、奖励、目标；行为图明确输入、生成调度、碰撞/奖励结算、进度与完成流转。
- 图中的移速、生成间隔、生命、目标分全部直接来自可运行 GameSpec，不引入第二套运行时或与试玩脱节的伪配置。作者试玩页会在版本卡中显示当前版本的场景数和行为节点数；非作者仍不会得到 Core snapshot。
- `qa:creator-core` 验证两个图 artifact 与 6 节点/6 边的行为流实际落库；`qa:game-core-api` 的真实 HTTP 用例同时更新为验证默认未发布作品对非 owner 返回 404。creator-quality、game-vertical-slice、定向 ESLint、五语 JSON 和完整 production build 均通过。

## P9 第一段：漫画导演分镜完整性门禁（2026-08-23）

- 漫画质量评估不再把任意非空 `director` 对象误判为视觉锚点。长导演分镜会验证导演包 schema、每格角色/地点/镜头绑定、角色和地点 ID、每页节拍覆盖、场景序号前进和连续同镜头过多等确定性约束。
- 这些问题不会被静默忽略：已渲染但绑定损坏的分镜会明确降为 `needs_polish`，并返回 `storyboard_unknown_characters`、`storyboard_scene_order_regressed` 等可修复证据；轻量流程仍保持兼容，不把没有导演包的旧作品误阻断。
- `qa:creator-quality` 新增完整导演包与损坏绑定两类用例；真实 `qa:comic-panel-job-api`、creator publication/workflow、comic-novel product rules、定向 ESLint 和完整 production build 均通过。

## P10 第一段：小说纲要完整性与可重复生产构建（2026-08-23）

- 统一小说质量现在可接收已解析的长篇生成元数据。存在 Story Bible/章节纲要时，会把缺失计划章节、重复/倒退/意外章节及正文远低于计划篇幅作为 `story_plan_issue:*` 证据；有问题的作品绝不再被判为 `ready`。旧作品及无长篇元数据的内容保持原有兼容路径。
- 小说详情与作者发布动作都传入同一份 pipeline meta，因此阅读页的连续性报告、质量状态和发布门禁不会各自使用不同事实。真实 `qa:novel-story-plan-api`、creator publication/workflow 与质量用例均通过。
- Windows 上每次临时 Next dev 后可能留下损坏的 `.next/dev/types/routes.d.ts`；由于不能安全删除共享缓存，`tsconfig` 现排除该开发生成目录，正常保留 `.next/types` 的生产路由类型。`next.config.ts` 可用 `NEXT_DIST_DIR` 进行隔离验证（默认仍为 `.next`），完整默认 production build 已重新通过。

## P11 第一段：游戏导演时间线成为作者资产（2026-08-23）

- 作者试玩页的快速调优面板现可直接增删最多 8 个导演段落，并编辑段落名称、时间位置和变奏标签；保存仍走既有 Project PATCH，因此每一次调整都会创建不可变的 Core refine revision。
- `scene_graph` 将每个导演段落投影为可审查的 play 场景，`behavior_graph` 将其投影为带时间条件的事件节点和边，作者可在版本快照中查看真实保存的节奏意图，而非只能查看通用主循环。
- 修复质量增强的一个数据所有权错误：当作者暂未配置 runtime events 时，系统只补齐事件，不再用自动导演曲线覆盖作者已保存的 intensity、acts、名称或变奏。
- `qa:game-core-api` 使用真实本地 HTTP 验证自定义段落进入 Core artifacts，且编辑会推进 immutable lineage；`qa:creator-core`、`qa:creator-quality`、`qa:game-vertical-slice`、定向 ESLint 和完整 production build 均通过。构建仍报告既有动态文件追踪性能警告，但没有类型/编译失败。

## P3 收尾：漫画分镜并发保护（2026-08-23）

- 漫画详情读取现提供基于 `updatedAt` 的 revision token；所有结构化分镜编辑必须携带该 token。服务端以原子条件更新保存，旧 token 返回 409，避免双窗口或网络重试覆盖较新的分镜。
- 成功保存会返回新 token 与新的 Core revision；作者页面据此刷新本地 token。`qa:comic-panel-job-api` 使用真实 HTTP 验证首写、Core revision、旧 token 的 409 以及随后 durable panel job 的完整恢复闭环。

## P12 第一段：Core 质量与发布审计实体（2026-08-23）

- 前向迁移 `20260823013000_add_creator_evaluation_publication` 新增 `CreativeEvaluation` 与 append-only `CreativePublication`；它们分别绑定 Project/Revision，质量证据与发布决定不再只存在于 JSON artifact 或旧作品可见性字段。
- 游戏、小说、漫画每次镜像 revision 都写入同一份确定性质量报告；发布/下架仍先更新旧作品，再在同一事务同步 Core 项目并追加带版本、质量分数和证据摘要的 publication decision。
- `qa:creator-core` 验证三类镜像均有独立 evaluation；`qa:creator-publication` 验证发布/下架产生两条不可变历史。Prisma validate/generate/migrate deploy、定向 ESLint 和完整 production build 均通过。

### P12 第二段：作者可见的审计快照

- Owner Core snapshot 现带最新独立 evaluation 与最近三条 publication decisions；游戏试玩页版本卡展示当前质量结论和最近发布动作。非 owner 仍不会取得 Core snapshot。
- `qa:creator-core` 验证作者快照可读取 evaluation；定向 ESLint 无错误、五语 JSON 解析通过。`PlayGameClient` 仍有三条既存 lint warning（未使用导入及两个 Hook dependency），本批未扩大修改范围。

## P2/P3 续接：小说续写并发保护（2026-08-23）

- 长篇续写每段已有 checkpoint；完成时若作者在其他窗口修改正文，乐观锁冲突不再退回无条件更新。服务端改发 conflict SSE 并保留 checkpoint，避免生成请求覆盖更晚的人工编辑。

## P13 第一段：小说续写可恢复任务化（2026-08-23）

- 新增 `novel_continue` GenerationJob：作者可在原续写面板勾选“后台可恢复”，请求立即返回 `202`；关闭页面后重新打开小说详情会恢复当前任务及安全的进度摘要，并每 3 秒轮询直到完成。原 SSE 实时续写保持不变。
- 新的 `executeNovelContinuation` 是两条路径共用的完整执行边界：模型级降级、分段 checkpoint、完整性修复、摘要、最终正文保存、Core revision 镜像与生成日志不再各自复制。worker 在执行前复核 Novel/Core project/owner 的三方归属，并在模型等待和 checkpoint 后续租。
- 修复一个真实乐观锁问题：成功 checkpoint 本身会更新 `Novel.updatedAt`。执行器现在把每次自己成功保存 checkpoint 返回的新时间戳作为下一次最终写入的 expected version；作者在该 checkpoint 之后的编辑仍会返回 conflict，且不会写入 pipeline meta 或伪造 Core revision。
- 任务完成后 metadata/Core 镜像异常会降级记录而不重跑已成功保存的正文，避免失败重试在新的作者状态上重复消耗生成额度。真正的作者编辑冲突则以不重试的 `novel_continuation_conflict` 失败任务保留给作者处理。
- 验证：`npm run qa:novel-continuation-executor` 覆盖“checkpoint 后正常提交”和“作者冲突不写 meta/Core”；真实本地 HTTP `qa:novel-continuation-job-api` 覆盖 `202 入队 → owner 详情恢复 queued job`，不调用付费模型。并已通过 `qa:novel-story-plan-api`、`qa:creator-core`、`qa:creator-publication`、`qa:creator-quality`、Prisma validate、定向 ESLint、五语 JSON、`npx tsc --noEmit` 和完整 production build。

### 下一步

1. 将小说 durable worker 的真实模型完成路径放入受控生产演练：用真实小额额度验证 worker 的 claim → checkpoint → complete 后，把结果与 writer UI 的恢复状态一起验收。
2. 继续补漫画“页级阅读完成率/重绘原因”与小说“章节完成率/跳出位置”的匿名消费指标；在有样本前保持质量分数不作为自动拒绝。
3. 真实支付继续保持 fail-closed，待商户号、签约产品、证书/平台公钥、回调域名与退款/对账规则齐备后单独接入。

## P14 第一段：文学消费质量闭环（2026-08-23）

- 前向迁移 `20260823014000_add_literary_engagement_event` 新增 `LiteraryEngagementEvent`。只记录作品类型/ID、随机 session、`start`/`unit_view`/`complete` 和章节/页号；明确不记录账号、正文、提示词、IP 或设备指纹。复合唯一键令同一会话同一事件/单元幂等。
- 新 `POST /api/literary/events` 只接受公开且 ready 的小说/漫画；作者自身和未公开作品的上报返回安全的 ignored，不能污染作品质量样本。顺序重复请求先查复合键，避免把正常幂等上报写成 Prisma 唯一键错误日志；并发竞态仍安全兜底。
- 小说 Reader 在进入、章节可见和最后章可见时上报；漫画阅读页在进入、切换页和最后页时上报。作者详情新增“真实读者反馈”聚合卡，展示开始、完成率、平均进度和完成量；质量报告/API 只带这些汇总值，管理分析也返回按小说/漫画的起始、完成、完成率与单元浏览聚合。
- 验证：普通 Prisma generate（在安全停止本会话 8888 开发进程后）、迁移 deploy（dev.db 29 条）、Prisma validate、定向 ESLint、五语 JSON、完整 production build 均通过。真实 `qa:literary-engagement-api` 覆盖公开读者写入、重复事件幂等、作者忽略、进度/完成率聚合和 owner detail 质量回显；`qa:creator-quality`、`qa:novel-story-plan-api` 均通过。

### 下一步

1. 将 P14 提交、推送、发布并核验生产迁移/健康/worker；上线后用真实公开作品观察匿名样本是否正常累积。
2. 基于真实样本为小说的开篇/章节完成、漫画的页级完成和重绘率建立告警阈值；在数据不足前不把消费指标作为自动拒绝发布的门禁。
3. 继续真实支付商户接入的外部准备，保持生产 fail-closed 直到签约和验签/退款/对账材料齐备。

## P15 第一段：文学消费阈值与定向修复建议（2026-08-23）

- 文学阅读质量信号现以 `10` 个匿名阅读样本为最小判读门槛：未达到门槛只显示“正在积累样本”，绝不影响作品发布、静态质量分或作者可见性。
- 达到样本量后，完成率低于 `35%` 会提示复查结尾承诺与收束节奏；平均进度低于 `45%` 且存在章节/页访问时，会定位最早低于 60% 触达的章节/页，提示复查开场、转场和继续阅读动机。信号仍为 advisory，不是自动拒绝。
- 聚合器只新增“每章节/页的唯一随机会话触达数”，不增加账号、正文、提示词、IP 或设备字段。作者详情的质量 envelope 同步带 `literaryHealth` 和可解释告警代码；管理控制台新增小说/漫画阅读质量面板，明确区分“样本积累中 / 建议复查 / 健康”。
- 验证：`qa:literary-engagement-alerts` 覆盖样本不足、健康、低完成与早期跳出定位；真实 HTTP `qa:literary-engagement-api` 覆盖事件幂等、作者忽略、详情阈值回显与 quality envelope；`qa:creator-quality`、`qa:novel-story-plan-api`、五语 JSON、定向 ESLint 及隔离 production build 均通过。构建仅保留既有动态文件追踪性能告警。

## P16 第一段：匿名创作者激活漏斗（2026-08-23）

- 前向迁移 `20260823015000_add_creator_funnel_event` 新增 `CreatorFunnelEvent`。它只保留随机、HttpOnly、30 天会话 ID、阶段（visit/signup/create/publish）、可选媒介和时间；没有账号、owner key、作品 ID、正文、提示词、IP 或设备信息。复合唯一键确保同一会话同一阶段/媒介只计算一次。
- 根布局通过极小客户端组件上报访问；注册、游戏/小说/漫画生成及统一发布 API 在服务端记录后续阶段，任一写入失败只记日志，绝不影响登录、创作或发布。付费阶段继续使用既有已付款订单聚合，绝不把 development 模拟订单伪装为真实支付。
- 管理分析 API 和 Console 新增“创作者激活漏斗”：访问 → 新注册 → 创建作品 → 发布作品 → 已付款订单。响应与 UI 只处理聚合值，并明确说明匿名范围；五语文案齐备。
- 验证：`prisma generate`、dev.db `migrate deploy`（30 条）和 `prisma validate` 通过；`qa:creator-funnel` 覆盖访问幂等与会话聚合，真实 `qa:game-core-api`/`qa:creator-publication:http` 覆盖游戏创建和发布实际写入漏斗事件。隔离 Next dev 修复默认 `.next/dev` 路由缓存污染后，完整 production build 通过；仍有既有动态文件追踪性能警告。

## P17 第一段：小说生产演练零额度预检（2026-08-23）

- Ops Health 现新增“小说生产演练”检查。它只检查生效的 `novel` provider/模型路由和 queued/running GenerationJob 数量：路由/模型缺失为 fail，队列有积压为 warn，配置就绪也保持 warn，明确要求管理员先主动运行 provider 探测、再以已批准的小额额度进行一次真实续写演练。
- 预检绝不读取/返回密钥，绝不发送模型请求，也不把配置存在伪装为生产模型成功。它将 `qa:novel-continuation-job-api` 暴露为可操作的本地恢复闭环检查。
- `qa:generation-rehearsal-readiness` 覆盖缺失路由、队列积压、配置待 probe，并确认 Ops Health 实际暴露该项；五语 JSON 与定向 ESLint 通过。真实模型演练仍需在确认额度/供应商规则后单独执行。

## P18 第一段：跨任务参考图云持久化（2026-08-23）

- `REFERENCE_ASSET_STORAGE=cloud` 不再是占位：配置 `REFERENCE_ASSET_CLOUD_UPLOAD_URL` 后，摄取服务会以 multipart 上传图片与最小元数据（`file`、随机 ref ID、序号、类型、原名、可选用途），只接受响应 `{ publicUrl: "https://..." }` 后才返回 `persistent` 句柄。认证既支持 `Bearer token`，也支持 `X-Api-Key: token` 形式的自定义 header。
- 上传服务不可用、超时、重定向、非成功状态或未提供安全 HTTPS URL 时，句柄明确降级为 session-only 并给出不含端点/密钥的可见警告；绝不把未落盘图片表示为持久化资产，也不阻断文本/文档摄取。
- `qa:reference-image-cloud-storage` 覆盖未配置安全降级、multipart 字节/元数据、认证透传、成功持久化、非 HTTPS 响应和 503 降级。生产启用前仍需业务提供实际对象存储上传端点与凭据。

## P19 第一段：Godot 离线导出归属保护（2026-08-23）

- `POST /api/godot/export` 现要求 owner cookie、已保存的 `projectId`，并以数据库作品 owner 做二次核验；公开阅读、猜测 ID 或提交任意 projectId 都不能触发该作品的缓存/资产补全。接口按 owner/IP 组合限制为 10 分钟 8 次。
- 离线下载入口只向当前作品主人显示；新建页尚未保存的预览不展示该入口，避免把一个昂贵的项目级构建器暴露成通用匿名 API。
- `qa:godot-export-ownership` 覆盖本人允许、非 owner 拒绝和不存在项目拒绝；完整 TypeScript、定向 ESLint（无 error）和隔离 production build 均通过。既有动态文件追踪性能警告未作掩盖。

## P20 第一段：作品删除资产回收（2026-08-23）

- 单个项目删除现在会同时删除该项目的游戏精灵目录与背景图；单个漫画删除会删除封面和面板图；单个小说删除会先回收其关联漫画资产，再删除小说封面。批量删除同步复用游戏资产回收器。
- 游戏资源回收器仅接受受限 project ID 字符集并使用固定 public 子路径，拒绝路径穿越；`qa:game-assets-gc` 覆盖本人资源回收、其他项目不受影响与非法 ID 安全拒绝。

## P21 第一段：作者确认版本锚点（2026-08-23）

- 前向迁移 `20260823016000_add_accepted_revision` 为 `CreativeProject` 增加 `acceptedRevisionId`。它是兼容旧作品桥接期的软引用：历史项目保持 null，只有作者显式发布时才会记录已确认的 immutable `ready` revision。
- 统一发布事务在 Core 项目存在时只接受最新 `ready` revision；没有就绪 Core revision 会回滚并拒绝发布。下架不会选择后续生成的版本，publication decision 始终关联实际已发布的确认版本。
- 后续生成或 refine 会创建新 revision，但绝不静默移动 `acceptedRevisionId`。`qa:creator-publication` 覆盖发布确认、refine 产生新版本但确认锚点不变、下架历史仍指向已发布版本，以及原有 owner/质量阻断路径。

## P22 第一段：公开确认版本投影（2026-08-23）

- 公开游戏读取不再直接把可编辑 legacy `Project.specJson` 当作已发布内容；当 Core 有作者确认 revision 时，匿名访客会读取该 revision 的 immutable `game_spec` artifact，作者本人仍读取当前可编辑草稿。
- 小说与漫画的匿名读取同样投影到 `manuscript` 与 `comic_document` artifact；作者仍可读当前编辑稿。没有 Core 锚点的历史公开作品继续回退旧字段，避免迁移期间无故不可读。
- 这使作者可以在已发布作品上继续 refine，而不会让访客在没有再次发布确认的情况下看到新玩法、正文或分镜。真实 `qa:creator-publication:http` 覆盖游戏发布/编辑隔离；`qa:literary-engagement-api` 覆盖匿名仍读已确认小说/分镜、作者读编辑稿，以及既有阅读事件路径；定向 ESLint 与 TypeScript 均通过。

## P23 第一段：作者可见的确认版本状态（2026-08-23）

- Owner Core snapshot 现同时返回 current revision 与 `acceptedRevision` 的版本号、摘要和完成时间；漫画详情 API 也补齐了与游戏、小说一致的 owner-only Core snapshot。
- 游戏试玩、小说阅读和漫画详情新增统一“发布版本”状态卡：明确区分“当前版本已确认公开”“当前草稿领先、读者仍在已确认版本”“尚未确认”，并显示最近发布动作；卡片不对非 owner 暴露。
- `qa:creator-publication` 验证确认 revision 出现在 owner snapshot；真实 `qa:creator-publication:http` 与 `qa:literary-engagement-api` 验证三媒介 owner API 均返回确认版本，且原有发布、下架、匿名读取和阅读事件仍通过。五语 JSON、定向 ESLint 和 TypeScript 均通过。

## P24 第一段：公开展示元数据冻结（2026-08-23）

- 作者点击发布的同一数据库事务现在会为该已确认 revision 写入 `publication_display` 不可变 artifact，保存当时的标题、提示词与封面；小说额外保存简介和篇幅档位，漫画额外保存关联小说标题。后续草稿/legacy row 的显示字段变化不会反向改写公开页。
- 游戏、小说、漫画的匿名详情 API 会优先读取确认 revision 的内容 artifact 与发布展示快照；历史公开作品没有该快照时安全回退 legacy 字段，作者本人继续始终读取当前可编辑稿。
- 验证：`qa:creator-publication` 覆盖发布事务的展示快照；隔离 production build 通过（仅保留既有动态文件追踪性能警告）；在该构建启动的真实 HTTP `qa:creator-publication:http` 覆盖发布后修改游戏 title/prompt/cover/spec，匿名仍只读确认版本，`qa:literary-engagement-api` 同步覆盖小说/漫画确认版本和阅读事件。

## P25 第一段：作者近期版本时间线（2026-08-23）

- Owner Core snapshot 现在额外返回最近 6 个 immutable revision（版本号、原因、状态、摘要、完成时间）；确认版本仍单独保留，避免历史列表的排序或截断改变公开锚点语义。
- 三种作品复用的“发布版本”卡现在显示近期版本时间线，明确标出当前草稿与已确认公开版本；该信息只在作者页面出现，不向匿名读者泄露创作历史。
- `qa:creator-publication` 覆盖最近版本顺序和确认版本保留；`qa:creator-publication:http` 同步覆盖 owner API 序列化。i18n JSON、定向 ESLint、TypeScript 与隔离 production build 待本批提交前复验。

## P26 第一段：安全重新发布历史版本（2026-08-24）

- 统一发布 API 现在可由作者显式携带 `revisionId` 重新发布同一作品的历史版本；服务端以 Core project、owner、`ready` 状态三重校验目标 revision，拒绝猜测 ID、其他作品版本和未就绪版本。
- 为防止当前草稿的标题/封面污染历史内容，只允许重新发布带 `publication_display` 不可变快照的版本。首次普通发布会写入该快照；从未发布过的旧草稿会安全地返回冲突，而不是拼接当前 legacy 元数据。
- 作者版本时间线只会为可安全重新发布的历史版本显示“发布此版本”操作；成功后刷新页面，公开投影和 append-only publication decision 都指向所选版本。`qa:creator-publication` 覆盖安全拒绝和重新发布审计；隔离 production build、真实 `qa:creator-publication:http` 与 `qa:literary-engagement-api` 均通过。构建仅保留既有动态文件追踪性能告警。

## P27 第一段：生产外部能力无成本审计（2026-08-24）

- 生产环境只读、脱敏检查确认模型网关密钥与地址已配置；尚未发出真实模型请求，因此没有把“存在配置”伪称为真实生成成功。继续进行小说 durable worker 的真实演练前，需要业务确认可使用的小额额度上限。
- `REFERENCE_ASSET_STORAGE`、云上传 HTTPS endpoint/认证，以及微信支付 webhook secret/API key 均未配置。现有实现保持安全语义：参考图为 session-only，支付 checkout fail-closed，绝不创建假支付成功或伪持久化素材。
- `qa:generation-rehearsal-readiness`、`qa:reference-image-cloud-storage`、`qa:payment-safety` 均通过；下一步外部前置物分别为：模型额度确认、对象存储上传端点与凭据、商户号/签约产品/证书或平台公钥/回调域名/退款对账规则。

## P28 第一段：腾讯 COS 参考素材直连（2026-08-24）

- 参考图存储新增 `REFERENCE_ASSET_STORAGE=cos` 适配器：服务端使用腾讯 COS 的 S3 兼容 API 上传到 `1onework-1251001122/operone/references`，仅在上传成功时返回 `persistent` 和 HTTPS URL；任一配置缺失、上传失败或对象不可公开读取时都保持 session-only，不会伪称素材已跨任务保存。
- `scripts/configure-cos-reference-storage.py` 实现 Token + SignKey 的 HMAC-SHA256/HMAC-SHA1/MD5 两段式凭据领取。Token/SignKey 只经 SSH stdin 做一次领取，不写服务器、命令行或日志；生产 `.env` 只保存返回的短期 SecretId/SecretKey。脚本先上传、匿名读取、删除一个随机 probe，确认公开访问后才原子更新 `.env` 并重启服务；剩余有效期低于 15 分钟会 stderr 警告。
- 只读 COS endpoint 探测显示该桶在 `ap-shanghai`。本机和生产机都在 credential allocation 的网络连接阶段超时，故本轮没有获得或写入短期凭据、没有修改生产运行配置、没有生成残留对象，也不能把 COS 持久化或真实素材摄取宣称为完成。离线 `qa:reference-image-cloud-storage`、新增 `qa:reference-image-cos-storage`、定向 ESLint、TypeScript 和五语 JSON 均通过；allocation 服务恢复连通后执行 `python scripts/configure-cos-reference-storage.py --cos-file cos.txt`，再做生产 API 摄取验证。

## P29 第一段：受控小说模型真实演练（2026-08-24）

- 已在生产机用当前环境中配置的 OpenAI 兼容网关、小说主模型 `deepseek-v4-pro` 发出一次 280 tokens 上限的中文小说开篇请求；请求在 TCP 连接阶段超时，未取得 completion、未写入 Novel/CreatorCore/账本，也没有继续重试或发起任何额外模型调用。
- 这与 COS allocation 的失败同为生产机访问公司内网域名连接超时；模型配置项仍存在，但绝不能据此宣称“一句话写小说”已真实验收。恢复网关网络可达性后，应先复跑同一最小探针，成功后再通过 `/api/novel/generate` 做一次 short tier durable worker 全链路验收；支付仍因商户资料/回调配置未提供而保持 fail-closed。

## P30 第一段：本地 Joy MaaS 小说与 Seedream 真实验收（2026-08-24）

- 本地使用未纳入版本控制的运行配置，以网关根地址调用 `minimax-2-7` 的 OpenAI 兼容 completion，获得正常完成和用量；该网关的模型清单页不是 API 前缀。
- `doubao-seedream-5-0-pro` 需要走专用 Seedream 图片路由，不能复用 OpenAI 的通用 images endpoint。适配器固定验证过的 `2K`、PNG、无水印、非流式请求契约；真实调用返回可访问的图片 URL，小说封面生成也已在本地走通并做过视觉检查。
- 实际作者路径 `/api/novel/generate/stream` 已跑完一句话短篇：创意简报、设定、计划、三段正文、摘要和保存都通过 SSE 给出阶段进度，最终生成约 1,190 字。首次验收显示简报扩写曾错误使用通用模型池；现已改为使用小说正文的 `minimax-2-7 → deepseek-v4-pro` 级联，避免同一作品在模型间漂移。
- 端到端短篇耗时约 5.6 分钟，虽然 UI 会呈现阶段进度、可恢复 checkpoint 已存在，但仍是下一轮的性能优化对象。非流式旧接口在客户端 5 分钟断开时不应被计为持久化成功。专项 Seedream 适配器、定向 ESLint、`tsc --noEmit` 与隔离 production build 均通过；构建仍只有既有动态文件追踪性能警告。

## P31 第一段：开发与生产模型配置隔离（2026-08-24）

- 模型目录只是服务商可选 model ID 清单，不能改变业务调用；真正生效的是「业务模型路由」。后台原“写入产品默认模型”按钮实际会把当前部署版本的 `product-config` 基线覆盖到所有路由，因此已改名为“用部署默认值覆盖路由”，避免把它误解为从模型目录自动选取新模型。
- `product-config` 恢复为可移植产品基线，不再承载某台开发机的 MiniMax 或 Seedream 选择。开发机的 `dev.db` 已单独配置：小说正文、长篇规划与漫画分镜使用 `minimax-2-7 → deepseek-v4-pro`，漫画图片使用 `doubao-seedream-5-0-pro`；这份本地数据库不在 Git 中，生产数据库未读取、未写入、不会被同步覆盖。
- `mergeRoutesWithDefaults` 的回归检查明确验证：即使代码默认模型变化，已保存的生产路由仍保留其 provider、主模型和备选模型。`qa:runtime-config-admin`（隔离数据库）、Seedream 契约、定向 lint、五语 JSON 和隔离 production build 都通过；构建仅保留既有动态文件追踪性能告警。
- Joy MaaS 专用 Seedream endpoint 现受 `SEEDREAM_IMAGE_API_MODE=joy` 显式开关保护；开发 `.env.local` 已设置，生产 Ark 等 OpenAI 兼容服务商默认不设置，因而同名 Seedream 模型不会被错误重写到 Joy 路径。实际本地调用在该开关下成功返回 `doubao-seedream-5-0-pro` 图片 URL；专用契约测试同时验证未设开关时不会改写生产请求。
- 已将 `50f52269` 发布到生产：服务端无待执行迁移、构建通过、`operone` 服务与 generation worker timer active；使用 TLS/SNI 的 `/api/health` 公网验证返回 `ok` 和 `db=up`。发布仅同步代码、既有样例资源和文学封面，未写入生产 `PlatformRuntimeConfig` 或覆盖任何业务模型路由。

## P32 第一段：模型路由后台可操作性（2026-08-24）

- 「业务模型路由」不再依赖浏览器对 `datalist` 的不一致三角图标。每个主模型和备用模型字段均有明确的「从已添加模型选择」原生下拉框；选择某一目录项会写入下方实际 Model ID，管理员仍可手填目录外 model ID。
- 当选定服务商尚未维护模型目录时，路由页明确显示原因和手填路径；路由表与“当前线上生效”摘要的列名改为「API 服务商」，不再把服务商名称错误标为「请求协议」。选择、保存和线上生效仍是三步分离：选择目录不写库，只有「保存并立即生效」会更新业务路由。
- `e2e/admin-runtime-config.smoke.spec.ts` 现在验证主/备用目录控件出现，并实际选择一项后确认 Model ID 写入；导航等待调整为 `domcontentloaded`，避免不相关资源延迟阻塞页面用例。
- 验证：隔离生产构建 `.next-p33` 通过（仍有既有动态文件追踪性能告警）；`npx tsc --noEmit`、定向 ESLint、五语 JSON、隔离库 `qa:runtime-config-admin` 和真实 Playwright 后台模型选择闭环均通过。E2E 首次编译 `/console` 约 54 秒，编译完成后的 API 与界面交互正常；该隔离验证没有访问生产或发出模型请求。

### 下一步

1. 已提交并推送 `9dc323d8`，并发布到生产；生产构建、服务重启、generation worker 与公网 TLS/SNI `/api/health` 均通过。发布未写入 `PlatformRuntimeConfig`，已保存的生产模型路由保持不变。
2. 后续后台演进优先补“路由可用性预检”（provider 密钥、目录、连通性、最近探测）和按业务场景的成本/成功率面板，继续保持“配置存在”与“真实生成成功”分开呈现。

## P33 第一段：后台信息架构与状态流治理（2026-08-24）

- 全局审计确认原 `/console` 将内容审核、增长/计费、系统配置与审计堆在单一“管理员”长列表中，运营人员难以按任务定位，也让新增能力只能继续堆叠。管理员侧边栏现按「内容运营」（概览、待审、作品、样品）、「增长与商业」（分享、用户、计费）和「平台治理」（生成错误、网关模型、邮件、缓存、审计）分组；移动端仍保留扁平快捷导航。
- 运行时/邮件权限隐藏由“固定栏目 ID 特判”改为对所有分组的通用项过滤，空分组自动消失；这使后续添加运营角色和分组不再意外暴露系统配置入口。
- `AdminConsolePage` 消除三处同步 effect 状态更新：权限降级使用派生有效 tab，导航/搜索/筛选通过显式状态转换重置分页和批量选择，首屏读取延迟调度。定向 ESLint 已从 3 errors + 1 warning 收敛为无 error/warning。
- 验证：TypeScript、定向 ESLint、五语 JSON、真实 Playwright 管理后台（分组、模型目录点选、实际 Model ID 回填）和隔离 production build 均通过；生产构建仍有既有动态文件追踪性能告警。

### CTO 优先级队列

1. P0：将 Console 拆成可直达 URL 的懒加载运营页面，并定义最小运营角色（内容审核、增长、财务只读、平台运维）；高风险写操作增加预览、二次确认和可回滚审计。
2. P0：新增“生成运营中心”——按游戏/小说/漫画的队列、失败原因、重试、耗时、模型路由和成本统一处理，不能只在错误页被动查看。
3. P1：将 Ops Health 升级为可操作预检：路由是否完整、provider 最近探测、成功率、延迟、成本覆盖和预算阈值；明确区分“配置存在”“可连通”“真实生成成功”。
4. P1：将经营指标改为可行动漏斗：注册→创作→质量通过→发布→消费→付费，并为小说/漫画/游戏分别提供异常阈值和处理入口；维持匿名/隐私边界。

## P34 第一段：后台页签可直达与可恢复（2026-08-24）

- `/console` 的当前页签现在由受校验的 `tab` URL 参数驱动。例如 `/console?tab=runtime` 可直接打开网关与模型配置；切换侧边栏、移动端或概览快捷入口时会更新地址，浏览器刷新、历史前进后退和复制链接均保留相同工作上下文。默认“账户”页保持无参数的简洁地址。
- URL 参数按完整已注册页签集合白名单校验；未知值会回落到账户页。没有管理员权限时，即使手工访问管理员 tab，也只会呈现账户页，后端权限仍是最终边界。
- 验证：定向 ESLint、`npx tsc --noEmit` 通过；真实本地服务对 `/console?tab=runtime` 返回 200，并完成管理员运行时配置数据读取。截图型 Playwright 用例在当前执行器 30 秒回收窗口被截断，未将这一次尝试标记为通过；下一次完整回归应在无该窗口的 CI/本机命令行执行同一用例。

## P35 修复：已保存 API Key 无法测试连接（2026-08-24）

- 缺陷根因：Runtime Config 的公开读取正确地只返回 API Key 脱敏值，但前端“测试连接”错误地只使用输入框草稿；已保存、未重新输入的服务商因此被当成没有密钥。
- 现已区分两种安全路径：未修改的已保存服务商仅提交 `providerId`，服务端在 super-admin 鉴权后从加密运行时配置读取同 ID 的完整 provider 再探测；新建或修改中的服务商仍必须携带刚输入的草稿 Key，避免把已保存密钥用于未保存的新 Base URL。API Key 从不回传到浏览器、请求体或审计日志。
- 新增 `qa:runtime-provider-saved-test`，固定使用隔离 SQLite 库，验证服务端解析、未知 ID 拒绝和公开视图脱敏；不再用会写入 `dev.db` 的运行时配置 QA 验证该问题。定向 ESLint、TypeScript 和该专项 QA 均通过。

## P36 第一段：服务商模型目录自动发现（2026-08-24）

- OpenAI 兼容服务商现在可在已填写/保存 Base URL 与 API Key 后点击「拉取模型列表」。对未修改的已保存配置，浏览器只提交 `providerId`，服务端使用加密保存的 Key 调用 `${Base URL}/models`；新建或改动中的服务商仍只能用管理员刚填写的草稿 Key，避免已保存密钥流向未保存的新地址。
- 返回结果仅保留去重、排序后的 model ID，不保存上游响应正文；管理员在可滚动的多选列表勾选模型，勾选结果同步到「模型目录」草稿，仍须点击「保存并立即生效」才落库。Gemini/Anthropic 的原生目录协议尚未接入，界面明确说明当前范围，不伪装为已支持。
- 新增 `qa:runtime-provider-model-discovery`：模拟 `/models` 响应，验证 endpoint 归一化、鉴权转发、去重排序和不支持协议的显式错误；五语文案、定向 ESLint 与 TypeScript 待本批构建前复验。

## P37 第一段：语言感知的模型路由（2026-08-24）

- Runtime Config 新增稀疏的 `localeRoutes`：`zh-Hans`、`zh-Hant` 统一进入中文池，其他产品语言进入国际池；未配置语言覆盖时严格回退到既有全局分域 `routes`，升级和代码发布不会替换生产正在使用的模型。
- Console 的「业务模型路由」页增加双列语言策略：中文池与国际池可针对游戏、小说、漫画和图片场景独立选择已配置网关与模型；每格明确显示“继承全局 / 语言覆盖”，可恢复继承。中文图片推荐 `doubao-seedream-5-0-pro`，国际图片推荐 `gpt-image-2`，但推荐不会自动写入或覆盖生产配置。
- 实际请求层已读取 `x-app-locale` / `Accept-Language`：有语言覆盖时 JSON 生成使用该场景的覆盖模型和服务商；漫画配图与通用图片入口同样将 locale 传至 OpenAI、Seedream、Gemini 路由。没有 HTTP 请求上下文的后台任务仍安全地继承全局路由。
- 新增 `qa:runtime-locale-routing`，验证简繁归并、国际路由以及覆盖缺失时的全局回退；TypeScript、运行时配置隔离冒烟和生产构建待本批提交前复验。

## P38 第一段：任务级模型账本与预算预警（2026-08-24）

- `ProviderUsageEvent` 新增可空 `generationJobId`。durable generation worker 在领取任务后用异步上下文自动关联该 ID；所有既有的模型调用仍可独立记账，历史事件也不需要回填。账本不保存 prompt、正文、密钥或上游响应。
- 「生成运营队列」优先展示该任务实际记录到的 provider、model、调用次数、成功次数、耗时和账本成本；未产生账本记录时才显示当前路由估算，并明确区分“没有成本规则”与零成本，避免把配置或估算伪称为实际消耗。
- 「网关与分域模型 → 成本估算规则」可设置每日模型预算阈值（微单位）。Ops Health 汇总当日已记录的成本，在 80% 报警、100% 失败；没有价格规则的调用不会被虚构计费。预算只是运营告警，不会在请求中偷偷截断创作者生成。
- 验证：Prisma 迁移、TypeScript、定向 ESLint、`qa:provider-usage`（含任务上下文持久化）、`qa:runtime-config-admin`（含预算持久化）、`qa:creator-core`、`qa:runtime-locale-routing` 均通过；提交后仍需生产构建、迁移和公网健康检查。

## P39 修复：首页落入旧游戏客户端与生产构建错配（2026-08-24）

- 现象：`/zh-Hans` 的服务端 HTML 仍是 Operone 首页，但页面引用的旧 Next 分块返回 404，浏览器报 `ChunkLoadError`，可表现为地址仍是首页而客户端遗留在斗兽棋样品页。
- 根因：生产服务器曾以未完成的 `.next` 构建重启失败；旧 Node 进程继续运行时与后来写入磁盘的新静态目录版本错配。语言路由在共享客户端依赖图中静态导入 `next/headers`，使 Next 16 生产构建失败，且旧发布流程对 service restart/health 的失败未严格中止。
- 修复：将漫画角色 roster 的 LLM 调用拆入 server-only 入口，语言请求头改为运行时导入以避免污染客户端依赖图；`663895cc` 与 `9e6ab18` 已在 `origin/main`。生产机已同步 `9e6ab18`，本地隔离 production build 成功，生产完整 `BUILD_ID`、TLS/SNI health、首页 HTML 当前引用的 17 个分块和真实浏览器首页均已验证通过。
- 发布脚本 `scripts/deploy-prod-cee8b1d.py` 现会对重启、service active 与 health 的任何失败直接退出，并在 build 后将 `.next` 归属给 `www-data`；提交该脚本后，后续发布不再把不完整构建误报为成功。

## P40 修复：小说章节预算与正文 SSE 直通（2026-08-24）

- 中篇/短篇的章节规划原本已有目标字数，但单章写作一直使用统一的大 token 上限；某章超量后，`requireAllPlannedChapters` 又会继续写完余章，最终的“只保留完整章”截断则可能为了保章而保留超长全文。
- 现将每批写作限制为：本章目标字数的有限弹性，且先为后续规划章节（尤其终章）预留目标预算；该限制同时进入提示词、模型 token 上限、用户可见 SSE 增量和落库前的按句末压缩。压缩保留所有章节，不再通过删除后续章节达成上限。
- 小说 SSE 路由新增 `X-Accel-Buffering: no`，客户端明确请求 `Accept: text/event-stream` 与 `no-cache`，以避免 Nginx 缓冲导致“整段才出现”。前端此前已逐 delta 解析并追加预览，本轮保留该链路。
- 新增 `qa:novel-scope-plan`，验证 5 章严重超量正文会压入预算、所有章节和终章仍保留；`npm run qa:novel-scope-plan`、`npm run qa:novel-comic-smoke`、`npx tsc --noEmit` 通过。定向 ESLint 无 error，保留两个历史 unused-variable warning。已用本地浏览器确认 `/zh-Hans/novel/create` 创作路径与篇幅选择可正常加载；未调用真实模型，因此生产网关的端到端 chunk 到达时间仍待下一次受控生成验收。
- 修改文件：`src/lib/novel-chapters.ts`、`src/lib/novel-locale-prompts.ts`、`src/lib/novel-long-generate.ts`、`src/lib/novel-planned-generate.ts`、`src/app/api/novel/generate/stream/route.ts`、`src/app/novel/create/page.tsx`、`scripts/qa-novel-scope-plan.ts`、`package.json`。

## P41 修复：全档位小说流式与预算合同对齐（2026-08-24）

- P40 的分段预算机制本已覆盖短篇、中篇、长篇首稿；本轮将儿童短篇、长篇续写、缺章补写、结尾补写和旧的通用流式兜底全部接入同一规则：直接消费上游 `llmNovelTextStream`，每个到达的增量立即经 SSE 转发，展示增量和最终落库文本共用同一硬字数上限。
- 移除了儿童档“整篇生成完成后再按 120 字伪造 delta”的实现。儿童正文过短时的补结尾也同样实时推送；缺章补写改为按章串行，避免多个并行模型输出在用户页面交错，且每章预留后续章节的预算。
- 长篇续写在已有正文接近上限时先限制可续写章节并按剩余预算重新分配，避免事后截掉终章。所有旧的“仅保留完整章”收口改为保留已规划章节的按句末压缩。
- `qa:novel-scope-plan` 新增对通用流式累计器的回归：验证上游 chunks 立即转发、触顶后停止展示、最终文本仍严格不超预算。

### 下一步

1. 在不影响用户作品的受控测试账号下做一次中篇真实模型生成，确认首个正文 token、连续 SSE 帧、最终字数、章节齐全和终章收束；记录网关/Nginx 实际 chunk 时间。
2. 通过后仅精确暂存本批小说文件并提交；不要把当前工作区的运行时配置、数据库、日志或其它团队改动混入提交。

## P41：后台运营工作流与处置闭环（2026-08-24）

- 后台导航从按功能堆叠调整为运营工作台、内容与质量、增长与用户、商业与成本、平台与 AI 运行时；管理员分组统一使用后台翻译域，避免复用个人中心文本。
- Ops Health 的非正常检查现在附带处置目标：邮件配置、样品同步、待审队列、生成错误、模型预算、小说预检、模型路由和服务商探测均可直接进入相应后台页面，而不是只显示告警。
- 文生图 `comic_image_openai` 的主备模型在 OpenAI 兼容和 Joy Seedream 专用路径均透传实际 fallback model；生产已保存的路由仍优先于部署默认值，不会被发布覆盖。
- 验证：`npx tsc --noEmit`、定向 ESLint、`qa:seedream-image-adapter`、`qa:generation-rehearsal-readiness`、`qa:admin-console`（32 项）通过。首次后台 QA 发现本地 8888 未监听，启动开发服务后复验通过；这不是生产故障。

### 下一步

1. 继续 P0：将生成运营队列做成按游戏/小说/漫画的可筛选处置中心，并把失败重试、实际模型账本和耗时放在同一任务视图。
2. 为运营工作台补“异常优先”卡片与按媒介的质量/消费阈值，保持每个异常都能直达处置页。

## P42：最小运营角色可用性（2026-08-24）

- 将角色能力映射抽为不含服务端依赖的 `admin-capabilities` 模块，供 API 鉴权与客户端导航共同使用，避免前端复制一套不一致的权限表。
- `content_operator`、`growth_operator`、`finance_viewer`、`platform_operator` 现可通过现有 2FA 机制进入控制台，但只看到相应的内容、增长、计费或生成运营入口；`admin` 可见常规管理页，密钥、网关、邮件和缓存仍只对 `super_admin` 显示。
- 直达 URL 会按同一规则校验，越权 tab 自动回到账户页；后端 API 继续以 capability/super-admin 为最终授权，不依赖前端隐藏。
- 验证：`npx tsc --noEmit`、定向 ESLint 和 `qa:admin-console`（37 项，含内容/财务/平台角色范围）通过。

### 下一步

1. 提交、发布 P42；随后为每个最小角色做真实会话级 UI 验收（非 DEV_SUPER_ADMIN 旁路）。
2. 继续 P1：运营工作台按游戏/小说/漫画输出质量、消费与生成阈值的异常优先卡片。

## P43：异常优先运营工作台（2026-08-24）

- `/console?tab=overview` 新增「今日优先处理」：待审积压、24 小时生成错误、模型成本账本覆盖率、游戏首分钟留存和小说/漫画消费健康会在满足明确阈值时生成可点击处置卡；没有异常时明确显示健康状态。所有卡片都复用既有受授权页面，不输出作品正文、提示词或密钥。
- P41 的图像真实主备级联、P42 的角色范围以及本项工作台均已精确提交、推送并发布。最新生产提交为 `0377368c`；完整 Next 构建、`operone`、`operone-generation-worker.timer`、样例/封面资源同步和 TLS/SNI `/api/health` 都已核验通过。
- 已知构建警告仍为既有 Turbopack 动态文件追踪问题（OpenGame workDir 与 cache-management 导入链），不影响构建结果但应作为独立性能治理任务处理。

### 下一步

1. 为非 super-admin 的四个运营角色建立真实账号会话级浏览器验收，确认不依赖 DEV_SUPER_ADMIN 旁路。
2. 继续将高风险操作（作品批量审核、配额与任务重试）统一为预览 → 确认 → 审计 → 可回退的处置协议。

## P44：三媒介发布质量门禁（2026-08-24）

- 漫画的所有生成入口（首生成、普通/流式补图与 durable worker）统一按总分镜数落状态：只有每一格已落图才为 `ready`；任何部分成功都保留为 `pending_images`，因而无法进入发布转换。
- 发布质量从“分数提示”升级为硬校验：漫画必须全图完成；导演分镜中的未知人物、场景、顺序倒退或缺绑定会阻止发布；关联小说时每格还必须绑定存在的正文段落并按段落顺序前进；使用角色的导演漫画须有对应 Character Sheet 视觉锚点。
- 游戏发布必须引用当前不可变版本的 durable `asset_manifest`，且清单内有背景、主角和敌对角色的已生成资源及运行时槽位；浏览器会话中的临时 manifest 或纯几何回退不能再冒充完成品。五语页脚同时改为平台级游戏/小说/漫画定位，避免漫画页仍称自己是小游戏管线。
- 验证：`qa:creator-quality`、`qa:creator-publication`、`qa:comic-storyboard-resilience`、`qa:comic-director-pipeline`、`qa:comic-novel-product-rules` 与 `npx tsc --noEmit` 通过。待执行完整 production build、精确提交、发布和 TLS/SNI 公网验收。

## P45：游戏创作收敛与移动三消可玩性（2026-08-25）

- 创作台默认改为“输入一句话 → 直接生成可玩版本”：热门灵感移到输入与主操作之后，仅保留四个入口；全部模板、主题诊断与“提炼创作方向”均折叠为可选项，系统不再将未经用户主动选择的方向附加进 prompt。
- `开心消消乐/三消` 进入专属 puzzle 共创方向，明确相邻交换、三连消除、关卡目标与步数，不再落入通用的“威胁/弹幕”问题分支。
- H5 试玩画布在手机端保持可用高度并禁用浏览器手势抢占；8×8 三消棋盘同时按宽和高缩放，避免窄屏下越出画布。普通点击、命中、连击不再触发相机全屏闪屏，只有 Boss/胜利/失败保留稀有全屏反馈。
- 验证：`qa:create-intent-safety`、`qa:mobile-puzzle-layout`、`qa:juice-screen-safety`、`qa:puzzle-mode`、`qa:match3-commercial-runtime`、`qa:puzzle-semantic-juice`、`qa:juice-semantic-presets` 与 `npx tsc --noEmit` 通过；本地浏览器已验证默认折叠、直接生成可用，以及三消细化不显示“主要威胁来自哪里”。待精确提交、发布与公网验收。

## P46：游戏生成线内核化与创作页重构（2026-08-25）

- 游戏公共生成路径不再让创意扩写、模板推断、二次强化、评审和 agentic 分支竞争决定基础玩法。新增 `game-generation-plan`，将输入编译为内部运行时内核、核心循环、操作方式和四项基础可玩性检查；模型/素材只能作为后续丰富能力，不能篡改已有玩法。
- 显式机制优先于宽泛关键词：三消、横版跳跃、塔防、经营种植和射击等会先落入对应运行时；例如“横版跳跃收集宝石”不再因“收集”被误路由为泛收集玩法。
- `/api/generate` 与 SSE 默认走内核编译；SSE 仅展示“规则 → 验证 → 可玩版本”三个真实阶段，并返回用户可读的玩法摘要，不再展示模板、联网检索、二次强化或隐式创意提炼。
- `/create` 被重写为单入口：一句话输入、生成状态、即时 Phaser 试玩和保存打开。取消用户侧模板/风格预制、变体、隐藏模型选项、参考素材工作台和精灵轮询；保存后立即进入 H5 试玩，后台美术不得阻塞可玩版本。
- 验证：`qa:game-generation-kernel`（三消、躲避、经营、跳跃、塔防五类意图）、`qa:generate-stream-sse`、`qa:mobile-puzzle-layout`、`qa:juice-screen-safety`、定向 ESLint、`npx tsc --noEmit` 与 production build 通过；390px 真实浏览器中三消 SSE 完成并加载 Canvas，旧控件文字检索为 0。production build 仍有既有动态文件追踪性能警告，未阻塞产物。待精确提交、发布和公网复验。

## P47：游戏默认生产合同（关卡、声音、混音与移动端）（2026-08-25）

- 所有新游戏的确定性内核现在必须产出并持久化 `production` 合同：首局 0–60 秒固定为 onboarding / core-loop / variation / climax 四段；每段绑定 BGM section（intro/build/drop/climax）和可审阅的玩家目标。关卡节奏不再是生成提示词里的口号。
- 合同同时包含主题环境音（meadow/ocean/city/space/cave/arcade）、输入/拾取/冲击/能力/Boss/胜利/失败音效覆盖、音乐/环境/音效混音预算、最多 4 个并发 SFX，以及“首次手势后启动、后台静音”的移动端策略。旧项目在运行时会补齐这份默认合同，新项目会随 GameSpec 保存。
- `GameSoundscape` 接入 BGM 分段时间线和程序化环境音层；`webBleeps` 改接共享 SFX mix bus，并实行并发语音上限。所有 Phaser 结算统一切入胜利/失败段，避免只靠各场景自行记得播结算音乐。
- SSE 创作页直接回显首局关卡节奏与音频预算，不暴露模板/风格预制。质量评分将环境音、4 段音乐推进和移动端安全混音纳入 presentation 门槛。
- 验证：`npx tsc --noEmit`、定向 ESLint、`qa:game-generation-kernel`、新增 `qa:game-production-contract`（四种主题）、`qa:generate-stream-sse`、`qa:mobile-puzzle-layout`、`qa:juice-screen-safety` 通过；真实浏览器生成“三消”后显示四段节奏与“arcade 环境音 · BGM 分段推进 · 最多 4 个音效并发”，390×844 Canvas 为 342×261，首次点击后音频提示消失。控制台仅有已知导航 hydration mismatch，未见本项错误。待精确提交、发布和公网 SSE 验证。

## P48：真实 BGM 产物、持久化与降级链路（2026-08-25）

- 移除了旧的伪 `Replicate MusicGen` 分支：此前只要存在 `replicateApiKey` 就对播放器返回 `skip`，实际上从未调用音乐模型。现在 `game_bgm` 路由只会把显式音频输出模型（包含 `openai/gpt-audio-mini`）送往 OpenAI-compatible Chat Completions 音频请求。
- 每个新游戏的 durable `game_asset` 任务在美术资产前先生成 BGM；可播放、非口播且容器签名有效的音频会保存到 Blob Store，元数据写入 `Project.bgmAudioJson` 和不可变 Core `bgm` artifact。没有音频产物时，同一次任务立即回退到 `game_text` 的 LLM 音符序列，并写入 `bgm_notes` artifact；若网关同样无响应，则保存确定性、循环的 `procedural_notes`，而不是把 500 或空音轨交给玩家。
- 播放器接口与首屏声音启动统一读取同一 BGM pipeline：已持久化音频优先，其次音频模型，最后缓存/新生成 notes；历史 notes 不再抢在新的音频模型尝试之前返回。浏览器等待上限从 12 秒提高到 50 秒；音频模型 30 秒、LLM notes 单次 8 秒上限，既覆盖优先链路又不拖慢游戏本体的程序化声音。
- Console 不再收集或宣称 Replicate Key 能生成 MusicGen；它显示 `game_bgm` 绑定的 provider/model、是否为音频模型以及真实优先级。Provider 账本与价格规则加入 `audio/audio` 维度，但只记录 provider、model、状态、时长和成本估算，不保存 prompt、密钥或上游音频响应。
- 新迁移 `20260825090000_project_bgm_audio` 已在本地 dev SQLite 应用；新增 `qa:game-bgm-audio` 验证 gpt-audio-mini 选路、Chat Completions 音频请求、WAV 校验、口播/伪 base64 拒绝和最终可播放序列。`qa:game-production-contract`、`qa:creator-core`、TypeScript、定向 ESLint 和完整 `qa:game-asset-job-api` 通过；本地 text-only BGM route 触发的完整任务从原先 60 秒降到 16.3 秒，且恢复任务直接复用已保存的 BGM 决策。生产 `game_bgm` 已绑定 `openai/gpt-audio-mini`；真实调用若无有效音频会进入 LLM、再进入确定性 notes，不会出现空白音轨。

## P49：跨服务商候选路由与空备用保护（2026-08-25）

- 根因：`RuntimeModelRoute` 原来只保存一个 `providerId` 和字符串备用模型，且 `mergeRoutesWithDefaults` 把显式空数组当成“缺失”，自动补入游戏文本默认备用模型。因此 BGM 画面会错误显示并尝试不属于已选 OpenRouter 的 `deepseek-v4-flash-ga-260731`。
- 路由现改为有序的 `fallbackCandidates: [{ providerId, model }]`。旧 `fallbacks` 仍可读取并按主服务商迁移；显式空备用数组保持为空。解析阶段返回 provider 与 model 绑定的候选项，不会混用另一渠道的凭据。
- `llmJson`、`llmText`、`llmTextStream`、游戏 BGM 和 OpenAI-compatible 图片生成均按候选项逐一调用。流式输出只在首个 chunk 之前切换候选；已输出后失败会如实失败，避免拼接两家模型文本。BGM 面板展示真实的 `服务商 · 模型` 链路。
- Console 路由编辑从单一逗号备用框改为“添加备用候选项”：每项可独立选服务商与模型，删除服务商时也清理指向它的候选项。后台 E2E 同步更新为当前控制台布局，并实际覆盖新增候选项。
- 验证：`npx tsc --noEmit`、定向 ESLint、`qa:runtime-cross-provider-routing`、`qa:runtime-config-admin`、`qa:game-bgm-audio` 通过；`npx playwright test e2e/admin-runtime-config.smoke.spec.ts --workers=1` 通过。待精确提交、部署，再将生产 `game_bgm` 的错误 DeepSeek 字符串备用清为空候选。

## P50：游戏交付合同与数值预检（2026-08-26，进行中）

- 新游戏的 `production.delivery` 现在持久化目标设备（mobile H5）、60 秒首局、主输入、目标、胜负条件、首次奖励/变化/高潮时点；这是可审查玩法规格的一部分，不再只是生成提示词。
- 新增 `game-delivery-readiness`：对交付节奏和速度、压力、生命、胜负分等数值包络做确定性预检，明确标记为 preflight，不冒充真实玩家模拟。破坏交付合同和数值包络会 `blocked`；正常新内核进入质量报告与发布判断。
- Creator Core 每个游戏 revision 新增不可变 `game_delivery_contract` 和 `game_delivery_preflight` artifact，便于发布和后续运营回溯到具体版本的目标/预检结果。
- 已通过：`npx tsc --noEmit`、`qa:game-delivery-readiness`（4 种生成玩法 + 人为破坏失败闭环）、`qa:game-generation-kernel`、`qa:game-production-contract`、`qa:creator-workflow`、`qa:creator-core`、定向 ESLint。真实本地 HTTP 创建/worker 路径已执行并完成 BGM 与资产任务。
- 已知验证边界：旧 `qa:game-core-api` 的“未发布应 404”断言在当前开发环境得到 200，需单独校验默认可见性/权限基线；不能作为本次通过。下一步：补按五种内核的浏览器首分钟行为验证并把其结果写成可消费的 playtest artifact，再升级发布门禁。

## P51：游戏交付证据、数值扫测与匿名权限基线（2026-08-26）

- 浏览器真实 `first_minute` 匿名事件现在会异步写入对应最新、ready 的 Core revision：不可变 `game_playtest_first_minute` artifact 与 `playtest` evaluation。产物只含事件类型、模板、时长和静态切片分；不保存 session id、提示词、输入、账号、设备或指纹。同一 revision 只保留一次该证据，事件写入失败不影响玩家继续游戏。
- 游戏数值预检升级为透明的 `deterministic_scenario_sweep`：按新手、普通、预期、熟练、高手五档操作效率扫描速度、刷怪、生命与目标压力。它只是可审阅的数值守卫，明确不等同真实玩家留存；真实浏览器试玩与上线遥测仍是唯一观察证据。每个 Core revision 新增 `game_balance_simulation` artifact；无法通过预期玩家场景时会随交付预检阻止发布。
- 新作品一律进入 `pending_review`（或更严格的 hidden），环境变量不能再将生成作品自动设为 public；本地 `DEV_SUPER_ADMIN=1` 也不再把匿名请求升级为管理员，避免开发期绕过掩盖“未发布作品必须 404”的回归。
- 验证：`qa:game-delivery-readiness`、`qa:creator-core`、`qa:creator-quality`、`qa:creator-publication`、`qa:game-core-api`、`qa:game-playtest-evidence`、`npx tsc --noEmit` 与定向 ESLint 均通过。Playwright 真实 H5 `avoider` 首分钟回归通过（实际 1.9 分钟，含 60 秒运行与回写轮询），确认 telemetry、Core playtest artifact 与质量读取能够闭环。
- 后续矩阵实测发现 platformer 的资产 worker 与 SQLite 首分钟 evidence 写入发生短暂锁竞争；遥测保留但单次异步 Core 写入被吞掉。现将该不阻塞玩家的写入改为 0/250/750/1500/3000ms 五次短重试，并用真实 platformer 回归验证修复。五个核心玩法 avoider、puzzle、physics、platformer、farming 全部通过首分钟 Canvas 操作、遥测回写和 Core artifact 断言。

### 下一步

1. 将五个核心玩法的真实首分钟浏览器回归纳入周期性发布套件，保持串行，避免 SQLite QA 库写锁掩盖问题。
2. 基于至少 5 位真实试玩者的匿名聚合数据校准场景扫测阈值，不能把当前数值模拟当作留存结论。

## P52：手机端体验适配（2026-08-26）

- 试玩：Phaser 按 parent 实际宽高创建并 ResizeObserver 同步；去掉 640×560 下限导致的 letterbox。样品馆试玩页收紧顶栏、手机去圆角黑边、宿主约 `100dvh-7.5rem`。斗兽棋 cell 按屏宽铺满；2048 窄屏棋盘约 92% 宽；WASD 永久提示改为触屏「滑动合成」。
- 听书：`/novel/[id]`、`/comic/[id]` 隐藏 MobileBrowseDock；听书栏 `z-50` + safe-area；layout 底栏 padding 按路径取消（`MobileDockInset`）。
- 样品馆手机改为全宽竖列，主按钮只留试玩；首页 Featured 上移到文学 Pipeline 之前，第一张样品全宽大卡；Hero 步骤卡收到 details；Feed 入口去掉 emoji。
- 第二轮（全产品线）：所有试玩页（含非样品）手机先画布后 banner；用户游戏手机隐藏顶栏；Godot 引擎切换条仅桌面显示。斗兽棋/2048/俄罗斯方块/农场/麻将消消乐等 Scene 窄屏铺满。小说/漫画详情手机隐藏顶栏与封面 Banner，阅读区上提；八格漫画手机单列全宽。
- 验证：`npx tsc --noEmit` 与 `qa:mobile-puzzle-layout` 通过。已提交并发布到生产（`deploy-prod-with-assets.py`）。
- **发布约定（2026-08-26）**：完成本仓库改动后默认 `git commit`（只含本次相关文件）并 `python scripts/deploy-prod-with-assets.py`（先 push `origin/main`）。

## P53：首页创作者平台级改版（2026-08-26）

- 对标 Midjourney / Runway / Roblox Creator：首屏只保留品牌、一句承诺、一组 CTA；去掉步骤侧栏与首屏内 Feed 条。
- 新组件 `HomeHero`：真实样品封面全幅视觉；`HomeCreateLanes`：游戏/小说/漫画三条独立介质入口；精选样品改为杂志式大图货架。
- 文案从「实验室」语气改为「创作者平台 / 可发布作品」；五语同步。
- 验证：首页相关 ESLint 通过。本地全仓 `tsc` 仍可能被未提交的 telemetry WIP 干扰，不以该噪音阻塞本次发布。
- **P53.1 视觉重修**：去掉三图硬拼贴；产品线贴住首屏；收紧货架节奏；补漂移/漂浮/呼吸/hover 动效。
- **P53.2 社区货架放大 + 简介**：游戏/小说/漫画社区热门从 6 列改为 3 列大卡；封面加高；卡片展示从 `prompt`/`summary` 派生的短简介（不另调 LLM）；hover 上浮 + CTA 浮层；区块垂直间距收紧。
- **P53.3 小说收尺寸 + 样品馆简介**：小说改为 4 列、`max-h-340`；样品馆主卡/侧卡叠加 subtitle·prompt 短简介；标题/简介/播放数字阶随封面尺寸缩放（主卡大、侧卡与小说小卡收紧）。
- **P53.4 样品主卡下方内容区**：桌面被右侧货架拉高的空白改为转化区——钩子文案、prompt 简介、标签、立即试玩 + 用同样灵感开写双 CTA、打开次数。

## P54：游戏默认生产流水线与手机 H5 交付门禁（2026-08-27）

- 游戏 Core revision 新增不可变 `game_production_pipeline`：把需求、玩法定义、原型、技术设计、开发、数值平衡、手机测试、发布和运营九阶段落成可读取状态；确定性预检通过不冒充真实设备验收，手机测试/发布/运营只有观察证据后才推进。
- 发布门禁绑定作者选定的 immutable revision，必须同时具备该版本的 `game_spec`、生产流水线预检、交付预检、移动 H5 真实试玩证据、BGM 音频或 notes，以及完整资产清单；不能再拿当前可编辑 legacy spec 或浏览器临时素材冒充已验收版本。
- 匿名遥测绑定 `creativeRevisionId`，首分钟证据记录前台活跃时长、操作次数、设备类别、方向与触控能力；同一 revision 的真实结算会生成 `game_playtest_delivery`，不保存 session、prompt、账号、IP 或设备指纹。
- 手机运行时修复：Phaser active canvas 生命周期标记；滚动场景 pointer world 坐标；平台跳跃扩展 Arcade Physics world bounds、按屏幕方向触控、关卡实际目标分和到达终点结算；躲避玩法恢复生命值、生命 HUD、受击恢复窗，并将默认危险速度限制在手机可读范围。
- 规格保存/局部修改会补齐默认 production contract；规范化会保留所有通过 schema 的模板 blueprint；canonical 样品只在显式样品身份下替换规格，不再根据 prompt 关键词覆盖创作者玩法。
- 真实 Pixel 5 串行矩阵 5/5 通过：avoider、puzzle、physics、platformer、farming 均完成真实输入、60 秒前台活跃、首分钟 Core artifact、正常胜负、delivery artifact 和重开，总耗时 6.0 分钟。
- 发布前验证通过：`npx tsc --noEmit`、`npx prisma validate`、完整 `npm run build`（106 routes）、`qa:gameplay-telemetry`、`qa:game-playtest-evidence`、`qa:creator-publication`、`qa:game-delivery-readiness`、`qa:spec-canonical-parity`、`qa:game-quality-contracts`、`qa:play-scene-semantic-juice`。37 条迁移在全新隔离 SQLite 从零应用成功，隔离 `qa:creator-core` 通过。
- 共享 QA 数据库里残留的旧 `game_asset` queued job 会让 `qa:creator-core` 的“消费下一任务”断言拿到别的任务；本轮未删除共享任务，以隔离数据库完成真实验证。定向 ESLint 0 error，保留既有 unused/hook dependency warnings。

### 下次启动清单（P54）

1. 仅精确暂存 P54 游戏流水线、遥测、运行时、QA、两条迁移和本节 `CONTEXT.md`；不要混入当前另一个会话的小说、漫画、locale/model 路由、README、PNG、数据库或 QA 输出。
2. 推送 `origin/main` 后执行 `python scripts/deploy-prod-with-assets.py`；要求生产 `.next/BUILD_ID`、`operone`/worker active、TLS/SNI health 与首页全部 JS chunks 通过。
3. 公网真实浏览器强刷首页并打开一个手机游戏，确认不是旧游戏页、无 ChunkLoadError、Canvas 可操作与结算可重开。

