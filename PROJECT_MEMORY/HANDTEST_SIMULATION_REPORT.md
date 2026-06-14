# 手测模拟报告

生成时间：2026-06-13T18:49:47.513Z

```
# 手测模拟报告 · 2026-06-13T18:49:18.995Z
Base URL: http://localhost:8888
[OK] health 200

$ npm run qa:template-matrix

> game@0.1.0 qa:template-matrix
> tsx scripts/qa-template-matrix.ts

  [OK] avoider → PlayScene
  [OK] collector → PlayScene
  [OK] survivor → PlayScene
  [OK] platformer → PlatformerScene
  [OK] towerDefense → TowerDefenseScene
  [OK] shooter → ShooterScene
  [OK] coaster → CoasterScene
  [OK] puzzle → PuzzleScene
  [OK] farming → FarmingScene
  [OK] physics → PhysicsScene
  [OK] chess → ChessScene
  [OK] customization → CustomizationScene
  [OK] strategy → StrategyScene
  [OK] sample/smash-the-dummy → PhysicsScene
  [OK] sample/rail-in-air → CoasterScene
  [OK] sample/grow-a-garden → FarmingScene
  [OK] sample/color-bloom → PuzzleScene
  [OK] sample/whimsy-differences → PuzzleScene
  [OK] sample/gun-merge-3d-zombie-apocalypse → TowerDefenseScene
  [OK] sample/ultimate-3d-chess → ChessScene
  [OK] sample/elastic-thief-2 → PlatformerScene
  [OK] sample/state-conquest → StrategyScene
  [OK] sample/tiny-planet-chopper → ShooterScene
  [OK] sample/blade-defender-merge → TowerDefenseScene
  [OK] sample/car-color-palette → CustomizationScene
  [OK] sample/blocky-sniper-hunter → ShooterScene
  [OK] sample/memory-match-mania → PuzzleScene
  [OK] sample/kids-puzzle → PuzzleScene
  [OK] sample/pottery-master-3d → CustomizationScene
  [OK] sample/crashy-roads → CoasterScene
[OK] qa-template-matrix: 13 templates + 17 samples

$ npm run qa:director-spec

> game@0.1.0 qa:director-spec
> tsx scripts/qa-director-spec.ts

[OK] qa-director-spec: 6 mocks + buildDirector
[OK] qa-director-spec: coerceGameSpec keeps validated director

$ npm run qa:refinement-log

> game@0.1.0 qa:refinement-log
> tsx scripts/qa-refinement-log.ts

[OK] qa-refinement-log

$ npm run qa:co-create-loop

> game@0.1.0 qa:co-create-loop
> tsx scripts/qa-co-create-loop.ts

qa-co-create-loop: ok

$ npm run qa:comic-storyboard-resilience

> game@0.1.0 qa:comic-storyboard-resilience
> tsx scripts/qa-comic-storyboard-resilience.ts

[OK] exports fetchComicStoryboardChunk
[OK] director batch then single-page fallback
[OK] uses ComicGenerationRunError
[OK] pipeline imports long storyboard
[OK] pipeline long path has light fallback
[OK] forceLightStoryboard skips director pipeline
[OK] COMIC_FORCE_LIGHT_PIPELINE env
[OK] qa-comic-storyboard-resilience (7 checks)

$ npm run qa:b-tier-smoke

> game@0.1.0 qa:b-tier-smoke
> tsx scripts/qa-b-tier-smoke.ts

[OK] npm run qa:template-matrix
[OK] npm run qa:director-spec
[OK] npm run qa:refinement-log
[OK] npm run qa:co-create-loop
[OK] npm run qa:comic-novel-product-rules
[OK] npm run qa:comic-storyboard-resilience
[OK] npm run qa:comic-panel-eta
[OK] npm run qa:architecture-parity
qa:b-tier-smoke: ok (8/8)

$ npm run qa:admin-console

> game@0.1.0 qa:admin-console
> tsx scripts/qa-admin-console.ts

◇ injected env (0) from .env // tip: ⌘ override existing { override: true }
[OK] console path normalized · /console
[OK] isAdminConsolePath
[OK] ADMIN_CONSOLE_HOST match
[OK] main site host no console match
[OK] 2FA required in production
[OK] 2FA PIN verify
[OK] 2FA token roundtrip
[OK] SSO stub enabled
[OK] SSO state roundtrip
[OK] SSO stub authorize URL
[OK] SSO stub profile + role
[OK] SSO marker roundtrip
[OK] health · 200
[OK] /admin → console redirect · status=308 location=/console
[OK] /console reachable · 200
[OK] audit-log (dev DEV_SUPER_ADMIN bypass) · status=200 — 生产应关闭 DEV_SUPER_ADMIN
[OK] console noindex header · noindex, nofollow
[OK] SSO login redirect · status=307
[OK] SSO authorize location · http://localhost:8888/api/admin/console/sso/callback?code=stub&state=L2NvbnNvbGU6MTc4MTM3NzE4MTI5Mjo2NjAzMDE1NjRlY2Q5YTF
[OK] audit-log filter query · status=200
[OK] orders export CSV · status=200 type=text/csv; charset=utf-8
qa-admin-console: ok (21 checks)

提示：Playwright 六模板 + 共创 E2E 请执行：
  PW_EXTERNAL=1 npx playwright test e2e/templates-handtest.spec.ts e2e/refinement.smoke.spec.ts e2e/create-play.smoke.spec.ts e2e/admin-console-sso.smoke.spec.ts

## 漫画 8 页分镜（分段 LLM）
[info] E2E_COMIC_STUB=1 — 期望服务端 stub（dev 需同 env）
[OK] comic generate · 8 页 / 24 格 · 0.2s · id=e2e-comic-stub

[SUMMARY] 离线项通过
```
