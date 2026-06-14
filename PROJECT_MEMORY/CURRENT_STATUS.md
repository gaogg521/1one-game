# CURRENT_STATUS

更新时间：**2026-06-14**

## 架构对齐（Astrocade 平台）

| 层 | 技术 | 默认 |
|----|------|------|
| Primary | Phaser 专用 Scene | ✅ 样品 / 用户 / 克隆 同路由 |
| Secondary | Godot 3D 母版 | Web 导出 / 11 模板 3D |
| Advanced | Agentic LLM | `AGENTIC_FORCE_LLM=1` 可选 |

**入口**：`src/lib/astrocade-architecture.ts`  
**门禁**：`npm run qa:architecture-parity`

## 文学生产链（2026-06-14）

| 能力 | 状态 |
|------|------|
| 五步工作链 + Studio 追踪 | ✅ |
| 邮箱注册 MVP | ✅（dev 用 `EMAIL_AUTH_DEV_EXPOSE=1`） |
| 角色 roster 服务端持久化 | ✅ Prisma `characterRosterJson` |
| 中篇 8 页漫画轻量分镜 | ✅ 314s（`qa:songliao-literary-regression`） |
| 四档小说 + 漫画实机全量 | ⬜ 需 `OPENAI_API_KEY` + 长时 LLM |

**离线门禁**：`npm run qa:comic-director-pipeline` · `npm run qa:b-tier-smoke`

## 不变量

- `dedicatedSceneForTemplateFirst` + `normalizeAstrocadePlaySpec`
- 蓝图自包含 specJson（无 runtime `SAMPLE_MODES`）
- 全 `GAME_TEMPLATE_IDS` 在 template-first 列表
- 中篇默认 8 页走轻量分镜（`mediumDirectorMinPages=12`）

## 样品馆

17 款 Astrocade 灵感样品 · seed + 专用 Scene 路由

## 同提示词差距（17 款样品 prompt）

**Scene 路由：17/17 对齐**（样品馆 vs 用户 POST 相同 prompt）

报告：`qa-output/prompt-parity/REPORT.md`  
**平台级竞品差距**：template 族通用 Scene vs Astrocade 每款定制；juice/3D/关卡密度仍低

## 文档

- `docs/astrocade-architecture-parity-cn.md`
- `PROJECT_MEMORY/DECISIONS.md`
- `PROJECT_MEMORY/LITERARY_CHAIN_CHECKLIST.md`
