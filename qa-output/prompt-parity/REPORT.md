# 同提示词差距报告（样品 vs 用户 POST）

生成时间：2026-06-13T19:04:18.467Z

## 摘要

- 样品数：**17**
- Scene 路由一致：**17/17**
- templateId 完全一致：**17/17**

说明：样品 seed 可用 `sampleId` override 修正模板；用户 POST 仅 prompt+mock 推断。Scene 一致即架构 parity 成立。

## 平台级竞品差距（共性）

1. **Primary Scene 为 template 族通用实现**，非 Astrocade 每款独立脚本
2. **视觉/关卡密度/juice** 仍低于竞品精品 demo
3. **Godot Secondary** 与 Phaser Primary polish 不一致
4. **LLM Advanced** 路径默认关闭；竞品部分游戏为深度定制逻辑

## 明细

| 样品 | 同 prompt | 样品 Scene | 用户 Scene | 模板一致 | 截图 |
|------|-----------|------------|------------|----------|------|
| Smash the Dummy | 97 字 | PhysicsScene | PhysicsScene | ✅ | sample/user PNG |
| Rail in Air | 105 字 | CoasterScene | CoasterScene | ✅ | sample/user PNG |
| Grow a Garden | 65 字 | FarmingScene | FarmingScene | ✅ | sample/user PNG |
| Color Bloom | 71 字 | PuzzleScene | PuzzleScene | ✅ | sample/user PNG |
| Whimsy Differences | 71 字 | PuzzleScene | PuzzleScene | ✅ | sample/user PNG |
| Gun Merge 3D: Zombie Apocalypse | 90 字 | TowerDefenseScene | TowerDefenseScene | ✅ | sample/user PNG |
| Ultimate 3D Chess | 83 字 | ChessScene | ChessScene | ✅ | sample/user PNG |
| Elastic Thief 2 | 73 字 | PlatformerScene | PlatformerScene | ✅ | sample/user PNG |
| State Conquest | 66 字 | StrategyScene | StrategyScene | ✅ | sample/user PNG |
| Tiny Planet Chopper | 93 字 | ShooterScene | ShooterScene | ✅ | sample/user PNG |
| Blade Defender Merge | 89 字 | TowerDefenseScene | TowerDefenseScene | ✅ | sample/user PNG |
| Car Color Palette | 73 字 | CustomizationScene | CustomizationScene | ✅ | sample/user PNG |
| BLOCKY SNIPER HUNTER | 97 字 | ShooterScene | ShooterScene | ✅ | sample/user PNG |
| Memory Match Mania | 66 字 | PuzzleScene | PuzzleScene | ✅ | sample/user PNG |
| KIDS PUZZLE | 73 字 | PuzzleScene | PuzzleScene | ✅ | sample/user PNG |
| Pottery Master 3D | 83 字 | CustomizationScene | CustomizationScene | ✅ | sample/user PNG |
| Crashy Roads | 67 字 | CoasterScene | CoasterScene | ✅ | sample/user PNG |

## 差距说明

### Smash the Dummy (`smash-the-dummy`)

- 路由已对齐；视觉 polish 需目视对比 sample/user 截图
- 竞品差距（平台级）：专用 Scene 为 template 族通用实现，非 Astrocade 每款定制 JS；juice/3D/关卡密度仍低于竞品

- 样品截图：`qa-output\prompt-parity\sample-smash-the-dummy.png`
- 用户截图：`qa-output\prompt-parity\user-smash-the-dummy.png`

### Rail in Air (`rail-in-air`)

- 路由已对齐；视觉 polish 需目视对比 sample/user 截图
- 竞品差距（平台级）：专用 Scene 为 template 族通用实现，非 Astrocade 每款定制 JS；juice/3D/关卡密度仍低于竞品

- 样品截图：`qa-output\prompt-parity\sample-rail-in-air.png`
- 用户截图：`qa-output\prompt-parity\user-rail-in-air.png`

### Grow a Garden (`grow-a-garden`)

- 路由已对齐；视觉 polish 需目视对比 sample/user 截图
- 竞品差距（平台级）：专用 Scene 为 template 族通用实现，非 Astrocade 每款定制 JS；juice/3D/关卡密度仍低于竞品

- 样品截图：`qa-output\prompt-parity\sample-grow-a-garden.png`
- 用户截图：`qa-output\prompt-parity\user-grow-a-garden.png`

### Color Bloom (`color-bloom`)

- 路由已对齐；视觉 polish 需目视对比 sample/user 截图
- 竞品差距（平台级）：专用 Scene 为 template 族通用实现，非 Astrocade 每款定制 JS；juice/3D/关卡密度仍低于竞品

- 样品截图：`qa-output\prompt-parity\sample-color-bloom.png`
- 用户截图：`qa-output\prompt-parity\user-color-bloom.png`

### Whimsy Differences (`whimsy-differences`)

- 路由已对齐；视觉 polish 需目视对比 sample/user 截图
- 竞品差距（平台级）：专用 Scene 为 template 族通用实现，非 Astrocade 每款定制 JS；juice/3D/关卡密度仍低于竞品

- 样品截图：`qa-output\prompt-parity\sample-whimsy-differences.png`
- 用户截图：`qa-output\prompt-parity\user-whimsy-differences.png`

### Gun Merge 3D: Zombie Apocalypse (`gun-merge-3d-zombie-apocalypse`)

- 路由已对齐；视觉 polish 需目视对比 sample/user 截图
- 竞品差距（平台级）：专用 Scene 为 template 族通用实现，非 Astrocade 每款定制 JS；juice/3D/关卡密度仍低于竞品

- 样品截图：`qa-output\prompt-parity\sample-gun-merge-3d-zombie-apocalypse.png`
- 用户截图：`qa-output\prompt-parity\user-gun-merge-3d-zombie-apocalypse.png`

### Ultimate 3D Chess (`ultimate-3d-chess`)

- 路由已对齐；视觉 polish 需目视对比 sample/user 截图
- 竞品差距（平台级）：专用 Scene 为 template 族通用实现，非 Astrocade 每款定制 JS；juice/3D/关卡密度仍低于竞品

- 样品截图：`qa-output\prompt-parity\sample-ultimate-3d-chess.png`
- 用户截图：`qa-output\prompt-parity\user-ultimate-3d-chess.png`

### Elastic Thief 2 (`elastic-thief-2`)

- 路由已对齐；视觉 polish 需目视对比 sample/user 截图
- 竞品差距（平台级）：专用 Scene 为 template 族通用实现，非 Astrocade 每款定制 JS；juice/3D/关卡密度仍低于竞品

- 样品截图：`qa-output\prompt-parity\sample-elastic-thief-2.png`
- 用户截图：`qa-output\prompt-parity\user-elastic-thief-2.png`

### State Conquest (`state-conquest`)

- 路由已对齐；视觉 polish 需目视对比 sample/user 截图
- 竞品差距（平台级）：专用 Scene 为 template 族通用实现，非 Astrocade 每款定制 JS；juice/3D/关卡密度仍低于竞品

- 样品截图：`qa-output\prompt-parity\sample-state-conquest.png`
- 用户截图：`qa-output\prompt-parity\user-state-conquest.png`

### Tiny Planet Chopper (`tiny-planet-chopper`)

- 路由已对齐；视觉 polish 需目视对比 sample/user 截图
- 竞品差距（平台级）：专用 Scene 为 template 族通用实现，非 Astrocade 每款定制 JS；juice/3D/关卡密度仍低于竞品

- 样品截图：`qa-output\prompt-parity\sample-tiny-planet-chopper.png`
- 用户截图：`qa-output\prompt-parity\user-tiny-planet-chopper.png`

### Blade Defender Merge (`blade-defender-merge`)

- 路由已对齐；视觉 polish 需目视对比 sample/user 截图
- 竞品差距（平台级）：专用 Scene 为 template 族通用实现，非 Astrocade 每款定制 JS；juice/3D/关卡密度仍低于竞品

- 样品截图：`qa-output\prompt-parity\sample-blade-defender-merge.png`
- 用户截图：`qa-output\prompt-parity\user-blade-defender-merge.png`

### Car Color Palette (`car-color-palette`)

- 路由已对齐；视觉 polish 需目视对比 sample/user 截图
- 竞品差距（平台级）：专用 Scene 为 template 族通用实现，非 Astrocade 每款定制 JS；juice/3D/关卡密度仍低于竞品

- 样品截图：`qa-output\prompt-parity\sample-car-color-palette.png`
- 用户截图：`qa-output\prompt-parity\user-car-color-palette.png`

### BLOCKY SNIPER HUNTER (`blocky-sniper-hunter`)

- 路由已对齐；视觉 polish 需目视对比 sample/user 截图
- 竞品差距（平台级）：专用 Scene 为 template 族通用实现，非 Astrocade 每款定制 JS；juice/3D/关卡密度仍低于竞品

- 样品截图：`qa-output\prompt-parity\sample-blocky-sniper-hunter.png`
- 用户截图：`qa-output\prompt-parity\user-blocky-sniper-hunter.png`

### Memory Match Mania (`memory-match-mania`)

- 路由已对齐；视觉 polish 需目视对比 sample/user 截图
- 竞品差距（平台级）：专用 Scene 为 template 族通用实现，非 Astrocade 每款定制 JS；juice/3D/关卡密度仍低于竞品

- 样品截图：`qa-output\prompt-parity\sample-memory-match-mania.png`
- 用户截图：`qa-output\prompt-parity\user-memory-match-mania.png`

### KIDS PUZZLE (`kids-puzzle`)

- 路由已对齐；视觉 polish 需目视对比 sample/user 截图
- 竞品差距（平台级）：专用 Scene 为 template 族通用实现，非 Astrocade 每款定制 JS；juice/3D/关卡密度仍低于竞品

- 样品截图：`qa-output\prompt-parity\sample-kids-puzzle.png`
- 用户截图：`qa-output\prompt-parity\user-kids-puzzle.png`

### Pottery Master 3D (`pottery-master-3d`)

- 路由已对齐；视觉 polish 需目视对比 sample/user 截图
- 竞品差距（平台级）：专用 Scene 为 template 族通用实现，非 Astrocade 每款定制 JS；juice/3D/关卡密度仍低于竞品

- 样品截图：`qa-output\prompt-parity\sample-pottery-master-3d.png`
- 用户截图：`qa-output\prompt-parity\user-pottery-master-3d.png`

### Crashy Roads (`crashy-roads`)

- 路由已对齐；视觉 polish 需目视对比 sample/user 截图
- 竞品差距（平台级）：专用 Scene 为 template 族通用实现，非 Astrocade 每款定制 JS；juice/3D/关卡密度仍低于竞品

- 样品截图：`qa-output\prompt-parity\sample-crashy-roads.png`
- 用户截图：`qa-output\prompt-parity\user-crashy-roads.png`
