# B 档 · 六模板手测矩阵

更新时间：**2026-05-17**

## 自动化（离线 / CI）

| 检查项 | 命令 | 期望 |
|--------|------|------|
| 六模板 mock + director + systems | `npm run qa:template-matrix` | 6/6 OK |
| Director 保底事件 | `npm run qa:director-spec` | OK |
| Refinement 日志 | `npm run qa:refinement-log` | OK |
| Refinement E2E | `scripts/run-e2e-refinement.ps1` | 7/7 |
| 共创保存 E2E | `e2e/create-play.smoke.spec.ts` | 2/2 |
| 六模板试玩 E2E | `e2e/templates-handtest.spec.ts` | 8/8 |
| 小说/漫画页 E2E | `e2e/novel-comic.smoke.spec.ts` | 5/5 |
| 漫画 8 页分镜 HTTP | `COMIC_HANDTEST=1 node scripts/simulate-handtest.mjs` | 8 页 / 32 格（~206s） |
| 一键脚本 | `scripts/run-handtest-all.ps1` | 见上 |
| 构建 | `npm run build` | 通过 |

## 浏览器手测（每模板 1 条 prompt）

在 `/create` 四步共创 → 试玩 → 观察章节横幅 / 事件 / 胜负。

| 模板 | 建议 prompt | 观察点 |
|------|-------------|--------|
| avoider | 躲开从天而降的陨石 | 险避加分、终局 `finalBarrage` 横幅 |
| collector | 收集散落金币躲开尖刺 | 连收 combo、黄金收集物、险境收集物 |
| survivor | 多条命生存模式躲开尖刺 | 生命条、最后一波倒计时、喘息窗口 |
| platformer | 横版闯关跳跃收集钥匙 | 章节段落（断层/精准跳）、平台与守卫 |
| towerDefense | 塔防卫萝卜波次守住基地 | 波次、建塔、精英/rush 变奏 |
| shooter | 飞船射击消灭敌机 | 技能键 Shift、miniBoss、coinRain |

## 共创闭环手测

1. `/create` 输入 → 四步 → 生成试玩  
2. `/play/[id]` 局部 patch → **应用并保存** → 刷新后标题/ spec 已更新  
3. `/create?from=[id]` 可见精炼摘要（若曾 refine）  
4. 访客打开同链接：无 refine 按钮、无 refinementHistory  

## 勾选

- [x] 离线六模板矩阵 `qa:template-matrix`（2026-05-17，6/6）  
- [x] Refinement E2E 7/7（2026-05-17）  
- [x] 共创保存 E2E 2/2（2026-05-17）  
- [x] 六模板浏览器手测 E2E 8/8（canvas + 全屏/重开 + 标题，2026-05-17）  
- [x] 漫画 8 页分段分镜 HTTP 实测（2026-05-17，`cmp9mqea8000h5cxxygt8c4i2`，~280s）  
- [ ] 漫画 **32 格配图** SSE 长测（~40+ 分钟，按需）  
- [ ] 六模板**肉眼**玩一局（章节横幅/事件/胜负 — 自动化无法替代）  
