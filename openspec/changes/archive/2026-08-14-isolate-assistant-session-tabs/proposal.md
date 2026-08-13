## Why

助理顶栏混入了工作台任务、Daemon 与工作流对话的 Session Tab，用户无法区分「办公助理对话」与「工作台协作」。根因是专家/工作流对话房曾刻意挂到 `agent` surface，导致一切工作台 Session 泄漏进助理 Tab。

### 目标用户

- 日常用助理聊天、又会在工作台开专家/工作流/Daemon 任务的个人知识工作者。

### 商业化与体验价值

助理是高频入口；Tab 栏干净直接降低「产品乱、会话失控」感知，强化助理 vs 工作台的职责边界，减少误关任务 Session、误发到错误上下文的挫败。

## What Changes

- **BREAKING（产品语义）**：工作台专家对话、工作流对话、Daemon/任务协作 Session MUST NOT 出现在助理模式 Session Tab 栏。
- 工作台打开时（含 `expert-chat` / `workflow-chat`）统一使用 `workbench` surface 的 Tab 集合。
- 工作台创建/恢复专家 Session 不再强制切到 `agent` surface。
- 启动时迁移：已混入助理 Tab 的工作台归属 Session 归还到 workbench surface。
- 能力面/助理入口开工的专家对话仍留在助理 Tab（不变）。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `agent-session-tabs`: 明确助理 Tab 仅展示助理 surface Session；工作台归属 Session 不得进入助理打开集合。
- `workspace`: 工作台 task-room（专家/工作流/Daemon）与助理 Session Tab 隔离。

## Impact

- `src/workspace.js`：`applyWorkbench` surface 选择；工作台专家 Session 开工/恢复路径。
- `src/workspace-agent.js`：`startExpertChat` surface 选项、加载迁移、surface 切换。
- 测试：`tests/expert-task-chat-workbench.test.js`、`tests/workbench-templates.test.js`、`tests/workspace-agent.test.js`。

### 验收标准

- 助理模式 Tab 栏不见 `工作台 · …`、工作台专家/工作流任务 Session。
- 工作台内开专家任务、工作流对话、Daemon 任务后切回助理，助理 Tab 集合不变（不被新任务污染）。
- 能力面「开始对话」仍在助理新建 Tab。
- 最近任务仍可在工作台恢复同一 Session。
- 自动化测试与 lint 通过。

### 非目标（Non-goals）

- 不删除工作台 Session 磁盘数据，仅隔离打开 Tab 集合。
- 不重做工作台 task-room 布局或 Daemon 审阅壳。
- 不改变助理内部多 Tab / Pin / 历史行为。
