# Agentic 沙箱 Mock 缺口清单

更新时间：**2026-06-13**

策略：**全 16 语义模板 template-first + 已验证 fallback**；Mock 仅补「高频且已观测」项；LLM 路径用 `AGENTIC_FORCE_LLM=1` 抽检。

## 已覆盖（`agentic-runnable.ts` MOCK_PHASER）

| API | 状态 |
|-----|------|
| `scene.add.rectangle/text/image/sprite/circle/star/graphics` | ✅ |
| `rectangle.setInteractive().on(...)` | ✅（2026-06-13） |
| `group.getChildren` / `scene.add.group` | ✅（2026-06-13） |
| `keyboard.createCursorKeys` | ✅（2026-06-13） |
| `text.setScrollFactor` / `cameras.main.startFollow` | ✅（2026-06-13） |
| `graphics.strokeCircle` | ✅（2026-06-13） |
| `scene.add.container` + `.add()` | ✅（2026-06-12） |
| `scene.physics.add.existing/sprite/staticSprite/staticImage/group/staticGroup` | ✅ |
| `scene.physics.world.setBounds` | ✅ |
| `scene.cameras.main.setBackgroundColor` | ✅ |
| `scene.input.on` / `keyboard.addKey(s)` | ✅ |
| `scene.input.addPointer` | ✅ |
| `scene.time.addEvent/delayedCall/now` | ✅ |
| `scene.tweens.add` | ✅ |
| `scene.make.graphics` + `generateTexture` | ✅ |
| `Phaser.Math.Clamp/Between` | ✅ |
| body 链式 `setVelocity/setBounce/setDrag/setCollideWorldBounds` | ✅ |

## 已知缺口（观测到 LLM 用过但未 mock / 不完整）

| 优先级 | API / 模式 | 典型模板 | 处理策略 |
|--------|------------|----------|----------|
| P1 | `scene.add.tileSprite` / `tilemap` | platformer, farming | **prompt 禁止**；fallback 已覆盖 |
| P1 | Matter.js `constraint` / `worldConstraint` | physics | **prompt 禁止** + system 规则 |
| P2 | `scene.add.polygon` / `ellipse` | 泛化 | 按需补 mock 或 repair |
| P2 | `scene.physics.add.overlap` 回调内 destroy 链 | shooter | mock 已有 overlap noop；真机 Phaser 无问题 |
| P3 | `scene.sound.add` / 音频 | 任意 | 允许失败；AgenticScene 外层有 soundscape |
| P3 | `scene.anims.create` / 精灵表 | platformer | prompt 禁止；专用 Scene 负责 |

## 全模板 fallback（`template-fallback-modules.ts`）

| templateId | 模块 | 说明 |
|------------|------|------|
| avoider / collector / survivor | ARENA_* | 横移 + 物理 group，对齐 PlayScene 三模式 |
| towerDefense | TD_LANE | 塔位槽 + 敌群（不再误用 strategy） |
| chess | CHESS_LITE | 8×8 点选走子 |
| customization | CUSTOMIZE_PAINT | 调色盘 + 车身预览 |
| coaster / racing | COASTER_RACE | 伪 3D 轨道 |
| physics / shooter / sniper / puzzle / farming / platformer / stealth / strategy | 既有模块 | 见源码 |

默认 **`AGENTIC_TEMPLATE_FIRST`** = 全部 `GAME_TEMPLATE_IDS`（可用 env 缩窄）。

## Prompt / 生成策略（减少 repair）

| 模板 | 措施 |
|------|------|
| **全 16 模板** | 默认 template-first；`agentic-prompts.ts` 每模板 user/repair 约束 |
| **physics / shooter / coaster** | 高保真 fallback + 样品 Scene 对标 |
| 其它 | 可辨认玩法 fallback；专用 Scene 仍高于 Agentic polish |

## 验证命令

```bash
npm run qa:agentic-template-matrix   # 16/16 fallback runnable
npm run qa:llm-agentic               # 16/16 template_first（默认无 LLM）
AGENTIC_FORCE_LLM=1 npm run qa:llm-agentic   # 实机 LLM 抽检
npm run qa:agentic-sandbox          # physics 离线 smoke
npm run qa:agentic-repair           # repair 管线
npx playwright test e2e/create-generate-stream-agentic.spec.ts
AGENTIC_QA_CASE=physics AGENTIC_FORCE_LLM=1 npx tsx scripts/qa-llm-agentic-debug.ts  # 单模板 LLM 诊断
```

## 何时补 Mock vs 收紧 Prompt

- **补 Mock**：同一 API 在 ≥2 次 LLM QA 中重复导致 runnable 失败，且 prompt 禁止后仍出现。
- **收紧 Prompt / template-first**：有已验证 fallback 结构（physics/shooter/coaster 等），优先短路 LLM。
