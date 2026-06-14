# 游戏效果对比报告

生成时间：2026-06-13T19:08:18.971Z

## 结论摘要

| 路径 | 数量 | 平均 canvas 就绪 | 说明 |
|------|------|------------------|------|
| 样品专用场景 | 17 | 1113ms | 样品馆标杆 |
| 用户专用 Scene | 6 | 1243ms | template-first 与样品同路由 |

## Astrocade 对齐

- **样品馆与用户新生成**：同模板均路由专用 Scene（Physics/Coaster/Strategy/Customization 等）
- **LLM 定制玩法**：`AGENTIC_FORCE_LLM=1` 时仍走 AgenticScene（高级定制路径）
- **Godot 3D**：部分样品有 SubViewport 3D；全模板 Godot 仍在演进

## 明细

| ID | 路径 | 模板 | Scene | Canvas(ms) | 截图 |
|----|------|------|-------|------------|------|
| sample-smash-the-dummy | sample | physics | PhysicsScene | 2164 | qa-output\game-effect\sample-smash-the-dummy.png |
| sample-rail-in-air | sample | coaster | CoasterScene | 1057 | qa-output\game-effect\sample-rail-in-air.png |
| sample-state-conquest | sample | strategy | StrategyScene | 1216 | qa-output\game-effect\sample-state-conquest.png |
| sample-car-color-palette | sample | customization | CustomizationScene | 1401 | qa-output\game-effect\sample-car-color-palette.png |
| sample-grow-a-garden | sample | farming | FarmingScene | 879 | qa-output\game-effect\sample-grow-a-garden.png |
| sample-color-bloom | sample | puzzle | PuzzleScene | 999 | qa-output\game-effect\sample-color-bloom.png |
| sample-ultimate-3d-chess | sample | chess | ChessScene | 1162 | qa-output\game-effect\sample-ultimate-3d-chess.png |
| sample-tiny-planet-chopper | sample | shooter | ShooterScene | 810 | qa-output\game-effect\sample-tiny-planet-chopper.png |
| sample-gun-merge-3d-zombie-apocalypse | sample | towerDefense | TowerDefenseScene | 1191 | qa-output\game-effect\sample-gun-merge-3d-zombie-apocalypse.png |
| sample-pottery-master-3d | sample | customization | CustomizationScene | 1006 | qa-output\game-effect\sample-pottery-master-3d.png |
| sample-crashy-roads | sample | racing | CoasterScene | 1120 | qa-output\game-effect\sample-crashy-roads.png |
| sample-elastic-thief-2 | sample | stealth | PlatformerScene | 1078 | qa-output\game-effect\sample-elastic-thief-2.png |
| sample-blocky-sniper-hunter | sample | shooter | ShooterScene | 1103 | qa-output\game-effect\sample-blocky-sniper-hunter.png |
| sample-whimsy-differences | sample | puzzle | PuzzleScene | 978 | qa-output\game-effect\sample-whimsy-differences.png |
| sample-memory-match-mania | sample | puzzle | PuzzleScene | 895 | qa-output\game-effect\sample-memory-match-mania.png |
| sample-kids-puzzle | sample | puzzle | PuzzleScene | 880 | qa-output\game-effect\sample-kids-puzzle.png |
| sample-blade-defender-merge | sample | towerDefense | TowerDefenseScene | 976 | qa-output\game-effect\sample-blade-defender-merge.png |
| user-physics-dedicated | user | physics | PhysicsScene | 1243 | qa-output\game-effect\user-physics-dedicated.png |
| user-strategy-infer | user | strategy | StrategyScene | 1225 | qa-output\game-effect\user-strategy-infer.png |
| user-platformer-infer | user | stealth | PlatformerScene | 2307 | qa-output\game-effect\user-platformer-infer.png |
| user-puzzle-whimsy-infer | user | puzzle | PuzzleScene | 23003 | qa-output\game-effect\user-puzzle-whimsy-infer.png |
| user-puzzle-memory-infer | user | puzzle | PuzzleScene | 1972 | qa-output\game-effect\user-puzzle-memory-infer.png |
| user-td-blade-infer | user | towerDefense | TowerDefenseScene | 2571 | qa-output\game-effect\user-td-blade-infer.png |

## 目视对比

打开 `qa-output/game-effect/` 下 PNG，并排对比：
- `sample-smash-the-dummy.png` vs `user-physics-dedicated.png`（同 PhysicsScene）
- `sample-state-conquest.png` vs `user-strategy-infer.png`（profile infer → StrategyScene）
- `sample-elastic-thief-2.png` vs `user-platformer-infer.png`（profile infer → PlatformerScene）
- `sample-rail-in-air.png`（CoasterScene 标杆）
- `sample-blocky-sniper-hunter.png`（ShooterScene 狙击 scope）
- `sample-whimsy-differences.png` vs `user-puzzle-whimsy-infer.png`（profile infer → PuzzleScene 找不同）
- `sample-memory-match-mania.png` vs `user-puzzle-memory-infer.png`（计时翻牌 infer）
- `sample-blade-defender-merge.png` vs `user-td-blade-infer.png`（merge 塔防 infer）
- `sample-kids-puzzle.png`（儿童拼图 jigsaw）
