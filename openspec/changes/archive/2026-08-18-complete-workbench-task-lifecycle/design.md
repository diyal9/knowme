## Context

工作台渲染层 `src/workbench.js` 目前以 `pendingGoal`、`modal` 和内存中的 `run` 分别表示目标、启动弹窗和执行状态；最近任务则直接来自 `workbench-load` 返回的 Daemon tasks。主进程已经提供结构化 Workbench IPC，Daemon client 已负责安全请求、状态和制品规范化。

本 change 只补齐渲染层任务生命周期和必要的本地草稿持久化，不修改 Daemon 协议。真实 Daemon 任务仍由服务端保存，刷新/重启时通过现有任务列表重新投影。

## Decisions

### 1. 任务草稿作为单一用户上下文

新增轻量 `workbenchTaskDraft` 状态，包含：

```text
goal, workflowId, modeId, agentIds, context, phase, updatedAt
```

草稿由主进程通过一个受限的版本化 store 持久化，Renderer 只传 plain DTO。进入团队、能力中心或取消启动弹窗时不清空草稿；成功创建 Daemon task 后将 slug 写回草稿并转入 `running`。

### 2. 准备层复用现有启动弹窗

不新增第二套启动协议。现有 workflow modal 增加准备信息和草稿动作，开始执行仍调用 `workbenchDaemonStart` 或现有本地工作流入口。目标未匹配时保留目标并展示推荐模板，而不是只聚焦搜索框。

### 3. 终态由显式分类函数归一化

新增纯函数区分：

- `success`: finished/completed/done/success
- `failure`: failed/error/rejected
- `cancelled`: cancelled
- `waiting`: gate/clarification/blocked
- `active`: queued/pending/running

`res.terminal` 只代表轮询停止条件，不代表任务成功。制品只在终态读取，读取失败不覆盖任务原始终态。

### 4. 恢复动作保持协议诚实

Workbench 当前没有 Daemon cancel/resume 接口，因此失败和取消只提供“重新启动当前目标”与“查看详情/制品”等真实动作，不调用 Agent Service 的 cancel/resume 冒充 Daemon 能力。

### 5. 最近任务统一使用状态动作

首页与任务页共用任务动作标签和状态文案。启动成功、任务终止、刷新和重新打开任务后，统一刷新 Daemon overview，避免最近任务停留在旧快照。

### 6. 完成状态与产物可用性分离

任务成功只表示执行已终止且未失败，不等于已经交付可打开产物。Renderer 根据统一 artifact 投影区分：

- `completed-with-artifacts`：显示用户向结论和可打开产物；
- `completed-empty`：显示“已完成 · 无产物”，提供查看执行过程和再跑一次；
- 非完成态：继续显示审批、澄清、补充材料等对应操作。

协作区的 `factualBrief` 继续用于模型 grounding，但不再作为完成态 UI 文案直接输出，避免暴露 `done`、等待类型等内部状态串。

### 7. 统一产物投影

Agent Graph、本地团队与 Daemon 的终态响应先经过同一套 artifact 归一化规则：保留显式 `artifacts`，并从后端返回的文件路径、URL 或结构化输出中提取可识别产物。归一化结果写入当前 run/task 投影并随终态刷新；不得把输入路径当作产物，也不得为纯文本日志伪造可打开文件。

## Electron 边界与性能

- Main：唯一读写草稿 store，新增 IPC 仅限 `workbench-task-draft-get/save/clear`。
- Preload：只暴露上述三个结构化方法，不提供任意请求桥。
- Renderer：不读写用户路径；轮询仍只有一个 timer，任务列表刷新复用现有 overview。
- 草稿限制为单个用户当前草稿，目标文本和 context 按现有输入上限截断，不增加启动网络请求。

## Risks / Trade-offs

- 草稿增加一次小型本地读写，但可避免跨页面配置丢失；写入采用现有 store 的原子方式。
- 重新启动失败任务会创建新的 Daemon task，不伪造原任务恢复；UI 明确显示这是“重新启动”。
- 本地工作流运行仍使用现有内存 run；Daemon 任务具备重启后恢复，避免扩大本 change 的持久化范围。
- 某些后端只返回文本结论而没有文件或 URL；这类任务会诚实进入无产物完成态，日志仍可查看，但不会伪造 artifact。
