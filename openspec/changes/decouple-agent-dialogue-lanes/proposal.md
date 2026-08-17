## Why

工作台对话已能流式出字，但仍绑在当前助理 tab 的 session 上；过程日志被当成聊天气泡。发送路径在助理/工作台各写一份。需要解耦会话槽与展示，抽出共享生成契约。

## 目标用户

同时用助理列和专家/工作流对话的人，不应互相改对方的角色或标签栏。

## 验收标准

- 工作台发送使用 `wb-expert-*` / `wb-run-*` sessionId，不把该会话加入助理标签栏。
- 内核角色由专家/任务映射，不跟随当前助理 tab。
- 管线过程日志只出现在执行过程，不出现在任务对话气泡。
- 助理与工作台共用 invoke/收尾逻辑。

## 非目标

- 不改工具权限协议。
- 不把飞书预览窗、管线旧 HTML 进度页迁到 ContentView（另 change）。

## What Changes

- domain：对话 lane、kernel role、生成收尾。
- `ensureSessionInStore`：工作台会话 ephemeral + 不改 openSessionIds。
- 渲染层共享 generate invoke；删除 RunDialogueLog / log→气泡回退。

## Capabilities

### Modified Capabilities

- `agent-chat-ux`：工作台与助理会话解耦。
