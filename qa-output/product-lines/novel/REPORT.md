# 小说线独立验收

- 时间：2026-06-16T16:58:38.321Z
- 结果：**PASS**
- 离线步骤：4 + E2E

## 步骤

- [x] `npm run qa:literary-user-journey`
- [x] `npm run qa:literary-safety-contracts`
- [x] `npm run qa:novel-comic-smoke`
- [x] `npm run qa:novel-locale`
- [x] `npx playwright test e2e/novel-comic.smoke.spec.ts --grep "小说模块" --workers=1`
