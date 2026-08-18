## Why

React 助理列把 v2 对话壳做成了「乐观占位 + 整轮结束才出字」：快捷指令全文铺在用户气泡、过程条用内部文案「正在准备上下文…」、时间线要等 IPC 才出现。基线 `f6ad048` 的 `workspace-agent.js` 同一套主进程也能显得顺畅，差的是渲染契约，不是模型。

## What Changes

- 用户气泡压缩快捷指令泄漏文案（如会议总结只显示短标题），完整 prompt 仍发给 `aiGenerate`。
- 发送即种 `stage_prepare` 时间线；过程文案走 `userStatusLabel`，并显示已等待时长。
- 流式 `ai-stream-event`（含扁平 stage 与 v2 envelope）在生成中持续归约到当前助手消息；主进程在重活前让出事件循环，保证首个 stage 能画出来。
- 飞书意图在未授权/能力不明时按基线改写澄清 prompt；`displayPrompt` 与 `skillRefs` 随发送契约带上。

## Capabilities

### Modified Capabilities

- `agent-chat-ux`：快捷气泡、执行进度、v2 过程更新与基线对话观感对齐。

## Impact

- `src/domain/agent-*.ts`、`src/renderer/features/assistant/*`、`src/renderer/app/store-assistant.ts`、`src/renderer/app/store-session.ts`、`src/ipc/ai-generate.ts`
- 测试：`assistant.spec.tsx`、domain 单测
- 对照：`f6ad048` `workspace-agent.js`（禁止把 HTML 贴回运行时）
