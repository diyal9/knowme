## Context

当前 V2 工具轮输出已经在主进程缓冲，但 Renderer 仍保留 legacy/兼容流式正文路径。该路径把 `splitStreamingMarkdown()` 判定为不稳定的尾部通过 `.md-stream-tail` 转义后直接显示，随后在尾部稳定时替换为 Markdown 节点，因此用户会看到源码闪现与格式刷新。

本次只调整 Renderer 展示边界；主进程、V2 IPC、会话存储和 provider 流不变。

## Goals / Non-Goals

**Goals:**

- 未完成尾部只存在于消息内存状态，不进入可见 DOM。
- 已稳定块继续按动画帧增量渲染，避免退化为整段等待。
- 用明确的产品状态承接等待，不用 Markdown/JSON 原文充当进度反馈。
- 完成时在同一正文容器中收敛到完整 Markdown。

**Non-Goals:**

- 不改变 AgentRunExecutor 的工具轮缓冲策略。
- 不重写 Markdown parser。
- 不新增网络、磁盘扫描或持久化字段。

## Decisions

### 1. 不稳定尾部改为不可见缓冲

`splitStreamingMarkdown()` 继续负责分离 stable/tail，但 `renderStreamingMarkdown()` 不再把 tail 转义进 DOM。tail 只决定是否展示固定的“正在整理…”状态。

选择保留分块器而不是等待整段回答，是为了让完整段落仍能渐进出现；选择隐藏 tail 而不是 CSS 延迟显示，是为了从数据路径上保证原始内容可见时长为 0。

### 2. 状态节点与内容节点分离

流式正文容器中只包含 `renderMarkdown(stable)` 产生的用户内容和固定状态节点。状态节点不包含模型文本，reconcile 时只更新或移除状态，不把 tail 文本复制到 DOM。

### 3. 完成路径保持原地格式化

完成阶段继续使用现有 `completeAssistantBubble()` / `reconcileCompletedAssistantBody()`，将完整正文与当前稳定块对齐。气泡、正文容器和未变化块保持节点身份。

### 4. V2 与 legacy 统一显示策略

V2 canonical answer 仍一次性按完整 Markdown 提交；legacy/兼容流式路径采用稳定块策略。这样所有可见正文都经过 `renderMarkdown()`，不存在纯文本 tail 旁路。

## Risks / Trade-offs

- [Risk] 长时间没有换行时，用户看不到该半行正文。  
  → 使用固定“正在整理…”状态；内容稳定或完成后直接以最终样式出现。

- [Risk] 某些 Markdown 块需要更长时间才能判定闭合。  
  → 保守隐藏优先，避免内部协议和源码闪现；完成事件保证最终内容不会丢失。

- [Risk] 状态节点参与块级 reconcile 可能导致索引替换。  
  → 为状态节点使用稳定 class，并增加节点身份与“raw text 永不进入 innerHTML”的行为测试。

- [Performance] 保留单条消息的 tail 字符串会占用内存。  
  → 该字符串本来已存在于 `message.text`，不新增副本或长期缓存；启动性能不受影响。

## Migration Plan

1. 更新 delta spec 与行为测试。
2. 替换 `.md-stream-tail` 可见路径为固定 pending 状态。
3. 运行定向 DOM 测试、全量 test/lint 和 Electron 冒烟。
4. 若出现兼容问题，可回滚 Renderer 单点改动，不涉及数据迁移。
