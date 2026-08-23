# Operone 创作者平台重构总计划

最后更新：2026-08-23  
产品责任：CTO / 产品总监

## 1. 产品定位与成功定义

Operone 是创作者把一个想法持续变为可编辑、可验证、可发布、可变现作品的工作台；不是三个一次性提示词生成器。

三个首要承诺：

1. 一句话是开始，不是交付。生成后必须形成创作者能看懂和编辑的结构化作品。
2. 每次生成可追踪、可重试、可回退，任何模型或图片服务失败都不损坏作品。
3. 发布前只阻断有明确失败证据的作品；其余质量反馈服务于创作者修复，而不是黑箱打分。

## 2. 现状与重构边界

保留并复用：Next.js/React 应用壳、账户与 owner 迁移、发现与分享页面、商业化壳、Prisma 服务层、Phaser 播放器、现有有效的小说/漫画生成提示和资产能力。

必须替换或迁移：

- `Project`、`Novel`、`Comic` 各自持有 `specJson` / `content` / `imageUrls` 的平面存储模式。
- 请求内 SSE 直接承担长生成、`scheduleProjectAssetPipeline` 进程内 fire-and-forget、以及当前仅确认任务而不实际执行的 `JobQueueItem` worker。
- 把模板参数变化当作“游戏生成”、把长文本当作“小说项目”、把图片 URL JSON 当作“漫画项目”的产品语义。

兼容策略：旧作品继续由现有详情和播放路由读取。新内核先以旁路影子记录写入并验证，再逐媒介切换读路径；绝不一次迁走存量作品或删除旧字段。

## 3. 统一创作内核

```text
CreativeProject
  ├─ Branch
  │   └─ Revision (immutable input + output snapshot)
  ├─ Artifact (typed, versioned, addressable)
  ├─ GenerationJob (durable, idempotent, resumable)
  ├─ Evaluation (automatic evidence + creator approval)
  └─ Publication (visibility, review, share, analytics, entitlement)
```

核心对象：

| 对象 | 责任 | 不可变原则 |
|---|---|---|
| `CreativeProject` | 所有权、媒介、标题、当前分支 | 不存大正文或图片列表 |
| `Revision` | 一次明确的创作意图与结果快照 | 成功后不可原地改写 |
| `Artifact` | Bible、纲要、场景、游戏设计、角色参考、页面、面板、素材、构建物 | 有类型、哈希、来源与父产物 |
| `GenerationJob` | provider 调用、进度、重试、幂等键、错误分类、成本 | 不依赖单一 HTTP 连接 |
| `Evaluation` | 结构/运行/连续性/一致性/安全/人工确认的证据 | 不能只存一个分数 |
| `Publication` | 审核、可见性、链接、归因与商业权益 | 只能指向已验收 revision |

## 4. 三条产品线的目标流水线

### 4.1 一句话生成游戏

`Prompt → GameDesignSpec → SceneGraph + Entity/Behavior Graph → AssetManifest → Browser Build → Scripted Playtest → Creator Edit → Publish`

首期范围限定在可验证的 2D 类型。模板可作为 starter kit，但最终项目必须拥有独立规则、场景、实体、素材清单与可回放试玩证据；不能把未支持的 3D/MMO 承诺给用户。

发布最低门槛：构建可启动、首分钟脚本可执行、没有致命控制/结算故障、素材许可与来源可追溯。

### 4.2 一句话写小说

`Prompt → Story Bible → Outline → Scene Cards → Draft Chunks → Continuity Review → Manuscript Revision → Publish`

Story Bible 是唯一叙事事实源：角色、别名、动机、关系、世界规则、时间线、禁忌与文风。章节和场景是独立产物，正文只由场景卡生成；改角色或纲要后明确提示受影响场景，而不是静默重写全书。

发布最低门槛：纲要/正文结构可解析、未解决的连续性冲突可见、章节正文完整、作者确认版本。

### 4.3 小说转漫画

`Novel Revision → Adaptation Bible → Character + Style Reference → Page/Panel/Shot Plan → Render Jobs → Panel QA → Reader Publish`

角色、服装、道具、地点、色彩与画风必须成为版本化参考资产；页面与面板是数据库一等对象。每一格保留镜头、动作、对白、参考图、seed/provider、渲染状态、失败原因和局部重绘历史。

发布最低门槛：所有要求面板渲染完成；人物/场景一致性检查无阻断项；文字可读；作者确认页面顺序和阅读方向。

## 5. 技术决策

1. 生产数据迁往 PostgreSQL；SQLite 仅保留本地单机开发。对象存储承载图片、音频、构建物和参考资产。
2. 任务改为数据库权威队列 + Redis 调度通知；worker 真正按 `type` 分发，使用租约、幂等键、退避重试、取消与死信状态。
3. 所有模型/媒体 provider 通过受观测的 adapter 调用：请求版本、输入哈希、耗时、成本、重试和结果 URI 都入账；禁止把模型失败静默伪装为成功成品。
4. API 在迁移期继续兼容旧路由；新 API 统一以 project / revision / artifact / job 为资源边界。
5. 所有新创作默认私有或待审；只有通过相应媒介的发布验收并由作者触发时才公开。

## 6. 分期交付

| 阶段 | 交付 | 验收 |
|---|---|---|
| P0：基线与护栏 | 平台度量、旧链路错误分类、发布保护、迁移设计 | 可复现基线、无 silent success |
| P1：统一内核 | Project/Revision/Artifact/GenerationJob schema、worker 实现、对象存储接口 | 任务可恢复，revision 可回退 |
| P2：小说优先 | Story Bible、纲要、场景、连续性审查、编辑器 | 从一句话到章节可编辑且可续写 |
| P3：漫画 | 角色/画风锁定、逐格分镜与渲染、局部修复 | 长篇改编可恢复且一致性可证明 |
| P4：游戏 | 场景/行为图、可编辑项目、构建与试玩门禁 | 非模板参数级的独立作品可发布 |
| P5：商业与规模 | 成本账本、套餐权益、支付、组织、备份、告警 | 单位成本与收益可核算，故障可恢复 |

## 7. 阶段指标

- 生成成功不是质量指标：分别观测首次可用时间、任务恢复成功率、作者编辑后发布率、局部修复成功率、首分钟试玩完成率、漫画一致性阻断率和小说连续性缺陷率。
- 每个媒介必须具备 golden fixtures、provider failure fixtures、取消/重试 E2E 和真实浏览器验收。
- P1 后不得新增仅在内存中运行的长生成或无 revision 的覆盖写。

## 8. 风险与控制

- 迁移风险：采用双写、影子读取和按 owner/媒介灰度；旧作品不批量重写。
- 成本风险：所有 provider 调用必须入成本账本后再扩容；未设限额不开放批量生成。
- 质量风险：先支持窄类型并给出边界，不以“任何题材、任何形式均可高质量生成”营销。
- 外部依赖：支付商户、税务/退款政策、对象存储生产账户和法务文本需由业务主体提供；代码与测试准备不等待这些事项。

## 9. 当前执行顺序

1. 实施 P1 schema 与真正的任务分发骨架。
2. 将现有小说 pipeline 先接入 revision/artifact，作为第一个端到端迁移样板。
3. 以小说 revision 驱动漫画，而不是从松散正文直接生成。
4. 最后把游戏模板链路替换为结构化项目链路。
