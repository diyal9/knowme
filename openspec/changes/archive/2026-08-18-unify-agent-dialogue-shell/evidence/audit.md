# 助理 / 工作台对话审计

日期：2026-08-16  
Change：`unify-agent-dialogue-shell`

## 结论

主进程 **Agent Runtime 是一套**：LLM、推理分层、工具循环、权限/沙箱、v2 流式 envelope 都在 `src/ipc/ai-generate.ts`。渲染层原先有 **两条发送路径**；本 change 把工作台接到与助理相同的流式归约与收尾契约。气泡与 Markdown/飞书卡/表格走共享 `AgentMessageBubble` → `ContentView`。各面保留自己的空态、快捷入口和 composer 行为。

## 共享 vs 各面自己的逻辑

| 层 | 共享 | 各面自己的 |
|---|---|---|
| 内核 | `aiGenerate`、工具、grounding、权限 | 角色 prompt：`general / steward / writing / coding`（session.agentId） |
| 流式 | `beginAssistantStream` + `applyRuntimeStreamEvent`，按气泡 id 写入对应槽 | 助理写入 `sessionStates`；专家写入 `expertRoom.messages`；工作流写入 `run.dialogueMessages` |
| 气泡 | `AgentMessageBubble`、`ContentView`、执行时间线 | 助理有模式追问条；专家有「对齐目标」等快捷；工作流空态是任务说明 |
| 输入 | `AgentComposer`（模型/知识/@ 文件、停止） | `surface=workbench` 不挂 Ctrl+K 会议总结；placeholder 不同 |

## 四种助理模式

模式只改 **新 session 的 agentId、空态卡片、追问预设**。内核用该 agentId 选 scene prompt、写作工作流、管家工具。发送路径都是 `startAssistantGenerate`，已流式。

## 工作台（本 change 已补）

- 生成中订 `ai-stream-event`，可见「内容整理完成」等时间线。
- invoke 回包带 `text` + committed 正文；不再假「已收到」。
- `isGenerating` / 停止键对工作台生效。

## 仍遗留

1. **工作台 `sessionId` 复用当前助理标签**，避免 `ensureAgentSession` 新建会话污染标签栏。因此专家 capability id **不会**单独改内核角色；写作/管家能力跟当前助理 tab 走。
2. **`RunDialogueLog`**（`RunSurface` 非 task-room）：把 `run.log` 按奇偶行假装 user/assistant。task-room 布局已隐藏；过程日志应看「执行过程」。
3. **`TaskRoomDialogue` 空对话回退**：无 `dialogueMessages` 时把 `run.log` 当助手气泡。
4. 飞书预览侧栏 / 授权 CTA 未迁到 ContentView。
5. 管线旧 HTML 进度页未走 ContentView。
6. 任务 `skillRefs`、便签 `noteId` 上下文比 HTML 基线薄。
