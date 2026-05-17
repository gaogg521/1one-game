# CURRENT_STATUS

更新时间：**2026-05-17**（产品配置内聚 + 长篇分段 + 已推送 GitHub `main`）

## 项目整体进度

完成度：**主链路可用，可对外演示**  
当前阶段：游戏 / 小说 / 漫画三模块 + Studio；**业务参数在 `product-config.ts`**，`.env` 仅密钥与网关。

## 各模块状态

| 模块 | 状态 | 备注 |
|------|------|------|
| 游戏生成 / 试玩 | ✅ | 4 步共创；`refine` API；六模板 E2E **24/24**；PlayScene 目标闭环 |
| 小说生成 / 阅读 | ✅ | 短篇/中篇/长篇；**长篇分段续写**（大纲 + 多段）；流式网关超时已代码化 |
| 漫画生成 / 阅读 | ✅ | 分镜 + SSE 配图；8 页分镜手测 ~200s；32 格长测约 40～50min |
| 文生图 | ✅ | `gpt-image-2` 主路径；≤4 格批量 `n=4` |
| Studio | ✅ | 三源合并；游戏/小说/漫画 **duplicate** |
| 发现 / 列表 | ✅ | 点赞、排序、本人作品删除 |

## 配置与部署

| 项 | 说明 |
|----|------|
| 产品常量 | **`src/lib/product-config.ts`**（模型、超时、限流、漫画并发等） |
| 长篇分段 | **`src/lib/novel-long-config.ts`** |
| `.env` | 仅 `OPENAI_API_KEY`、`OPENAI_BASE_URL`、可选 `GEMINI_API_KEY` |
| 测试库 | **`prisma/ci.sqlite`** 已纳入仓库（E2E/手测） |
| 远程 | https://github.com/gaogg521/1one-game — `main` @ `1e44a87`+ |

## 构建与 QA（2026-05-17）

- **`npm run build`**：✅  
- **`npm run qa:full`**：migrate + build + E2E + 手测（见 `FULL_QA_REPORT_2026-05-17.md`）  
- **`qa:template-matrix`**：6/6  
- Playwright：**24/24**（`PW_EXTERNAL=1`、`E2E_REFINE_STUB=1`）

## 已知问题

1. **32 格配图**耗时长，进程重启会中断长测  
2. **Prisma generate** 本地偶发 EPERM（需停 dev）  
3. **六模板动效**建议偶尔肉眼扫一眼  
4. **工作室批量删除**未做  

## 文档

- 本日总结：`PROJECT_MEMORY/iterations/2026-05-17-summary.md`  
- 手测矩阵：`B_TEMPLATE_HANDTEST_MATRIX.md`
