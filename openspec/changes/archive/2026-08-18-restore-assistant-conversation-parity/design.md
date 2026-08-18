## Context

基线对话运行时在 `f6ad048` `workspace-agent.js`：`compactUserShortcutBubbleText`、`renderThinkingStatus` + ticker、`applyV2StreamEvent` 原地补时间线、`aiGenerate` 带完整 prompt。主进程 `ai-generate` / `AgentRunExecutor` 保持。React 已有 `applyRuntimeStreamEvent` 与时间线组件，缺的是发送占位、压缩显示、友好文案和首包事件刷出。

## Goals / Non-Goals

**Goals**

- 助理列对话观感与基线一致：短用户气泡、活的执行进度、提交后出正文。
- domain 承载压缩/飞书澄清/占位消息，禁止再写第二套 reducer。

**Non-Goals**

- 不恢复页面级 `workspace.html` / `workspace-agent.js`。
- 不把 Daemon「过程/运行日志/返回工作台」卡画回助理列。
- 不改 `%APPDATA%\KnowMe\`，不改 Daemon HTTP。
- 不为 v2 用 chunk 逐字绘制（基线同样等 `answer.committed`）。

## Decisions

1. 发送时用户 `text` = 压缩标题，`prompt` = 原文（可经飞书澄清改写）；`displayPrompt` 传压缩标题。
2. 助手占位消息立刻带 `trace: [{ id: stage_prepare, pending }]`，气泡走时间线而非 raw activity 胶囊。
3. 思考/进度文案统一 `userStatusLabel`；耗时用 `startedAt` 在渲染层每秒刷新。
4. `onAiStreamEvent` 继续 `applyRuntimeStreamEvent`（无 version 走扁平 upsert）；chunk 对 `protocolVersion === 2` 仍忽略。
5. `ai-generate` 在发出首个 `stage_prepare` 后 `setImmediate`，避免主进程同步重活卡住渲染首帧。

## Risks / Trade-offs

- 飞书未授权时基线会改写 prompt 为澄清；测试须 mock `connectorsStatus` 为已就绪，否则会议总结变授权引导。
- 压缩规则过宽可能误伤用户手打长文；沿用基线泄漏特征正则，未命中则原样显示。
