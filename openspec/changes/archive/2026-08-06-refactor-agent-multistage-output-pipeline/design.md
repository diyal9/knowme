## Context

见 `proposal.md`。当前执行内核在每个 MODEL 轮的 `onSnapshot` 中发送累积 `content`，生产 adapter 同时发送 `ai-stream-chunk`；Renderer 的两个订阅都写同一个 `message.text`。工具轮结束、grounding 再生成与 invoke 返回值都可能形成不同正文。Renderer 流式路径只做 Markdown，完成路径才解析 suggestion/thinking 并重组 body，因此协议文本会先出现，完成时再变成 UI。

约束：

- Electron 主进程负责模型、工具、grounding、持久化和 IPC 投影；Renderer 不得接触 provider 原始流或主进程对象。
- 原生 HTML/JS，不引入前端框架或新重依赖。
- `%APPDATA%\KnowMe\` 既有会话必须继续可读。
- 不展示 provider reasoning；只展示产品化阶段和工具摘要。
- 启动性能不增加网络或磁盘扫描；运行内存只允许单 Run 有界缓冲。

## Goals / Non-Goals

**Goals:**

- 建立 Run 级、版本化、单调、可克隆的多 lane 输出协议。
- 在主进程形成唯一 canonical answer 后再提交，杜绝中间正文回滚。
- 让结构化 UI 在进入 Renderer 前完成解析与白名单校验。
- 用纯 reducer 管理消息状态，并在固定 DOM 区域中做幂等局部更新。
- 保留旧会话读取兼容与受控的旧事件映射。

**Non-Goals:**

- 不保留“看起来更快”但可能被覆盖的乐观正文流。
- 不伪造 provider token 流；缓冲模式完成后直接提交 canonical answer。
- 不重写工具循环、Markdown parser、会话列表或设置页。
- 不新增后台常驻 worker、定时轮询或无界事件历史。

## Decisions

### 1. 使用单一版本化 envelope，而不是继续扩展松散事件

新增 `agent-output-protocol` 纯模块，统一创建和校验：

```text
{
  version: 2,
  runId,
  seq,
  round,
  phase,
  lane: progress | tool | answer | ui | terminal,
  type,
  payload
}
```

每个 Run 的 emitter 在主进程维护 `seq`。协议模块只含常量、构造、兼容映射和校验，不引用 Electron 或 DOM，因此 Node 测试可直接覆盖。

选择单 envelope 而不是为每个 lane 建 IPC channel，是为了减少 preload API 面、保证跨 lane 全序和取消竞态可判定。

### 2. 稳定优先：所有可能被改写的正文都先缓冲

执行器每轮维护 `roundDraft`。`onSnapshot` 只更新缓冲和首 token 指标，不发送 answer：

- 轮次含 tool calls：丢弃其可见资格，继续工具循环；
- 计划未完成/恢复/扩预算：下一轮替代候选；
- 无工具且可交付：设为 candidate；
- budget/repeated/grounding 需要 FINALIZE：以最终 finalize 结果替代 candidate。

candidate 依次经过 postProcess、grounding、claim verification、output gate、可能 regen 与 normalize 后成为 canonical text。只有此时才发送 `answer.committed`。

选择缓冲而不是“先显示 draft 再修订”，是因为用户明确选择稳定优先，且当前 output gate 可以用 refusal 整段替换正文。代价是首个最终正文更晚出现；执行时间线持续提供进度反馈。

### 3. OutputAssembler 是纯函数状态，不拥有工具或 IPC

新增 `agent-output-assembler`：

- 累积 provider 的 cumulative snapshot，并处理非前缀修订；
- 保存当前 roundDraft 与 candidate；
- 在 canonicalization 结束后调用 suggestion 兼容解析器；
- 返回 `{ text, hash, ui, diagnostics }`；
- 限制正文长度与结构化选择数量，避免额外无界内存。

Assembler 不直接 emit，以便执行器决定何时提交并保证 terminal 顺序。

### 4. 结构化选择在主进程分离

现有 `agent-suggestion` 改为同时支持 Node 与 browser 的纯解析器，并由 Assembler 在 canonical answer commit 前调用。合法 suggestion 从正文剥离并变成 `choice.ready`；非法或半截块被剥离并记录 diagnostic，不回退显示 raw JSON。

旧会话没有 `ui` 时，Renderer 加载阶段可调用同一纯解析器进行惰性迁移；新持久化写入 `ui` 与剥离后的 text。

选择解析兼容而不是立即新增模型 tool，是为了不改变 provider tool surface 和提示词生态；后续可在不改 Renderer 的情况下把来源替换为原生 structured output。

### 5. Renderer 使用纯 reducer 和固定消息骨架

新增 `agent-message-state` 纯模块：

- `createMessageState(runId)` 创建 preparing 状态；
- `reduceMessageEvent(state, event)` 校验 version/runId/seq/terminal，按 lane 更新；
- answer 只接受一次 canonical commit；
- 重复/迟到事件返回原对象或不变状态并记录轻量 diagnostic；
- terminal 后忽略普通事件。

`workspace-agent.js` 只负责把 reducer state patch 到固定区域：

```text
assistant bubble
  execution timeline
  response body
  structured ui
  actions/meta
```

会话初次加载仍可用 `renderChat()`；实时正常路径不得调用全量重绘。完成时保留 bubble、timeline、response body 与历史节点身份。

### 6. IPC 只保留一个实时订阅

主进程继续通过 `ai-stream-event` 发送 v2 envelope；preload 暴露单一 `onAiStreamEvent`。`ai-stream-chunk` 在迁移期可保留发送 API 供旧页面，但 workspace v2 Run 不订阅、不消费。invoke 返回只包含公开终态、sessionId、metrics 与错误信息，不返回用于覆盖 UI 的正文。

选择复用 `ai-stream-event` 而不是改频道名，是为了降低 note/workbench 等未迁移 surface 的回归面。

### 7. 持久化采用惰性兼容

新 assistant message 增加可选：

```text
protocolVersion: 2
answerHash: string
ui: StructuredUi[]
```

不批量迁移磁盘数据。旧消息加载时默认 completed；如 text 含合法 suggestion，则只在内存中剥离并渲染 choice。下一次正常保存可写新字段。

### 8. 可观测性只记录元数据

开发诊断记录 `runId/seq/round/phase/lane/type/textHash/textLength`，不记录 reasoning、API key 或完整工具敏感结果。指标包括缓冲时长、answer commit 时刻、丢弃临时正文次数、重复/迟到事件数和 raw-protocol 防泄漏计数。

## Risks / Trade-offs

- [首个最终正文更晚出现] → 执行时间线持续显示阶段与耗时；只提交真实 canonical answer，不做假打字。
- [旧 surface 仍依赖 chunk] → 复用原事件频道并保留有界兼容，workspace 先切 v2；测试锁定只有一个正文来源。
- [postProcess/grounding 变慢导致缓冲时间增长] → 记录 bufferMs/commitMs；阶段文案明确显示核对依据。
- [旧消息 suggestion 解析差异] → 共用同一纯解析器，fixture 覆盖 fenced、bare、非法和半截 JSON。
- [Reducer 与 DOM 状态漂移] → DOM patch 只读取 reducer state；正常路径缺节点时重建单气泡并记录 diagnostic，不重建 chatLog。
- [事件乱序或重复] → seq 幂等门禁；terminal 后冻结状态。
- [单 Run 缓冲增加内存] → 只保存当前 cumulative draft、candidate 与最多 6 个选择，不保存每个 token 快照。
- [一次性改动面较大] → 按协议/执行器/IPC/Reducer/UI/兼容顺序提交任务，保留 feature flag 到 E2E 全绿。

## Migration Plan

1. 先落纯协议、Assembler、Reducer 与单测，不切生产路径。
2. 执行器改为缓冲并发出 v2 envelope；主进程用 feature flag 同时保留旧事件映射，但 workspace 只消费 v2。
3. Renderer 切固定骨架与 reducer；验证 answer hash、DOM 身份、滚动和结构化 UI。
4. 新持久化写 `protocolVersion/ui/answerHash`，验证旧会话惰性兼容。
5. Electron fixture、制作人验收和 Tester QA 全绿后，移除 workspace 的 chunk 订阅、正文覆盖与 typewriter fallback。
6. 回滚时切回 legacy feature flag；新消息额外字段为可选，旧版本可忽略，不需要数据回滚。
