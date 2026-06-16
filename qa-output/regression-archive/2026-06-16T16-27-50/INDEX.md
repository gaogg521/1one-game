# 回归报告归档

归档 ID：`2026-06-16T16-27-50`
生成时间：2026-06-16T16:27:50.185Z

## 快照摘要

| 来源 | 存在 | 备注 |
|------|------|------|
| `competitor-parity/REPORT.md` | ✅ | |
| `competitor-parity/summary.json` | ✅ | |
| `competitor-gates.json` | ✅ | |
| `platform-user-journey/REPORT.md` | ✅ | |
| `platform-user-journey/summary.json` | ✅ | |
| `user-journey-parity/REPORT.md` | ✅ | |
| `user-journey-parity/summary.json` | ✅ | |
| `literary-user-journey/summary.json` | ✅ | |
| `start-intake/REPORT.md` | ✅ | |
| `astrocade-competitor-matrix.md` | ✅ | |
| `godot-matrix/REPORT.md` | ✅ | |
| `godot-matrix/summary.json` | ✅ | |

## 竞品 / Godot 门禁（若已跑过 qa:competitor-gates）

## 竞品 strict parity（`competitor-parity/summary.json`）
- 生成时间：2026-06-16T16:12:42.861Z
- 总评：✅ 通过
- 同 prompt：17/17 全通过（路由 17/17 · 视觉 17/17）
- 随机克隆：5/5 全通过（结构 5/5）
- 本轮抽样：pottery-master-3d, rail-in-air, color-bloom, blocky-sniper-hunter, tiny-planet-chopper
- 明细报告：`qa-output/competitor-parity/REPORT.md`


- competitor-gates.e2eGodotOk：true
- competitor-gates 全绿：true

### Godot 模板矩阵

- 模板数：16
- e2eGodotOk：true
- E2E：e2e/godot-runtime.smoke.spec.ts · e2e/godot-templates-matrix.spec.ts
- 模板：towerDefense, coaster, racing, shooter, sniper, platformer, stealth, strategy, farming, puzzle, chess, customization, physics, survivor, collector, avoider

### Godot 试玩摘要（逐模板）

- 通过：17/17

| 模板 | 状态 | 耗时 |
|------|------|------|
| towerDefense | ✅ | 31.9s |
| coaster | ✅ | 31.6s |
| racing | ✅ | 31.4s |
| shooter | ✅ | 29.3s |
| sniper | ✅ | 28.8s |
| platformer | ✅ | 29.1s |
| stealth | ✅ | 30.2s |
| strategy | ✅ | 28.5s |
| farming | ✅ | 31.3s |
| puzzle | ✅ | 28.9s |
| chess | ✅ | 33.0s |
| customization | ✅ | 32.2s |
| physics | ✅ | 31.1s |
| survivor | ✅ | 30.1s |
| collector | ✅ | 30.0s |
| avoider | ✅ | 29.0s |

| 门禁项 | 状态 |
|--------|------|
| e2eAstrocadeOk | true |
| e2eCloneOk | true |
| e2eGodotOk | true |
| e2eSamplesEnOk | true |
| specCanonicalOk | true |
| parityValidationOk | true |

## 平台 PM

- platform-user-journey：通过/有数据

复跑：`npm run qa:platform-user-journey` · `COMPETITOR_PARITY_STRICT=1 npm run qa:competitor-parity-validation` · `npm run qa:competitor-gates`
