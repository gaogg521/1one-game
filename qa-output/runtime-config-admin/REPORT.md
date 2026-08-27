# Runtime Config Admin QA

- 时间：2026-08-26T12:49:19.065Z
- 库：`file:./dev.db`
- 结果：**PASS** (23/23)

## Checks

- [x] prisma migrate deploy — file:./dev.db
- [x] crypto roundtrip
- [x] defaults.gamePrimary
- [x] defaults.novelTextPrimary
- [x] defaults.imageOpenAI
- [x] stored production route survives code-default changes
- [x] persist gamePrimary
- [x] persist novelTextPrimary
- [x] persist imageGemini
- [x] public view has productDefaults
- [x] modelSources.gamePrimary is db after seed — db
- [x] persist provider pricing
- [x] persist daily model budget — 987654
- [x] provider pricing exact match — 800
- [x] provider pricing wildcard match — 1200
- [x] provider pricing unmatched remains null — null
- [x] HTTP dev server reachable — http://127.0.0.1:8888
- [x] HTTP GET /api/admin/runtime-config — status=200
- [x] HTTP models.gamePrimary
- [x] HTTP PATCH /api/admin/runtime-config — status=200
- [x] HTTP PATCH novelTextPrimary applied
- [x] HTTP GET after PATCH
- [x] HTTP PATCH restore novelTextPrimary
