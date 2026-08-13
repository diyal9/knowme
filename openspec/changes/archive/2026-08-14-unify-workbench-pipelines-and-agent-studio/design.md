## Context

现有 KnowMe 已具备 Capability Hub、Expert/Skill Runtime、Agent Package、Agent Graph 编译器、Local Team Runtime 和 Daemon Client，但工作台仍把这些能力分散在不同页面和不同执行语义中。上一阶段的 `workbench-agent-graph-runtime` 已建立本地 Graph 执行边界；本变更在其上补充 Workflow Package、Agent Profile、流程库和共享工作上下文。

约束：

- Electron 主进程拥有能力目录、Profile、Workflow Package 和 Run Store 的读写权。
- Renderer 只处理目标、表单、Graph 草案和受限 DTO，不读取任意能力目录或创建 Run。
- 既有 Daemon 协议、Local Team Runtime、Skill progressive disclosure 和 capability trust 规则继续有效。
- 应用启动时不能加载所有 Skill 正文或完整 Package 内容，避免启动变慢和内存膨胀。

## Goals / Non-Goals

**Goals:**

- 让官方专业管线、个人工作流和派生管线共享统一 Workflow Package 资源模型。
- 将 Agent 配置和 Skill 快照纳入可验证的工作流执行上下文。
- 将工作台页面连接为目标驱动的连续路径。
- 复用现有 Graph Runtime，并提供可保存、可复制的 Composition。
- 保持 Daemon 作为执行后端，而不是产品分类。

**Non-Goals:**

- 不重写 Agent Executor、模型循环、Skill 工具协议或 Daemon API。
- 不实现多人协作市场、计费和远程管线发布系统。
- 不允许任意脚本节点或未经确认的自动 Graph 执行。

## Decisions

### 1. Workflow Package 作为统一资源边界

新增 `WorkflowPackage` DTO，统一描述官方、团队、个人和派生工作流：

```text
{
  id, source, version, status, parentRef,
  goalTypes, inputs, outputs,
  agentRefs, skillRefs, graph,
  executionBackends, governance, qualityGates,
  provenance
}
```

选择该模型而不是继续扩展 Daemon workflow DTO，是因为 Daemon 只描述一种执行后端，不能承载本地 Agent Graph、Profile 快照和个人工作流生命周期。

### 2. Agent Profile 与 Agent Package 分层

`Agent Package` 是可执行能力包；`Agent Profile` 是用户针对该能力包的可配置实例。Profile 只保存允许覆盖的字段：

- role overlay
- enabled skill refs
- model policy
- connector refs
- permissions
- memory policy
- output contract
- budget

启动时将 Profile 解析为带版本和哈希的执行快照，禁止 Renderer 直接修改 Package 内容。

### 3. Skill 默认作为 Agent 内部能力

编排工作室默认以 Agent 为节点，Skill 作为 Agent Profile 的能力集合。只有确定性、低风险且具有清晰输入输出的 Skill 才允许成为直接 Graph 节点，避免把每个 Skill 暴露为任意工具链。

### 4. 主进程提供统一 Store 和受限 IPC

主进程增加四类结构化操作：

- Workflow Package：list/get/save/fork/archive
- Agent Profile：get/save/test
- Composition：validate/save
- Work Context：restore/update

所有写入都通过 schema、trust、dependency、permission 和 version 校验。Renderer 不获得文件系统路径、Package loader 或 Run Manager。

### 5. 工作台采用共享工作上下文而非页面互跳

共享上下文 DTO：

```text
{
  goalId, goal,
  workflowId, workflowVersion,
  compositionId, compositionHash,
  rootRunId, executionSource,
  artifactRefs
}
```

上下文持久化在用户数据目录，页面跳转只传引用，不传完整 Package 和 Skill 正文。应用重启后优先恢复引用和摘要；快照失效时显示重新确认，而不是静默替换。

### 6. 执行后端与流程类型分离

Workflow Package 声明支持的执行后端，Run DTO 单独记录 `executionSource`：

- `local-team`
- `daemon`
- `legacy-local`

这样同一类专业管线可以在不同环境选择后端，同时 UI 始终显示“专业管线 / 个人工作流”这一产品类型。

### 7. Electron 边界与启动性能

- 主进程只在请求具体流程、Profile 或 Run 时读取完整内容。
- 首屏只加载流程摘要、能力摘要和最近上下文。
- Skill 正文继续使用 L0/L1/L2/L3 progressive disclosure。
- Graph、Agent、Skill、输入输出和日志均设上限。
- 运行状态沿用单一轮询器或事件桥，终态后停止。

## Risks / Trade-offs

- [统一模型迁移复杂] → 先通过适配器映射现有 Daemon workflow 和 Agent Graph，不一次性替换旧数据。
- [Profile 与 Package 版本漂移] → 保存 contentHash 和 version，启动前重新验证，漂移时要求用户确认。
- [页面上下文丢失] → 所有入口使用 Work Context DTO，并为刷新/重启增加恢复测试。
- [工作台首屏变重] → 只加载摘要，完整 Skill 和 Package 按需读取。
- [官方管线被误改] → 官方和团队资源只读，使用 fork 生成个人版本。
- [Daemon 与本地运行语义混淆] → Run 展示使用统一状态，但强制保留 executionSource 和 backend label。

## Migration Plan

1. 先增加纯 DTO、Store 和 schema 校验，不改变旧入口。
2. 将现有 Agent Graph Composition 适配为个人 Workflow Package。
3. 将现有 Daemon workflow 适配为 official/team Workflow Package 的只读摘要。
4. 增加 Agent Profile 读写、Skill 快照和能力中心深链。
5. 将工作台首页、流程库、编排和运行区域接入 Work Context。
6. 默认启用新入口；旧本地和 Daemon 入口保留 feature flag 回退。
7. 通过单测、集成测试、Electron smoke 和制作人/测试角色验收后再清理旧展示分支。

## Open Questions

- 专业管线目录的远程同步和发布权限可在后续团队协作 Story 中确定，不影响本地 Workflow Package 契约。

## 2026-08-08 首页产品闭环补充（已被控制台决策吸收）

- 首页 hero 下方固定展示「专业管线 / 我的 Agent / Graph 编排」三入口；提交目标后弹出 `#wbGoalPathPicker`，`recommendGoalPath()` 给出推荐，用户可改选。
- 新增顶栏 Tab「流程库」（`#wbFlowsPage`），`renderFlowLibrary()` 按 official/team/forked/personal 分组渲染 Workflow Package 摘要，支持 use/fork/inspect/graph。
- 移除隐藏 legacy 首页（`wb-goal-legacy`）；状态条（Daemon、工作流/Agent 计数）与今日待办保留在可见区域。
- 团队页新增「我的资产」区（`#wbTeamAssetsPanel`），常驻 Agent Profile 与个人工作流管理入口。

## 2026-08-08 生产级控制台决策

### 8. 控制台优先，目标作为新建运行输入

工作台采用「总览 / 管线 / 运行 / Agent / 编排」五个稳定工作面。自然语言目标、常用起点和三协作路径不再组成大面积营销式首页，而是收敛到“新建运行”入口。这样既保留目标上下文，又让专业用户能直接找到 Workflow Package、Run、Agent Profile 和 Composition。

总览只加载摘要并优先显示：

- 待审批、失败和阻塞的运行；
- 正在运行的工作；
- 常用或最近使用的管线；
- 办公、研发、视觉三个领域的环境 readiness；
- 最近产物和自动化状态。

### 9. 领域筛选是可见的全局上下文

`office`、`engineering`、`visual` 不再藏在高级菜单。顶栏领域筛选作用于管线、运行、Agent 和编排资产；`all` 只表示跨领域查看，不覆盖持久化的工作模式绑定。领域不是执行后端，不能用 Daemon 在线状态代替领域 readiness。

### 10. 统一运行目录使用适配器而非新建事实源

主进程返回有界的 `WorkbenchConsoleProjection`：

```text
{
  domains: [{ id, name, readiness, blockers, counts }],
  runs: [{ id, domain, status, executionSource, title, updatedAt, artifactCount }],
  attention: [{ runId, kind, title, action }],
  automation: [{ id, enabled, lastStatus, nextRunAt }]
}
```

Daemon Task、Agent Run Tree、当前草稿和自动化记录通过纯适配器进入该投影。原始 Daemon、AgentRunStore 和 Workflow Package Store 仍是权威事实源；Renderer 不获得任意 store 或路径访问能力。

### 11. 三领域必须有诚实的垂直切片

- 办公：会议资料 → 纪要 → 决策/待办 → 产物；
- 研发：需求 → 实现 → 测试 → 交付；
- 视觉：Brief → 文案/提示词 → 图像生成 → 审阅 → 导出。

缺少模型、连接器、图像 Provider、Daemon 或 Agent Package 时，readiness 必须列出阻塞项并禁止启动。不得通过占位按钮、假进度或“调度器开发中”的可点击动作伪装已接通。

### 12. 编排工作室从弹窗提升为工作面

现有 Graph 计划和确认协议保持不变，但编辑、校验、保存和复制进入独立编排页。首期使用结构化 DAG 列表、关系视图与节点检查器，避免引入重型画布依赖；执行前仍通过现有主进程校验和明确确认。

### 13. 视觉与代码组织

- 保留 Segoe UI Variable，使用控制台级字号、间距、圆角、表面和语义状态 token；
- 以列表、分栏和详情面板替代等宽卡片墙；
- `workbench.js` 只协调页面和动作，领域 readiness、运行投影和筛选使用可单测纯模块；
- 工作台 CSS 从 `workspace.html` 内联规则逐步收敛到独立样式文件；
- 默认窗口和窄窗口采用同一信息优先级，窄窗口以列表 → 详情钻取替代强行多栏。

## 2026-08-09 闭环收敛决策

### 14. 三工作面代替五个平级目录

一级导航收敛为「工作 / 资源 / 编排」：

- 工作：待处理、运行队列、任务工作间和最近产物；
- 资源：管线与 Agent 两种资源的列表和详情；
- 编排：Graph 草案、节点检查、校验、保存和运行。

管线、Agent 和 Run 仍保留独立资源语义，但不再各占一个相互割裂的空页面。自动化继续保留侧栏入口，其触发结果投影到工作面。

### 15. 唯一 Launch Controller

所有入口只构造受限 `LaunchIntent`，不得自行以切页或 toast 结束：

```text
{
  domain, resourceType, resourceId,
  goal, inputRefs, backend,
  profileSnapshot, returnState
}
```

Launch Controller 统一执行输入补全、readiness、权限确认和后端选择；成功后必须返回稳定 `runId/rootRunId/slug` 并进入工作面任务详情。Work Context 和 Task Draft 共同保存启动意图与恢复引用，但不保存 secret。

### 16. 垂直管线动态 readiness

三条内置垂直管线是适配器而非静态 unavailable 卡片。主进程根据现有事实源解析：

- 办公：可用办公 Agent 或会议/文档连接器；
- 研发：Daemon 在线且存在工作流，或 Local Team Runtime 可执行；
- 视觉：可用视觉 Agent 和图像 Provider。

解析结果为 ready 时必须选择真实后端并创建统一 Run；blocked 时返回结构化 blocker 和修复动作。测试 seam 可以提供确定性本地执行器，但 UI 不得伪造生产 Provider。

### 17. 证据必须覆盖行为

静态 DOM、按钮可见和 blocked 文案只能作为壳层证据。以下动作必须由 Electron 或集成测试完成：

- Profile 快照启动并恢复 Run；
- Graph 保存、启动、重载后再次运行；
- Daemon 与 Local Team 混合运行目录；
- 自动化绑定 Workflow Package 后产生 Run；
- 产物可打开并能作为下一次启动输入；
- ready 与 blocked 两类三领域状态。

## 2026-08-09 双轨体验决策

### 18. 两条用户路径代替技术对象导航

一级导航只保留「开始工作 / 搭建 Agent」：

- 开始工作承载目标输入、现成工作流、个人工作流、运行队列和任务详情；
- 搭建 Agent 承载 Agent 选择、协作步骤、节点配置、保存和测试运行。

`Workflow Package`、`Agent Profile`、`Graph`、`Daemon` 和 `MCP` 继续作为内部契约，但主路径分别使用「工作流」「Agent 设置」「协作步骤」「执行服务」「外部工具」等用户语言。领域筛选只作用于开始工作页和 Agent 列表，不要求用户将领域理解为执行后端。

### 19. 轻量 Agent 步骤编辑器

编辑器使用三栏结构：Agent 列表、纵向步骤流、节点检查器。首期使用原生 DOM Drag and Drop 与键盘等价操作，不引入画布依赖或自由连线：

- Agent 可拖入步骤流，并可拖动调整顺序；
- 节点间关系限定为 `serial`、`parallel` 和 `approval` 三种用户可理解语义；
- Graph 编译器负责将简单关系展开为合法 DAG；
- 保存和测试运行前仍使用主进程校验，Renderer 不直接创建 Run。

Skill、MCP、知识库不成为独立节点。节点只引用 Agent Package 与节点级 Profile；节点首次修改时创建工作流级 Profile 副本，避免修改共享 Profile。

### 20. Agent Profile 扩展和执行语义

Agent Profile 增加：

- `promptOverlay`：Agent 的行为要求、边界和交付标准；
- `knowledgeRefs`：允许访问的知识来源引用；
- `knowledgePolicy`：知识检索与工作记忆策略；
- `profileId`：Graph member/node 对应的节点级配置引用。

Profile 规范化、哈希与快照必须包含这些字段；旧 Profile 缺少字段时使用安全默认值。运行解析时将角色与提示词组合为 persona，将知识引用与策略写入受限执行上下文和 Run 快照。不得只保存 UI 字段而不影响实际运行。

### 21. 工作页渐进披露

开始工作首屏优先展示目标输入、可完成的工作流和我的工作。技术状态仅在需要时披露：

- 工作流摘要展示结果、所需材料、步骤数和是否可用；
- 参与 Agent、权限、连接器和执行来源进入详情；
- 缺依赖时显示用户可执行的修复动作，不暴露内部 ID 或原始协议错误；
- 待处理、运行中和最近结果收敛为「我的工作」，不再以 KPI 控制台作为主心智。

## 2026-08-10 四页职责决策

### 22. 本地 Agent 与 Daemon Agent 分属不同目录

`workbench-load` MUST 同时返回本地 Agent catalog 与 `daemon.agents`，不得再用 Daemon catalog 覆盖本地 catalog。统一 Agent 摘要增加 `origin` 与 `editable`：

- `origin: local`：由 Expert Runtime 解析，可在智能体管理页编辑；
- `origin: repository`：活动仓库中的本地 Agent，可作为兼容摘要；
- `origin: daemon`：远程固定阵容，只能在 Daemon 模式页查看。

工作流 Graph 只接受可由本地 Agent Package Runtime 解析的 `origin: local` 节点。Daemon Agent ID 即使与本地 ID 同名，也不得获得本地保存能力。

### 23. 四个一级页面按资产生命周期分工

- 开始工作：目标、推荐和统一工作状态；
- 工作流：本地 Agent 节点选择、关系、步骤意图、保存和测试运行；
- 智能体管理：本地 Agent Package 与默认 Profile 编辑；
- Daemon 模式：Daemon 工作模式、固定 Agent 阵容、依赖、启动和任务监控。

隐藏运行页继续作为统一任务详情，不占一级 Tab。领域筛选在开始工作与工作流生效；智能体管理与 Daemon 模式使用各自搜索和状态过滤。

### 24. 工作流引用受管理 Agent 而不复制编辑器

工作流节点保存 `agentOrigin`、`agentPackageId`、`profileId`、Package/Profile 哈希和执行快照。工作流页面只编辑步骤名称、该步骤目标和节点关系，Skill、基础提示词、知识库和高级策略由智能体管理页维护。Agent 更新后，旧工作流保持历史快照，用户显式刷新节点后才升级。

### 25. Daemon 页面是只读目录与运行入口

Daemon 模式页直接使用 Daemon overview 的 workflows、agents、tasks、auth 和 health 摘要。固定 Agent 卡仅显示职责、状态和所属模式，不显示编辑、复制节点或保存 Profile 操作。启动继续复用 Launch Controller 与现有 Daemon IPC，任务详情继续进入统一运行页。
