# 回归扫雷 · 2026-06-15

## 本轮实测结果

| 套件 | 结果 | 说明 |
|------|------|------|
| `npm run build` | ✅ | 26 条 Turbopack 宽路径警告 |
| `qa:b-tier-smoke` | ✅ **21/21** | 修 migration P3009 后全绿 |
| `qa:spec-canonical-parity` | ✅ 17/17 | 仅断言 spec JSON |
| `qa:user-journey-parity` | ✅ | 主路径离线 |
| `qa:prod-sample-play-audit` | ✅ **17/17** | 加 API 重试后；此前 16/17 socket hang up |
| `qa:sample-ai-patch-audit` @prod | ✅ 4/4 | |
| `qa:competitor-clone-batch` all@prod | ✅ 17/17 | diff 0.4%–4.4% |
| `qa:competitor-gates` | ❌ 部分 | E2E 8888 端口冲突；godot matrix 0/17 |

## 当日发现的真实问题

1. **生产 Playwright 审计不稳定**：连续 17 款 GET 时偶发 `socket hang up`（非业务逻辑错）
2. **本地 ci.sqlite 迁移脏状态**：`user_auth_foundation` P3018/P3009 → b-tier 曾 20/21
3. **门禁与实机脱节**：离线 17/17 全绿，但人眼仍觉「远不如竞品」
4. **LLM patch 曾上线缺陷**：种田只改 gameplay 金币，运行时读 farming（已用 `syncFarmingStartingCoins` 修）

## 质量差的根因（结论）

- **测的是「能跑」不是「好玩/像竞品」**
- **视觉阈值偏松**（clone diff ≤12%）
- **交互只验像素变化，不验玩法深度**
- **工程门禁 flaky**，给人「全绿假象」
