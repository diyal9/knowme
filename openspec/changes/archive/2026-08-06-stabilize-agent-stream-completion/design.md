## Context

见 `proposal.md`。当前 Renderer 已具备两条增量路径：`patchExecutionTimeline` 原地更新时间线，`reconcileStreamChildren` 原地更新流式 Markdown；但 Run 收尾仍通过 `renderChat()` 重建整个 `chatLog`，且单次 flush 会进入 `revealTypewriter` 清空重放。主进程与 IPC 已提供 run-scoped stream、stage、tool 和 done 事件，本 change 不改协议。

## Goals / Non-Goals

**Goals:**

- 保持每条助手消息、执行时间线、正文和历史消息的 DOM 节点身份稳定。
- 将流式收尾实现为局部状态转换，而不是第二次完整渲染。
- 保留现有 Markdown、grounding、个性化、回答动作和审批卡能力。
- 不增加常驻计时器、缓存副本或新的 Renderer 内存增长路径。

**Non-Goals:**

- 不展示模型原始推理内容。
- 不改变主进程流式协议、工具执行器或会话持久化结构。
- 不重写通用虚拟列表或 Markdown parser。

## Decisions

### 1. 为助手气泡增加原地完成路径

新增一个接收消息索引的完成函数，定位现有 `data-idx` 气泡并完成以下局部操作：

- 将消息从 streaming 切换为 completed 后，使用完整 Markdown 对现有 `.chat-text` 做子节点 reconcile。
- 移除流式光标和 `streaming`/`aria-busy` 状态。
- 原地更新时间线为完成摘要，并按 pending review 状态决定是否折叠。
- 按需补充 grounding、个性化和回答动作节点。

只有气泡节点意外不存在时才回退 `renderChat()`。选择这一方案而不是继续全量重绘，是为了保留滚动位置、展开状态和历史节点身份。

### 2. 单次 flush 视为已展示的流式正文

是否执行非流式打字揭示以“是否收到过非空正文并已绘制”为准，不再以 chunk 数量判断。`streamUpdateCount <= 1` 不能代表正文未展示，因此不再触发清空重放。真正零 chunk 的回退仍可调用轻量揭示。

### 3. 时间线折叠由完成函数显式驱动

`renderExecutionTimeline` 继续表达初始默认状态；运行中的 patch 不强制更改用户折叠选择。完成时，系统在当前 `<details>` 节点上更新摘要并：

- 无 pending/pending_review：移除 `open`；
- 有 pending review：保留 `open`，确保审批卡不被隐藏。

该规则仅在本轮从运行态转为完成态时执行一次，不干扰用户之后重新展开。

### 4. Electron 边界只传输公开可克隆数据

主进程继续产生结构化事件，preload 继续暴露现有订阅 API；所有 DOM reconcile 都留在 Renderer。Agent Run 内核结果中的 `ports`、函数和 `AbortSignal` 仅属于主进程内部，完成结果与取消结果都必须显式投影为公开字段后再跨 IPC 返回。这样不扩大 IPC 数据面，也不把执行器内部状态带入 Renderer。

## Risks / Trade-offs

- [最终完整 Markdown 与流式临时结构差异较大] → 完成时复用块级 reconcile；仅替换变化块，不替换正文容器。
- [回答动作重复追加] → 以稳定的 data/class 锚点检测，完成函数保持幂等。
- [时间线存在审批但 trace status 已为 done] → 折叠判断同时检查 `requiresApproval`、`draftStatus` 与 draft 标识，而不只检查 pending。
- [局部 patch 失败导致气泡缺控件] → 保留受控的单气泡/全量渲染兜底，并以测试确保正常路径不触发。
- [取消分支透传内核结果导致 Electron 克隆失败] → 内核结果剔除内部端口；IPC handler 对取消态显式投影 `error/cancelled/runId`。

## Migration Plan

无需数据迁移。上线后新产生和恢复显示的消息继续使用现有会话格式；回滚只需恢复 Renderer 收尾路径。
