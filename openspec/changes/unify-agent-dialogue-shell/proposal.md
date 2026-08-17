## Why

助理列已接 v2 流式、时间线、Markdown 组件；工作台任务/专家对话仍是「invoke 结束后整段落字」，且共用 `isGenerating` 却不订流。用户在工作台感觉推理/工具/过程「没重构好」，其实内核同一套，缺的是对话壳。

## 目标用户

在工作台与专家协作、给运行中工作流补要求的人。

## 验收标准

- 工作台对话发送后可见执行过程时间线，最终正文走 ContentView（加粗/列表/飞书卡/表）。
- 生成中可停止；停止后气泡不再假 streaming。
- 工作台仍用专家快捷入口（对齐目标等），不挂载助理 Ctrl+K 会议总结。

## 非目标

- 不把管线 daemon 过程日志改成聊天。
- 不改主进程工具权限协议。
- 不把 Run 过程 log 字符串偶数列成用户气泡（那是遗留展示，本 change 不修成对话）。

## What Changes

- 流式 listener 按 assistantId 同时更新 session / expertRoom / run.dialogueMessages。
- `sendWorkbenchMessage` 对齐助理 generate 契约（isGenerating、flush、committed 正文）。

## Capabilities

### Modified Capabilities

- `agent-chat-ux`：工作台对话壳与助理共享流式归约。
