> **UI 层主张已被取代（superseded by `rebuild-workbench-workflow-shelf`）**
> 本提案的资源模型层仍然有效并在服役：Workflow Package、Agent Profile、统一 Run 投影、
> Daemon 作为可插拔执行后端。
> 被取代的是 UI 层主张：「开始工作 / 搭建 Agent 两条路径」「五 Tab 控制台」
> 「Launch Controller 统一入口」「领域筛选默认预筛」均已删除。工作台现在是
> 货架 + 运行 两态，管理类能力收进抽屉。以本目录的 UI 描述为准会与实现不符。

## Why

KnowMe 工作台目前将 Daemon 工作流、Agent 团队、任务运行和自动化入口并列展示，用户难以理解它们如何共同完成一个目标。工作台需要回到 KnowMe Agent 体系：Skill 提供可扩展能力，Agent 组合能力，Graph 编排 Agent，专业管线沉淀经过验证的工作方法，Daemon 只是可插拔的执行后端。

这次变更将固定专业管线、用户自定义工作流和派生工作流统一为可版本化的 Workflow Package，并以专业控制台承载“管线 → 运行 → Agent → 编排 → 结果 → 复用”的产品闭环。自然语言目标仍是新建运行的重要输入，但不再独占首屏或替代专业对象导航。

## What Changes

- 新增统一的 Workflow Package 资源模型，支持官方专业管线、团队管线、个人工作流和派生管线。
- 新增 Agent Profile 配置模型，将 Agent 的角色、Skill、模型、连接器、权限、记忆、输出协议和预算作为可保存配置。
- 将专业管线和个人工作流纳入统一流程库，支持查看、执行、复制、自定义、版本化和来源追溯。
- 将工作台收敛为「开始工作 / 搭建 Agent」两条用户路径；现成工作流、个人工作流、运行目录和任务工作间归入开始工作，Agent 与协作步骤归入搭建 Agent。
- 将日常办公、软件研发、视觉创作提升为始终可见的领域筛选，并为每个领域提供 readiness 与至少一条真实垂直管线。
- 将 Daemon、Local Team Runtime、兼容本地运行和自动化触发投影为统一但来源明确的运行目录。
- 将能力中心、流程库、编排工作室和运行中心通过统一的 goal/workflow/composition/run/artifact 上下文关联。
- 将 Graph 编排工作室扩展为可保存、可复制的个人工作流入口，复用现有 Agent Graph 编译和 Team Runtime。
- 将 Daemon 明确为执行后端，与本地 Team Runtime、兼容本地运行路径使用统一但来源明确的 Run 投影。
- 增加专业管线的输入输出、依赖、质量门禁、权限和执行后端声明。
- 支持从官方专业管线复制为个人版本，不直接修改官方版本。
- **BREAKING**：工作台不再将 Daemon 作为专业能力分类；所有入口必须通过 Workflow Package 或 Agent Composition 表达执行意图。

## Capabilities

### New Capabilities

- `workflow-package`: 统一管理专业管线、个人工作流、派生管线及其版本、依赖、输入输出和执行后端。
- `agent-profile`: 管理可安装 Agent 的角色、Skill、模型、连接器、权限、记忆、输出协议和预算配置。
- `workbench-flow-library`: 在工作台中发现、复制、配置和启动专业管线及个人工作流。
- `agent-composition-studio`: 提供基于 Agent 和 Skill 的 Graph 编排、校验、保存和复用体验。

### Modified Capabilities

- `agent-workbench`: 将工作台改为控制台优先的能力、流程、编排和运行闭环，并统一页面上下文。
- `capability-hub`: 能力中心需要支持 Agent Profile 配置、Skill 绑定和跳转到当前目标/工作流。
- `agent-skills-runtime`: Skill 配置必须能进入 Agent Profile 和 Workflow Package 快照，执行时保持版本和权限可追溯。
- `workspace`: 工作台页面之间通过统一工作上下文关联，Daemon 作为执行后端而不是独立产品分类。

## Impact

- 主进程和 preload：增加 Workflow Package、Agent Profile、流程库和 Composition 持久化及受限 IPC。
- Renderer：重组 `src/workbench.js`、`src/workspace.html` 的目标、团队、流程、编排和运行投影。
- 能力运行时：复用并扩展 `capability-manifest-v2.js`、`expert-runtime.js`、`skill-runtime.js` 和 capability hub service。
- Agent Runtime：复用 `workbench-agent-graph.js`、`agent-team-workflow-runner.js`、`agent-run-manager.js` 和 Daemon client，不重写 Agent Executor。
- 数据：新增 Workflow Package、Agent Profile、Composition Draft 和统一 Run Context 的本地持久化结构。
- 产品价值：让软件研发、美术生产、内容生产等专业管线共享同一套 KnowMe Agent 能力底座，并允许用户将成功实践沉淀为自己的工作流资产。

## 目标用户

- 希望直接使用专业管线完成任务的普通用户。
- 希望安装和调教 Agent、Skill、连接器的高级用户。
- 希望组合多个 Agent 建立个人工作方法的专业用户。
- 需要提供可版本化、可审计专业管线的团队和能力包维护者。

## 验收标准

- 用户在 10 秒内能理解「直接使用现成工作流」与「搭建自己的 Agent」两条路径，并能从开始工作页识别正在运行、等待处理、失败任务与环境阻塞。
- 用户可以从始终可见的领域筛选切换办公、研发、视觉；筛选会一致作用于管线、运行、Agent 和编排资产。
- 用户从目标或已知管线出发均可新建运行，并且目标上下文在页面之间不丢失。
- 专业管线和个人工作流使用统一资源模型，但能明确显示来源、版本和执行后端。
- 用户可以在节点检查器中配置 Agent 的职责、提示词、Skill、知识来源、模型、连接器、权限、记忆和输出协议，并将配置快照带入执行。
- 用户可以拖入已安装 Agent，使用「接着执行 / 同时执行 / 执行前确认」调整协作关系，完成校验、确认、保存、复制和再次执行。
- 用户可以将官方管线复制为个人版本，官方版本保持不可变。
- Daemon、Local Team Runtime 和兼容本地运行均能显示真实来源和统一运行状态。
- 运行结果可以追溯到目标、Workflow Package、Composition、Agent/Skill 版本和产物。
- Daemon、Local Team、兼容本地与自动化触发的运行进入同一运行目录，并保持真实 executionSource。
- 办公会议整理、研发交付和视觉生成三条垂直路径必须根据真实依赖动态计算 readiness；依赖就绪时可创建统一 Run，缺依赖时诚实阻断。
- 失败、取消、审批等待和不可恢复状态不会被显示为成功完成。
- 既有 Daemon 工作流、能力中心和旧本地运行路径保持可用。
- `npm test`、`npm run lint`、OpenSpec strict validate、Electron smoke 和工作台体验验收通过。

## 非目标（Non-goals）

- 不重写 Agent Executor、模型循环、工具协议或 Daemon 远程协议。
- 不在本变更中实现新的模型供应商或远程算力调度系统。
- 不允许未确认的任意 Graph、脚本节点或未经授权的 Skill 执行。
- 不直接修改官方专业管线；用户必须通过复制产生个人版本。
- 不将所有 Skill 都暴露为自由连接的 Graph 节点；高风险或非确定性能力必须通过 Agent Profile 和治理规则使用。
- 不一次性实现复杂的市场、多人协作发布和计费系统。

## 2026-08-09 验收纠偏

上一轮 19 项 Electron smoke 仅证明控制台壳层、领域筛选和阻断态存在，未证明 Agent Profile 启动、Graph 保存再跑、自动化统一 Run、产物打开复用和三领域 ready 路径。该结果不得继续作为生产闭环通过证据。本轮必须以真实创建、恢复和完成 Run 的行为验收。

## 2026-08-09 双轨体验纠偏

第 8 阶段虽然补齐了真实 Run 行为，但「工作 / 资源 / 编排」仍要求普通用户理解 Workflow Package、Agent Profile、Graph、Daemon 和 readiness 等内部概念，编排页也仍是不可编辑的纵向预览。制作人本轮体验复核不通过，原 PASS 只保留为技术闭环历史证据，不代表当前产品体验通过。

本轮将产品入口调整为：

- **开始工作**：目标输入、现成工作流、个人工作流与我的工作；Daemon、MCP 和 Local Team Runtime 仅作为详情中的执行来源。
- **搭建 Agent**：拖入 Agent、调整简单协作关系、点击节点配置 Skill、提示词、知识库和高级属性，并保存为个人工作流。

本轮不把 Skill、MCP 或知识库暴露为自由连线节点，也不引入重型自由画布。它们作为 Agent 的受治理能力进入 Profile 和运行快照。

## 2026-08-10 四页职责纠偏

双轨实现仍将 Daemon Agent 与本地 Agent 混入同一候选列表，也把“编辑工作流”和“调教 Agent”放在同一个页面。用户无法判断哪些 Agent 可编辑、哪些属于固定执行服务。

本轮将工作台一级入口调整为：

- **开始工作**：目标、推荐、我的工作与统一结果入口；
- **工作流**：仅使用本地 Agent 作为 DAG 节点，编辑协作步骤并保存个人工作流；
- **智能体管理**：编辑所有非 Daemon 的本地 Agent 及默认 Profile；
- **Daemon 模式**：浏览、启动和监控 Daemon 工作模式及其固定只读 Agent 阵容。

Daemon Agent 不得进入本地工作流节点候选，也不得通过 Renderer 或主进程映射到本地 Agent 保存路径。本地 Agent 的 Package/Profile 变更与工作流快照继续保持版本和哈希可追溯。
