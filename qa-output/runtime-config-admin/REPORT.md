# Runtime Config Admin QA

- 时间：2026-06-17T02:43:01.121Z
- 库：`file:./dev.db`
- 结果：**PASS** (17/17)

## Checks

- [x] prisma migrate deploy — file:./dev.db
- [x] crypto roundtrip
- [x] defaults.gamePrimary
- [x] defaults.novelTextPrimary
- [x] defaults.imageOpenAI
- [x] persist gamePrimary
- [x] persist novelTextPrimary
- [x] persist imageGemini
- [x] public view has productDefaults
- [x] modelSources.gamePrimary is db after seed — db
- [x] HTTP dev server reachable — http://127.0.0.1:8888
- [x] HTTP GET /api/admin/runtime-config — status=200
- [x] HTTP models.gamePrimary
- [x] HTTP PATCH /api/admin/runtime-config — status=200
- [x] HTTP PATCH novelTextPrimary applied
- [x] HTTP GET after PATCH
- [x] HTTP PATCH restore novelTextPrimary
