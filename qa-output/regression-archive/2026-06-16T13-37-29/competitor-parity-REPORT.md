# 竞品对标双验证报告

生成时间：2026-06-16T13:37:28.281Z

## 验证方法（用户定义）

1. **同样提示词**：样品馆 spec 与用户 POST（同 prompt 文本）→ 同 Scene + 同 profile + 视觉接近
2. **随机克隆**：从 17 款 Astrocade 对标样品中随机抽 N 款 duplicate → 保留 profile、同 Scene、试玩视觉接近

## 摘要

| 验证 | 路由/结构 | 视觉 | 全通过 |
|------|-----------|------|--------|
| 同 prompt（17） | 17/17 | 17/17 | 17/17 |
| 随机克隆（5） | 5/5 | 5/5 | 5/5 |

### 全局阈值（不按样品分档）

- 同 prompt：色差 ≤40 · diff ≤18%
- 克隆：色差 ≤32 · diff ≤8%

## 同 prompt 明细

| 样品 | Scene | Profile | 色差 | diff% | 视觉 |
|------|-------|---------|------|-------|------|
| Smash the Dummy | ✅ | ✅ | 1.0 | 0 | ✅ |
| Rail in Air | ✅ | ✅ | 0.0 | 4 | ✅ |
| Grow a Garden | ✅ | ✅ | 1.0 | 2 | ✅ |
| Color Bloom | ✅ | ✅ | 1.0 | 2 | ✅ |
| Whimsy Differences | ✅ | ✅ | 0.0 | 0 | ✅ |
| Gun Merge 3D: Zombie Apocalypse | ✅ | ✅ | 0.0 | 2 | ✅ |
| Ultimate 3D Chess | ✅ | ✅ | 0.0 | 1 | ✅ |
| Elastic Thief 2 | ✅ | ✅ | 0.0 | 0 | ✅ |
| State Conquest | ✅ | ✅ | 0.0 | 0 | ✅ |
| Tiny Planet Chopper | ✅ | ✅ | 0.0 | 0 | ✅ |
| Blade Defender Merge | ✅ | ✅ | 0.0 | 0 | ✅ |
| Car Color Palette | ✅ | ✅ | 0.0 | 1 | ✅ |
| BLOCKY SNIPER HUNTER | ✅ | ✅ | 0.0 | 1 | ✅ |
| Memory Match Mania | ✅ | ✅ | 0.0 | 0 | ✅ |
| KIDS PUZZLE | ✅ | ✅ | 1.0 | 0 | ✅ |
| Pottery Master 3D | ✅ | ✅ | 0.0 | 0 | ✅ |
| Crashy Roads | ✅ | ✅ | 0.0 | 0 | ✅ |

## 随机克隆明细

| 样品 | profile | Scene | 色差 | diff% | 视觉 |
|------|---------|-------|------|-------|------|
| Pottery Master 3D | ✅ | ✅ | 0.0 | 0 | ✅ |
| Rail in Air | ✅ | ✅ | 0.0 | 4 | ✅ |
| Color Bloom | ✅ | ✅ | 1.0 | 2 | ✅ |
| BLOCKY SNIPER HUNTER | ✅ | ✅ | 0.0 | 1 | ✅ |
| Tiny Planet Chopper | ✅ | ✅ | 0.0 | 0 | ✅ |
