# 历史问题闭环清单

更新时间：**2026-06-13**

一键总验：`npm run qa:historical-closure`

## 对话期历史问题 → 状态

| # | 问题 | 状态 | 验证 |
|---|------|------|------|
| 1 | Agentic physics 向 PhysicsScene 靠拢 | ✅ | template-first + PHYSICS_DUMMY（重力/collider/hazard/juice） |
| 2 | template-first 短路 LLM | ✅ | 默认全 `GAME_TEMPLATE_IDS`；env 可缩窄 |
| 3 | 沙箱 Mock 不完整 | ✅ 策略闭合 | `AGENTIC_MOCK_GAPS.md` + prompt/repair 收紧，按需补 Mock |
| 4 | 封面↔试玩资产一致 | ✅ | V2 manifest + AgenticScene preload + `qa:cover-play-alignment` |
| 5 | 实机文生图 cover↔试玩 | ✅ | 异步触发+轮询 8min；本轮 dist=7.1（真实生成） |
| 6 | 创作页 generate/stream 实机 | ✅ | UI E2E stub + `qa:generate-stream-sse` HTTP SSE |
| 7 | generate/stream lib 路径 agentic | ✅ | `qa:generate-stream-agentic` |
| 8 | POST 项目 attach agentic | ✅ | `e2e/astrocade-agentic.smoke` |
| 9 | E2E 并行导致创作页按钮 disabled | ✅ | `--workers=1` + 等待 enabled |
| 10 | qa:full handtest 漫画 LLM 超时 | ✅ | `E2E_COMIC_STUB=1`（dev 需同 env）；未设则 SKIP 不阻断 |
| 11 | build setFriction 重复 | ✅ | 已修 |
| 12 | qa-agentic-sandbox PHYSICS 结构 | ✅ | collider/gravity mock |
| 13 | qa:cover-play 未授权 POST | ✅ | 先 `goto /` 写 cookie |
| 14 | 效果对比含页面 chrome | ✅ | 仅截 canvas |
| 15 | Agentic 无 juice | ✅ | AgenticScene physics onScore → juiceShake |
| 16 | 漫画导演分镜错误信息丢失 | ✅ | `resolveComicRunErrorMessage` 保留可读 Error.message |
| 17 | 导演 chunk 整批 JSON 失败 | ✅ | `fetchComicStoryboardChunk` 逐页降级 |
| 18 | 长篇必先跑导演包再 fallback | ✅ | UI「快速分镜」+ `COMIC_FORCE_LIGHT_PIPELINE` |
| 19 | 配图 ETA 与 Studio 分镜续跑 | ✅ | `comic-panel-eta` + 改编摘要 `resumeComic` 深链 |

## 仍属产品差距（非阻断 bug）

| 项 | 说明 |
|----|------|
| LLM Agentic polish | 低于样品专用 Scene；`AGENTIC_MONITOR=1 npm run qa:llm-agentic:monitor` |
| 全模板 Godot 3D | ✅ 11/11 SubViewport；`qa:godot-3d-matrix` |
| 创作页 SSE 实机 LLM | E2E 用 stub；真实 LLM 走 lib/HTTP QA |

## 命令

```bash
npm run qa:historical-closure          # 历史问题总验（~90s，需 dev @8888）
npm run qa:full                        # 全量（含 migrate/build/E2E/handtest）
RUN_REAL_IMAGE_GEN=1 npm run qa:cover-play-alignment
AGENTIC_MONITOR=1 npm run qa:llm-agentic:monitor
```
