# Astrocade 竞品架构对照

生成时间: 2026-06-13T07:17:55.285Z

| 状态 | 支柱 | 竞品 (Astrocade) | 本平台 | 证据 | QA |
| --- | --- | --- | --- | --- | --- |
| ✅ aligned | 三层运行时 | Primary 专用玩法 / Secondary 3D / Advanced LLM 定制 | Phaser Scene 族 · Godot ai-mother-universal · AgenticScene | qualityTier=astrocade · agentic=true | qa:architecture-parity |
| ✅ aligned | 同 template → 同 Scene | 样品与用户生成走同一套玩法引擎 | resolveAstrocadePlayRoute + templateFirst 全模板 | 16/16 template-first | qa:architecture-parity · qa:astrocade-user-path |
| ✅ aligned | Spec 自包含（无运行时 sampleId） | 玩法数据烘焙进项目 JSON | blueprint + enrichGameSpecForRuntime · 禁止 SAMPLE_MODES | 玩法变体由 GameSpec 蓝图字段 + prompt 语义推断写入 specJson | qa:architecture-parity · qa:template-polish |
| ✅ aligned | per-game 样品定制 | 每款样品有独立 polish / 机制增量 | spec.samplePlayProfile（17 registry + Scene 读 profile） | 17/17 profiles · enrich 烘焙 | qa:sample-profiles |
| ✅ aligned | 同 prompt 效果 parity | 同款描述 → 同款试玩效果（机制+视觉） | 同 prompt POST → inferSampleIdFromPrompt + 专用 Scene；canvas 截图对标 | 路由 17/17 · 视觉 17/17 · 全过 17/17 | qa:competitor-parity-validation · qa:prompt-parity-compare |
| ✅ aligned | 用户新建 vs 样品 polish | 精品 demo 每款独立机制/视觉 | 同 prompt 精确匹配 → inferSampleIdFromPrompt 套用 profile；否则 template 族默认 | infer 17/17 · profile 17/17 · qa:prompt-profile-infer | qa:prompt-profile-infer · qa:sample-profiles · qa:game-effect-compare |
| ✅ aligned | Primary 视觉 / juice 密度 | 每款高 polish 粒子/镜头/关卡 | 16 专用 Scene 族 + profile 增量；template 族 gameJuice + Godot GameJuice | qa:game-effect-compare 23 cases · qa:template-polish · qa:godot:juice-gate 11/11 | qa:game-effect-compare · qa:template-polish · qa:godot:juice-gate |
| ✅ aligned | 随机克隆效果 parity | Fork 竞品游戏 → 试玩效果一致 | duplicate 保留 specJson+profile · 随机抽样品对标 · canvas 截图对标 | 结构 5/5 · 全过 5/5 · astrocade-random-pick.json | qa:competitor-parity-validation · e2e/competitor-clone.smoke |
| ✅ aligned | Godot Secondary | 3D 预览 / 导出 | 16 语义模板导出 · 11 SubViewport runtime · profile 读入 | godotExport=16 · runtime profile 11/11 | qa:godot-3d-matrix · qa:godot:runtime-profile |
| ✅ aligned | Phaser ↔ Godot 双轨 polish | 3D 预览与 2D 试玩视觉一致 | 共享 GameSpec · Godot runtime 读 samplePlayProfile · customization 陶艺三部位对齐 | 11 Godot runtime 读 samplePlayProfile · GameJuice 11/11 · customization 三部位对齐 | qa:godot:runtime-profile · qa:godot:juice-gate · e2e/godot-runtime.smoke |
| ✅ aligned | 封面 ↔ 试玩资产 | 封面与 in-game 视觉一致 | V2 manifest · preload 双轨 | V2 manifest · qa:cover-play-alignment 色差 17.9 · 样品馆 canvas OK | qa:cover-play-alignment · qa:asset-alignment |
| ✅ aligned | Advanced LLM | 可选 AI 改写玩法 | Agentic tier · template-first 默认不走 LLM | monitor 16/16 llm · sandbox mock 15/15 · template-first 默认专用 Scene | qa:agentic-template-matrix · qa:llm-agentic:monitor:all · qa:agentic-sandbox-mock |
| ✅ aligned | i18n / 全球化 | 多语言样品与 UI | next-intl · Scene HUD 双语 · 样品 EN seed | 5 locales · qa:scene-hud-i18n 12 Scene · qa:samples-locale 17 samples | qa:scene-hud-i18n · qa:samples-locale · e2e/samples-en-matrix |
| ✅ aligned | 编排档位 astrocade | 统一高质量生成流水线 | PRODUCT.orchestration.qualityTier=astrocade · template-first 默认 | qualityTier=astrocade · agenticModule=true | qa:astrocade-pipeline · qa:orch-smoke |
| ✅ aligned | E2E 试玩冒烟 | 全样品可玩、无白屏 | Playwright samples-en + astrocade-agentic + godot matrix | test:e2e:astrocade · test:e2e:godot 17/17 · samples-en-matrix 17/17 | test:e2e:astrocade · test:e2e:godot |

**汇总**: aligned 15 · partial 0 · gap 0

**同 prompt 路由**: Scene 17/17 · template 17/17

## 平台级竞品差距（已闭合项见 aligned 支柱；剩余为产品策略非 blockers）

1. 非样品 prompt 走 template 族默认（与 Astrocade 非 demo 描述一致）
2. Primary 为 template 族 Scene，非竞品每款独立 JS 仓库
3. 精品 demo 绝对视觉密度可持续迭代

## 平台不变量

- 三层运行时
- 同 template → 同 Scene
- Spec 自包含（无运行时 sampleId）
- per-game 样品定制
- 同 prompt 效果 parity
- 用户新建 vs 样品 polish
- Primary 视觉 / juice 密度
- 随机克隆效果 parity
- Godot Secondary
- Phaser ↔ Godot 双轨 polish
- 封面 ↔ 试玩资产
- Advanced LLM
- i18n / 全球化
- 编排档位 astrocade
- E2E 试玩冒烟
