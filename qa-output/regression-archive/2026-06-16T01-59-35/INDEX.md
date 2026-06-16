# 回归报告归档

归档 ID：`2026-06-16T01-59-35`
生成时间：2026-06-16T01:59:35.178Z

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
- 生成时间：2026-06-16T01:59:34.289Z
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
| towerDefense | ✅ | 23.9s |
| coaster | ✅ | 22.8s |
| racing | ✅ | 22.4s |
| shooter | ✅ | 23.5s |
| sniper | ✅ | 23.4s |
| platformer | ✅ | 24.1s |
| stealth | ✅ | 25.1s |
| strategy | ✅ | 24.8s |
| farming | ✅ | 26.2s |
| puzzle | ✅ | 23.5s |
| chess | ✅ | 24.0s |
| customization | ✅ | 22.6s |
| physics | ✅ | 24.8s |
| survivor | ✅ | 25.8s |
| collector | ✅ | 21.4s |
| avoider | ✅ | 23.3s |

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
