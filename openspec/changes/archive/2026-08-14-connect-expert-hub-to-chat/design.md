## Context

见 `proposal.md`。当前 Capability Hub 运行在工作区抽屉内的同源 iframe 中，专家按钮通过 preload 调用 `expert-try-chat`，主进程只返回一个带快照路径的 ephemeral 对象；工作区 Agent 不知道该对象，因此不会新增或激活 Tab。另一方面，工作区已有 `agent-session-new({ agentId, expertId })`、Session Tab、专家快照和 context assembly 完整链路，专家选择弹层也已通过这条链路创建可用会话。

约束：

- Electron renderer 不直接读写 `%APPDATA%\KnowMe\capabilities` 或 Session store。
- Hub iframe 与宿主工作区之间只传递启动意图，不传递可执行函数或文件路径。
- 专家 persona 可以在依赖未就绪时工作，但技能和连接器工具仍必须经过当前 enabled/auth/allowlist/approval 安全策略。
- 不增加第二套聊天状态，不引入新依赖，不在启动时额外扫描全部能力。

## Goals / Non-Goals

**Goals:**

- 复用现有持久 Session 创建路径，把 Hub 专家选择转换为可恢复的工作区对话。
- 用单一状态驱动 CTA 串联安装、启用、创建会话和导航。
- 在 Session 内展示专家身份、任务建议及降级依赖，保持运行结果可解释。
- 保留 Session 快照稳定性，同时让实时工具投影遵守最新安全状态。

**Non-Goals:**

- 不支持在当前 Session 内热切换 expertId。
- 不将专家设置为全局默认值。
- 不在 Hub 中维护 transcript、composer 或流式状态。
- 不自动授权连接器、不自动扩大 allowlist。

## Decisions

### 1. Hub 只发送启动意图，工作区拥有 Session 导航

Hub 在安装/启用准备完成后向父窗口发送 `capability-hub-start-expert`，载荷仅含 `expertId` 和请求标识。`workspace.js` 仅接受来自当前 `.capability-hub-frame.contentWindow` 的消息，再调用 `WorkspaceAgent.startExpertChat`。

选择该方式而不是让 iframe 直接调用 `parent.WorkspaceAgent`，是为了保持 iframe/宿主边界清晰，并允许宿主统一完成来源校验、关闭抽屉和错误回传。

### 2. 复用 `agent-session-new`，不再由 `expert-try-chat` 生成 Session

`WorkspaceAgent.startExpertChat` 复用现有 `createNewAgent({ agentId: 'general', expertId })`。主进程继续在 `agent-session-new` 中原子完成 Session 创建、专家快照、store 持久化和 UI 状态更新。

`expert-try-chat` 不再被 renderer 调用；保留兼容 handler 不会影响启动，但新代码和测试只认单一 Session 创建路径。相比让两个 IPC handler 分别构造 Session，这能避免 ID、持久化和 Tab 状态漂移。

### 3. CTA 使用准备-提交两阶段交互

专家按钮状态：

- available：`安装并开始`
- installed + disabled：`启用并开始`
- installed + enabled：`开始对话`

Hub 先执行必要的安装或启用；成功后才发送启动意图。宿主仅在 Session 创建成功后关闭 Hub，并向 frame 回传成功；失败时回传错误，按钮恢复且 Hub 保持打开。所有 capability IPC 返回值均用统一断言处理，禁止 `ok:false` 被显示为成功。

### 4. 依赖降级是 Session 展示状态，不是授权捷径

专家 DTO/Session 使用已有 `dependencies`、bindings 和连接器状态构造轻量 readiness 投影：`ready`、`limited`、`missing`、`auth_required`。快照保留 persona 和声明绑定；context assembly 与工具 runtime 继续对 enabled/auth/allowlist 求交集。

为了避免启动性能回退，创建 Session 时不主动连接 MCP 或执行远程探测；只读取本地 install store/连接器配置。需要健康探测时沿用连接器详情现有按需加载。

### 5. 专家欢迎区复用现有空状态

`workspace-agent.js` 在无消息且 `activeSession.expertId` 存在时优先渲染专家欢迎区：

- 专家名称与描述；
- persona 绑定的建议任务；
- 已就绪/受限能力摘要；
- 受限连接器的“去配置”动作。

Tab 标题优先使用专家名称，普通消息渲染和 composer 不分叉。选择“去配置”时通过既有工作区入口打开连接器 Tab，不销毁当前专家 Session。

### 6. 快照稳定，执行权限实时收紧

Session 的 persona 和 binding hash 来自创建时快照，因此专家更新/卸载不会改写历史对话。实际技能与连接器投影仍与当前可用状态求交集；依赖后来失效时，旧 Session 可以继续普通对话，但不能调用失效工具。

## Risks / Trade-offs

- [安装成功但 Session 创建失败会留下已安装专家] → 保留安装结果并明确提示“已安装，但未能打开对话”，允许用户重试“开始对话”；不做破坏性回滚。
- [iframe 消息可能被其他页面伪造] → 校验 `event.source` 必须等于当前 Hub frame，并限制消息类型和 expertId 格式。
- [依赖状态可能在 Session 打开期间变化] → 欢迎区使用本地快照展示初始状态，执行时以主进程实时安全投影为准；失败返回可操作说明。
- [保留旧 `expert-try-chat` handler 造成概念冗余] → renderer 与新测试不再使用；后续兼容窗口结束后可单独删除 IPC，不在本变更强行破坏旧调用。
- [专家空状态增加额外 DOM] → 仅在空专家 Session 渲染，不增加后台监听或常驻进程。

## Migration Plan

1. 先上线 renderer 的新 CTA、消息桥和 WorkspaceAgent 公开入口，主进程复用现有 `agent-session-new`。
2. 为专家 Session 增加可选展示字段时保持 Session normalize 向后兼容，旧 Session 缺字段时按普通 Session 渲染。
3. 更新测试，确认没有 renderer 再调用 `expert-try-chat`。
4. 若需回滚，可恢复旧按钮与消息处理；已创建的普通专家 Session 仍是合法现有数据，无需迁移或删除。
