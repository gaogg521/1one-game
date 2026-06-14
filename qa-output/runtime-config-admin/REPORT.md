# Runtime Config Admin QA

- 时间：2026-06-14T15:35:54.855Z
- 库：`file:./prisma/ci.sqlite`
- 结果：**PASS** (11/11)

## Checks

- [x] prisma migrate deploy — file:./prisma/ci.sqlite
- [x] crypto roundtrip
- [x] defaults.gamePrimary
- [x] defaults.novelTextPrimary
- [x] defaults.imageOpenAI
- [x] persist gamePrimary
- [x] persist novelTextPrimary
- [x] persist imageGemini
- [x] public view has productDefaults
- [x] modelSources.gamePrimary is db after seed — db
- [x] HTTP dev server reachable — skipped — DATABASE_URL=file:./prisma/ci.sqlite PORT=8888 npm run dev
