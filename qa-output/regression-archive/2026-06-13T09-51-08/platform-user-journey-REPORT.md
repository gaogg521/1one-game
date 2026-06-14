# 平台 PM 用户主路径（汇总）

生成时间：2026-06-13T09:51:08.409Z

## 模块

| 模块 | 离线 QA | E2E |
|------|---------|-----|
| 游戏 | `qa:user-journey-parity` | 样品馆 start/create prefill · parity 信任条 |
| 小说 | `qa:literary-user-journey` story1 | 完成页改编 CTA |
| 漫画 | story2–6 + product-rules | 改编信任条 · ?adaptComic=1 |
| 统一入口 | `qa:start-intake` | 样品→游戏 · `/start?prefill=` · 小说/漫画 prefill |

## 游戏

- 同 prompt：17/17 OK

## 文学

- 用户故事：全部通过

## E2E

```bash
npx playwright test e2e/platform-user-journey.smoke.spec.ts
npx playwright test e2e/platform-user-journey.en.spec.ts
npx playwright test e2e/platform-user-journey.ms-th.spec.ts
npx playwright test e2e/platform-user-journey.zh-hant.spec.ts
```

## 归档

运行 `npm run qa:regression-archive` 将 competitor-parity / gates / PM 报告快照到 `qa-output/regression-archive/`。
