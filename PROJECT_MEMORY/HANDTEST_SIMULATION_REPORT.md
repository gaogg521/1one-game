# 手测模拟报告

生成时间：2026-05-17T11:09:59.286Z

```
# 手测模拟报告 · 2026-05-17T11:06:26.244Z
Base URL: http://localhost:8888
[OK] health 200

$ npm run qa:template-matrix

> game@0.1.0 qa:template-matrix
> tsx scripts/qa-template-matrix.ts

  [OK] avoider · 躲开从天而降的陨石…
  [OK] collector · 收集散落金币躲开尖刺…
  [OK] survivor · 多条命生存模式躲开尖刺…
  [OK] platformer · 横版闯关跳跃收集钥匙过关…
  [OK] towerDefense · 塔防卫萝卜波次守住基地…
  [OK] shooter · 飞船射击消灭敌机…
[OK] qa-template-matrix: 6/6 templates

$ npm run qa:director-spec

> game@0.1.0 qa:director-spec
> tsx scripts/qa-director-spec.ts

[OK] qa-director-spec: 6 mocks + buildDirector
[OK] qa-director-spec: coerceGameSpec keeps validated director

$ npm run qa:refinement-log

> game@0.1.0 qa:refinement-log
> tsx scripts/qa-refinement-log.ts

[OK] qa-refinement-log

## 漫画 8 页分镜（分段 LLM）
[OK] comic generate · 8 页 / 32 格 · 209.9s · id=cmp9ob8ky000k8gqe1kmbklya

[SUMMARY] 离线项通过
```
