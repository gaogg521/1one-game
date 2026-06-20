# Staging 部署后抽测

- 时间：2026-06-18T06:21:22.439Z
- 基址：http://127.0.0.1:8888
- 结果：**5/5** ✅

| 检查项 | 结果 | 说明 |
|--------|------|------|
| /api/health | ✅ | http://127.0.0.1:8888 |
| /qa/agentic-bench | ✅ | QA 路由可访问 |
| qa:staging-complex-smoke | ✅ | — |
| qa:opengame-browser-bench | ✅ | — |
| qa:opengame-staging-env | ✅ | — |

## 部署提示

```bash
OPERONE_STAGING=1 ./scripts/deploy/...   # 或 cp .env.staging.example .env
STAGING_BASE_URL=http://your-host npm run qa:staging-post-deploy
```
