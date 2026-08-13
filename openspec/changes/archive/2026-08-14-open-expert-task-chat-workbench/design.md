## Context

见 `proposal.md`。当前工作台任务弹窗在 `submitTaskComposer()` 中先写本地任务，再调用 `launchAgentRun()` 构建单节点 Agent Graph，因此即使用户只选了一位专家，也会进入第二个计划确认流程。真实专家对话已经由 `WorkspaceAgent.startExpertChat()`、`agent-session-new`、专家快照和 Session Tab 完整支持，但工作台没有调用这条链路。

现有边界：

- `workbench.js` 管理任务目录、弹窗和右侧工作台页面，但不应直接管理 Agent Session。
- `workspace.js` 拥有工作台布局和 Agent 列显隐，是两者之间的宿主协调层。
- `workspace-agent.js` 拥有 Session、Composer、专家首屏与生成状态。
- 主进程是 Session、专家快照、知识 Provider 和检索范围的唯一事实源；Renderer 不读取 `%APPDATA%`。
- 工作台已经加载知识 Provider 目录，专家 Session 已投影 persona、skills、connectors 和 readiness，可直接复用。

## Goals / Non-Goals

**Goals:**

- 为单专家任务建立 `Workbench → workspace host → WorkspaceAgent → agent-session-new` 单一路径。
- 让工作台保持打开并切到 task-room 布局：左侧是真实专家对话，右侧是任务/专家上下文，不伪装为正在执行的 Run。
- 将任务目标作为 Session 草稿预填，用户确认后才发送。
- 将知识库选择持久化到 Session，并让后续检索只使用该范围。
- 对旧 Session、旧任务和没有知识选择的普通对话保持兼容。

**Non-Goals:**

- 不复用 Agent Graph 的 run/plan 状态来模拟单专家对话。
- 不为专家包新增另一套 persona 或 skill 数据模型。
- 不在 Renderer 中直接调用知识 Provider，也不自动切换全局默认 Provider。
- 不自动发送目标或在 Session 创建时触发网络请求。

## Decisions

### 1. 宿主协调交接，不让 Workbench 直接操作 Session

`Workbench.init()` 新增受控 `onExpertTaskStart` 回调。`submitTaskComposer()` 创建任务草稿后把 `{ taskId, expertId, goal, knowledgeRefs }` 交给 `workspace.js`；宿主调用 `WorkspaceAgent.startExpertChat(options)`，成功后再通知 Workbench 打开专家任务工作间并更新任务 `execRef = { kind: 'session', id }`。

选择宿主回调而不是 `window.WorkspaceAgent` 直连，是为了保持模块边界、集中布局切换，并让测试可注入失败结果。失败时不关闭弹窗、不改变任务状态；成功后才关闭弹窗和标记进行中。

### 2. task-room 增加“专家对话任务”投影，不伪造 Run

Workbench 增加轻量 `expertTaskRoom` 状态和专用详情面板，显示目标、专家属性、专业能力、skills/connectors、知识库及 Session 状态。它复用现有 `task-room` 两列布局，但不写入 `run`、不显示 DAG 百分比、不提供审批/取消 Run 动作。

从最近任务打开 `execRef.kind === 'session'` 时，宿主恢复同一 Session；只有旧任务没有 Session 引用时才回到编辑弹窗，停止旧行为中的“重新创建 Agent Graph”。

### 3. 任务目标是草稿，不是自动消息

`startExpertChat()` 接收结构化 options，并把 `goal` 传给 `agent-session-new` 后写入当前 Session Composer 草稿。空对话首屏仍展示专家身份和能力；目标不进入消息历史，直到用户点击发送。

这避免“创建即消费模型额度”和用户尚未补充材料时误执行，同时 Session `run.goal` 可用于标题、恢复和任务追溯。

### 4. Session 持久化最小知识范围

`agent-sessions` 增加限长、去重的 `knowledgeRefs` 和可选 `taskRef` 字段。`agent-session-new` 接收这两个字段；新增受限 IPC `agent-session-context-update` 只允许更新当前 Session 的知识引用，不接受任意路径、Provider 密钥或执行参数。

`sessionDto` 用主进程知识 Provider 目录生成脱敏投影：

- selected + available → `ready`
- selected + missing → `limited`
- 未显式选择 → 标记使用默认 Provider

Renderer 只看到 id、displayName、kind、selected/status，不看到远程凭据。

### 5. 会话知识选择限制检索，不修改全局默认

`ai-generate` 从已加载的权威 Session 读取 `knowledgeRefs`，忽略 Renderer 单独声明的 Provider。显式选择时只把可用选择传给 Fabric 检索；没有选择时沿用当前默认 Provider。显式选择全部失效时跳过知识检索并返回可解释的 degraded 状态，绝不扩展到未选择 Provider。

为远程 Provider 增加按 id 的主进程解析函数，凭据只在内存中解密；日志、DTO 和 Renderer 不包含 apiKey。

### 6. 专家上下文复用快照，知识选择独立可变

专家名称、职责、来源、skills/connectors/readiness 继续来自 Session 快照，确保历史 Session 不随专家更新漂移。知识库范围是用户在会话中可调整的运行上下文，因此独立存于 Session；修改仅影响后续检索，不重写专家快照。

对话首屏在现有身份区后增加明确分组：

- 专家属性：来源、能力就绪摘要；
- 专业能力：专家 description；
- 技能与连接器：快照绑定及 readiness；
- 知识库：可用 Provider 多选，含默认/受限说明。

## Electron 边界与性能

- Main：校验并持久化 Session context；解析脱敏 Provider 投影；执行受限检索。
- Preload：仅暴露 `agentSessionContextUpdate(sessionId, { knowledgeRefs })` 结构化桥。
- Renderer：负责选择与展示，不接触文件路径或 Provider 凭据。
- 启动性能：任务弹窗复用 Workbench 已加载 Provider 目录；新建 Session 只写现有 Session store/专家快照，不预连接远程 RAG、不预跑检索。
- 内存：每个 Session 最多保留 16 个知识引用，详情投影按当前 Session 生成，不增加常驻监听。

## Risks / Trade-offs

- [任务已写入但 Session 创建失败] → 任务保持 draft、弹窗保留输入，允许重试；不做破坏性删除。
- [知识库在会话期间被删除] → DTO 标记 limited，检索过滤失效项，普通对话继续可用。
- [双列在窄窗口拥挤] → 复用 task-room 现有响应式布局，窄屏上下堆叠。
- [旧任务 `execRef` 为 run] → 保留既有 Run 打开逻辑；仅 `session` 类型走专家对话恢复。
- [显式空选择语义含糊] → UI 将“跟随默认”作为独立选项；空数组表示跟随默认，非空列表表示严格范围。

## Migration Plan

1. 扩展 Session/任务 normalize，保证旧数据缺字段时得到空列表和空引用。
2. 增加主进程 Session context IPC 与知识投影，再接入 Renderer 展示。
3. 切换新建单专家任务交接路径，并保留现有工作流/Agent Graph 入口不变。
4. 更新最近任务恢复逻辑与自动化测试。
5. 回滚时可恢复旧 Workbench callback；新增 Session/任务字段会被旧 normalize 忽略，不需删除用户数据。
