# 项目工作进度快照

最后更新：2026-08-22（消费数据质量证据续接）

> 本文件已按当前决策重建，只保留今天的项目状态、发现与计划，不保留旧会话历史。

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
- 游戏：Phaser 2D 主运行时、Godot 作为 3D/导出路径、模板优先路由、GameSpec 驱动。
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
