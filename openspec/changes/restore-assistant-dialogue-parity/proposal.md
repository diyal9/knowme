## Why

React 迁移后，助手对话把「快捷操作」和「模型选择」叠成同一个 Auto 按钮，并把工作台 Daemon 过程卡（过程 / 运行日志 / 返回工作台）画进助理会话。用户无法按重构前的方式选模型、开 Ctrl+K，也无法看清 Agent 执行步骤；助理与工作台对话互相污染。

## What Changes

- 助理 composer 恢复为两个独立控件：快捷操作（图标 + Ctrl+K）与模型选择（标签 + 上下文占用），空态与进行中会话一致。
- 助理对话过程改回消息内「执行进度」时间线；流式 stage/tool 事件写入 `message.trace`，不再渲染 Daemon 过程卡。
- 共用 `AgentComposer` / `AgentMessageBubble` / 时间线组件；工作台对话不挂 Ctrl+K、不显示「返回工作台」过程卡。

## Capabilities

### Modified Capabilities

- `agent-chat-ux`：快捷操作与模型选择分离；助理执行过程走消息时间线。
- `workspace`：助理面禁止 Daemon 过程投影。

## Impact

- `src/renderer/features/assistant/*`、`src/renderer/app/store-session.ts`、`src/domain/agent-execution-timeline.ts`
- 测试：`assistant.spec.tsx`、domain 单测
