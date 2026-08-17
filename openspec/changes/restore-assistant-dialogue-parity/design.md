## Context

基线 `f6ad048`：`#agentQuickBtn` 与 `#agentModelBtn` 并列；执行轨迹是气泡内 `agent-execution`；`paintDaemonProcessFeed` 仅 `surfaceMode === 'workbench'`。

现行 React：`launchEmpty` 把 spark 图标画进模型按钮并隐藏快捷按钮；`AssistantPane` 用 `AgentDaemonProcessFeed` 把 `assistantProcessFeed` 同时填进「过程」和「运行日志」。

## Decisions

1. Composer 变体用 `surface: assistant | workbench`，不用把快捷入口塞进模型按钮。
2. 流式事件（v2 `payload` 或扁平 legacy）统一 upsert 到 `ChatMessage.trace`；UI 只读 view-model。
3. 时间线组件可被助理与工作台气泡复用；无 `trace` 则不渲染。Daemon 过程卡不再挂在助理列。

## Risks

- 工作台专家协作若也走 `aiGenerate` 且未单独订阅流，时间线可能仍为空（与现状一致，不把助理过程卡搬过去）。
