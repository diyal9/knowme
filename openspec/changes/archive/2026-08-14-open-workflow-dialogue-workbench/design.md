## Context

专家任务已通过 `open-expert-task-chat-workbench` 建立双栏 task-room（左 Session 对话、右专家属性）。工作流货架仍走详情弹层或 `beginWorkflowRun` 表单确认输入，与「对话驱动工作流」产品期望冲突。

边界：

- Session / Composer 仍由 `workspace.js` → `WorkspaceAgent` 拥有。
- Workbench 拥有货架、任务目录、右栏投影。
- 既有 local/daemon run 壳保留为次要「开始运行」。

## Goals / Non-Goals

**Goals**

1. 货架主入口 → 工作流对话房（复用专家 Session 路径）。
2. 右栏工作流导向投影（I/O、步骤、能力、状态）。
3. 任务持久化 `workflowId`，可从最近任务恢复。
4. 次要动作可落到 `beginWorkflowRun`。

**Non-Goals**

- Orchestrator 多专家群聊、自动发送、删除 run 壳、重做 Studio。

## Decisions

### 1. 入口统一为 `openWorkflowDialogueRoom`

卡片空白、键盘、play/`inspect`/`use` 均调用 `openWorkflowDialogueRoom(id)`：

1. `resolveShelfWorkflow` → `workflowPrimaryExpert`（graph 起点 agent 或首个 `agentRefs`）
2. `beginExpertTask({ expertId, workflowId, workflowName, goal, … })`
3. `openExpertTaskRoom` 携带 `workflow`，`runMode: 'workflow-chat'`

找不到专家时 toast，不打开详情弹层。

### 2. 扩展 expertTaskRoom，不平行造第二套房间

`expertTaskRoom = { task, session, expert, workflow? }`。有 `workflow` 时右栏优先渲染工作流块；能力 chips 仍来自 Session/专家快照。`#wbExpertTaskRoom` 复用。

### 3. 任务 store 增加 workflow 字段

`normalizeTask` 增加 `workflowId` / `workflowName`（限长文本）。创建/更新时写入；恢复时若有 workflowId 则重新 resolve package 填右栏。

### 4. 与 run 壳共存

右栏次要按钮 `data-workflow-room-action="run"` → `beginWorkflowRun(workflow)`。不删除确认输入/执行/产物壳。

### 5. 冲突规格

`workflow-card-intro-vs-start`、`clarify-workflow-shelf-naming-and-detail` 的「点卡片开详情/确认输入」改为指向本 change 的对话房语义。

## Risks / Trade-offs

- [无绑定专家] → toast「缺少可对话专家」；可保留编辑/复制。
- [多专家] → 仅起点专家对话；右栏列全员，避免假编排。
- [与详情弹层并存] → 详情函数可保留供管理面，货架主路径不再调用。

## Migration

无破坏性数据迁移；旧任务缺 `workflowId` 仍按专家 Session 恢复。
