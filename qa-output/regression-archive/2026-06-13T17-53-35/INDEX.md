# 回归报告归档

归档 ID：`2026-06-13T17-53-35`
生成时间：2026-06-13T17:53:35.648Z

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
| `godot-matrix/REPORT.md` | — | |
| `godot-matrix/summary.json` | — | |

## 竞品 / Godot 门禁（若已跑过 qa:competitor-gates）

## 竞品 strict parity（`competitor-parity/summary.json`）
- 生成时间：2026-06-13T09:59:48.439Z
- 总评：✅ 通过
- 同 prompt：17/17 全通过（路由 17/17 · 视觉 17/17）
- 随机克隆：5/5 全通过（结构 5/5）
- 本轮抽样：blocky-sniper-hunter, crashy-roads, pottery-master-3d, memory-match-mania, gun-merge-3d-zombie-apocalypse
- 明细报告：`qa-output/competitor-parity/REPORT.md`


- competitor-gates.e2eGodotOk：true
- competitor-gates 全绿：true


## 平台 PM

- platform-user-journey：通过/有数据

复跑：`npm run qa:platform-user-journey` · `COMPETITOR_PARITY_STRICT=1 npm run qa:competitor-parity-validation` · `npm run qa:competitor-gates`
