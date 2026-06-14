# Astrocade 平台技术架构对齐

更新时间：**2026-06-13**

## 目标

与 Astrocade 对齐的是**平台架构**，不是为每一款克隆游戏打补丁。

## 三层运行时

```
┌─────────────────────────────────────────────────────────┐
│ Primary（默认）  Phaser 专用 Scene                        │
│   样品馆 · 用户 template-first · duplicate 克隆           │
│   同 templateId → 同 Scene · normalize 剥离旧 agentic   │
├─────────────────────────────────────────────────────────┤
│ Secondary        Godot ai-mother-universal（Web/导出）    │
│   11 模板 SubViewport 3D · 与 Primary 共享 GameSpec       │
├─────────────────────────────────────────────────────────┤
│ Advanced         Agentic LLM 定制                         │
│   AGENTIC_FORCE_LLM=1 或显式 attach · AgenticScene       │
└─────────────────────────────────────────────────────────┘
```

## 平台不变量

1. **路由 parity**：样品 / 用户 / 克隆走同一套 `resolveAstrocadePlayRoute`
2. **Spec 自包含**：玩法变体写入 `GameSpec` 蓝图（puzzle/coaster/customization…），**运行时不再读 sampleId**
3. **模板注册表**：新玩法 = 新 template + Scene + blueprint enricher，而非 `SAMPLE_MODES[某游戏]`
4. **资产 parity**：封面 V2 manifest ↔ 试玩 preload
5. **QA**：`qa:architecture-parity` + **`qa:prompt-parity-compare`**（同 prompt 样品 vs 用户）

## 代码入口

| 模块 | 职责 |
|------|------|
| `src/lib/astrocade-architecture.ts` | 路由解析、parity 检查、不变量 |
| `src/lib/astrocade-play-spec.ts` | 试玩前 normalize |
| `src/lib/product-config.ts` | `dedicatedSceneForTemplateFirst` / `agenticTemplateFirst` |
| `src/lib/game-templates/registry.ts` | 语义模板 → Phaser/Godot 族 |
| `scripts/qa-architecture-parity.ts` | 全模板门禁 |

## 验证

```bash
npm run qa:architecture-parity
npm run qa:astrocade-competitor-matrix   # 竞品 10+ 支柱对照 + 运行时断言
npm run qa:astrocade-user-path
npm run qa:prompt-parity-compare
```

## 竞品架构对照矩阵

完整对照表由 `npm run qa:astrocade-competitor-matrix` 生成，报告见 **`qa-output/astrocade-competitor-matrix.md`**。

源码：`src/lib/astrocade-competitor-matrix.ts`

| 状态 | 含义 |
|------|------|
| ✅ aligned | 平台架构与 Astrocade 同级 |
| ⚠️ partial | 架构已对齐， polish/体验/可选路径仍有差距 |
| ❌ gap | 架构 blockers，需优先修复 |

**已 aligned（7+）**：三层运行时、同 template→Scene、Spec 自包含、17 samplePlayProfile、duplicate 克隆、Godot Secondary、同 prompt Scene 路由（17/17）、编排档位 astrocade。

**有意 partial（持续 polish）**：用户新建无 profile、Primary juice 密度、封面↔试玩、Phaser↔Godot 双轨、Advanced LLM、i18n、E2E 冒烟。

**禁止用 partial 项驱动 per-game SAMPLE_MODES 补丁** — 增量应走 `samplePlayProfile` 或 template 族 Scene polish。

## 反模式（禁止）

- 在 `*-blueprint.ts` 里为单个 Astrocade 游戏加 `SAMPLE_MODES`
- 用 `qa-competitor-clone-compare` 的 per-game FEATURE_MATRIX 驱动研发
- 默认用户路径走 AgenticScene 而样品走专用 Scene
