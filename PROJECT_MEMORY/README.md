# PROJECT_MEMORY 说明

本目录是 **AI 协同研发的「外部记忆」**：进度、队列、决策与下一步入口都写在这里，而不是依赖某一次聊天窗口里的上下文。

## 为什么要提交到 Git

- **换电脑**：`git clone` / `git pull` 后，打开仓库即可恢复「做到哪、下一步做什么」。
- **换编辑器**（Cursor / VS Code / Claude Code 等）：只要打开**同一仓库**，先读本目录里的文件再继续。
- **换模型或 Agent**：厂商之间**不会**自动同步对话记录；接续靠的是 **仓库里这些 Markdown**。

## 建议阅读顺序（新会话 / 新环境）

1. `NEXT_ACTION.md` — 上次留下的第一道动作  
2. `CURRENT_STATUS.md` — 整体进度与已知问题  
3. `TASK_QUEUE.md` — 待办与优先级  
4. `DECISIONS.md` — 已冻结的技术决策（避免重复争论）  
5. `SESSION_LOG.md` — 近期改了什么、测过什么  

完整流程与职责边界见仓库根目录 **`CLAUDE.md`** 与 **`.cursor/rules/cto-perpetual-engineering.mdc`**。

## 安全注意

**不要**在本目录任何文件中粘贴：API Key、密码、Cookie、内网凭据、个人隐私原文。只写任务描述、文件路径、决策摘要等与代码协作有关的内容。

## 维护约定

每完成一段有意义的工作或结束前，应更新（至少）`NEXT_ACTION.md`，并与 `CURRENT_STATUS.md` / `TASK_QUEUE.md` / `SESSION_LOG.md` 保持一致。重大取舍记入 `DECISIONS.md`。
