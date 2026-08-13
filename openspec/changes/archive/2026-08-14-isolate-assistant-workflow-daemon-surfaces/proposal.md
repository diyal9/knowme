## Why

助理栏会叠出「开始使用」空态、工作台 Session Tab 与 Daemon「Agent 全局运行过程」——三套对话面共用 `#agentCol`，切回助理时未清过程投影、也未退出 task-room，用户无法分辨当前在助理对话、工作流对话还是集中运行。助理是高频入口，这种混叠直接破坏信任与路径清晰度。

### 目标用户

- 日常用助理聊天，又会在工作台开工作流对话 / Daemon 跑批的个人知识工作者。

### 商业化与体验价值

助理与工作台职责边界清晰，降低「产品乱、会话失控」感知；减少误发到错误上下文、误关任务 Session，提升留存与口碑。

## What Changes

- **BREAKING（产品语义）**：切到助理模式时 MUST 清除 Daemon 过程投影（`daemonProcessCache` / `#agentDaemonProcessFeed`），MUST 退出工作台 task-room 协作态。
- Daemon 过程块仅在工作台 surface + Daemon 运行间展示；助理空态/对话 MUST NOT 叠加过程卡。
- 离开工作台进入助理时，与 `exitWorkbenchTask` 对齐：清任务上下文、过程 feed、工作台空态。
- 加宽工作台归属 Session 判定（含「工作台 -」「工作台—」等变体及明确 taskRef），避免污染助理 Tab。
- 回归守卫：助理 ↔ 工作流对话房 ↔ Daemon 集中运行来回切换互不污染 DOM/缓存。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `agent-session-tabs`: 切面时过程投影与 Tab 集合同步隔离；归属启发式覆盖更多工作台标题变体。
- `workspace`: 离开工作台进入助理时退出 task-room；助理面禁止渲染 Daemon 过程投影；过程块仅在工作台 Daemon 运行间有效。

## Impact

- `src/workspace.js`：`openAgentChat` / 离开工作台路径须退出 task 视图。
- `src/workspace-agent.js`：`setSurfaceMode`、`restoreDaemonProcessFeedAfterChatRender`、`isWorkbenchOwnedSession`、`paintDaemonProcessFeed` 守卫。
- `src/workbench.js`：切面时同步 feed（如有缺口）。
- 测试：`tests/workspace-agent.test.js` 及工作台相关静态契约。

### 验收标准

- 助理模式：只有助理 Tab + 助理空态/消息；无「Agent 全局运行过程」、无工作台任务 Tab。
- 工作流对话房：双栏专家/工作流协作；无助理「开始使用」四卡叠在过程区。
- Daemon 集中运行：过程块仅在该运行间；切回助理后过程块消失；再进工作台不误带到助理。
- 自动化测试与 lint 通过。

### 非目标（Non-goals）

- 不拆成三套独立 DOM 对话列（仍共用 `#agentCol`，靠 surface 状态隔离）。
- 不重做工作流对话房或 Daemon 审阅右栏布局。
- 不改主进程 Session 存储 schema。
