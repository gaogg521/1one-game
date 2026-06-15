# 产品改进 backlog（PM 视角）

更新时间：**2026-06-13**

## 已在本轮落地

| 痛点 | 改动 | 用户价值 |
|------|------|----------|
| 导演分镜失败只显示「漫画生成失败」 | `resolveComicRunErrorMessage` 保留可读错误 | 知道是 JSON/哪一页失败，便于重试 |
| 长篇必先跑导演包 ~8min 再 fallback | **快速分镜** 勾选 + `COMIC_FORCE_LIGHT_PIPELINE` | 试跑/长文改编可跳过导演，省时 |
| fallback 无感知 | 创作页 `pipeline_fallback` 琥珀色提示 | 用户知道质量路径已切换，非静默失败 |
| 导演 chunk JSON 脆弱 | 逐页降级（与 light 路径一致） | 降低整批 4 页失败概率 |
| 配图进度不可预期 | 阅读页/Studio 展示「剩余 N 格 · 约 M 分钟」 | 64 格场景跳出率 ↓ |
| Studio 分镜续跑入口弱 | 改编摘要 + `?resumeComic=` 深链 | 中断后可从 Studio 回到小说续跑 |
| 漫画发现无精选样例 | `featured=1` + 煤山 seed + 发现页「编辑精选」 | 新用户可一眼看到 64 格完整样例 |
| Studio 不知上次改了什么 | `/api/projects` 返回 `lastRefinement` + 卡片摘要 | 多回合共创可接续 |

## P0 — 下一迭代（建议）

| 项 | 说明 | 成功指标 |
|----|------|----------|
| 导演包成功路径监控 | director chunk 成功率仪表盘 | ✅ SSE 统计 + QA 门禁 |
| SSO 生产 IdP | Azure / 飞书 + `ADMIN_CONSOLE_HOST` | Console 企业登录可用 |
| 六模板章节感肉眼验收 | handtest 矩阵 | ✅ `qa:pm-handtest-signoff`；肉眼可选 |

## P1 — 体验 polish

| 项 | 说明 |
|----|------|
| 导演包成功路径 | 逐页降级已加；需 LLM 监控 director chunk 成功率 |
| 六模板章节感 | E2E 已覆盖加载；需 PM 肉眼勾选横幅/胜负（见 handtest 矩阵） |
| 共创多回合 | refine 已有；Studio 入口强化「上次精炼摘要」 | ✅ 游戏卡片 + 创作中心 |
| Console 生产 | SSO IdP 联调 + `ADMIN_CONSOLE_HOST` DNS |

## P2 — 增长 / 运营

| 项 | 说明 |
|----|------|
| 分享漏斗 | Console 已有；C 端分享后回流埋点 |
| 漫画发现 | 8 页样例（煤山）进 discover 精选位 | ✅ `seed:comic-featured-meishan` |
| 儿童线 | 五格 locked 画风 + 模块改编已就绪；需样例内容 |

## 非目标（当前阶段）

- C 端与 Console OAuth 合并
- SAML 手写解析
- 无测试的全模板 Godot 3D 扩展

## 验证

```bash
npm run qa:b-tier-smoke
npm run qa:comic-storyboard-resilience
npm run qa:historical-closure   # 需 dev @8888
```
