## ADDED Requirements

### Requirement: Workbench shared work context

工作台的目标、能力中心、流程库、编排工作室、运行中心和产物视图 MUST 共享可恢复的工作上下文，至少包含 goal、workflow、composition、run 和 artifact 引用。

#### Scenario: Navigate through workflow context

- **WHEN** 用户从目标进入流程库，再进入 Agent Profile 和编排工作室
- **THEN** 每个页面保留同一目标与草稿上下文，并能返回上一步

#### Scenario: Restore after restart

- **WHEN** 用户重启应用后打开未完成的工作
- **THEN** 工作台恢复目标、流程来源、Graph 快照和 rootRunId，无法安全恢复时显示重新确认入口

### Requirement: Workbench navigation follows professional object lifecycle

工作台导航 MUST 稳定提供“开始工作 / 工作流 / 智能体管理 / Daemon 模式”四个职责页面。开始工作 MUST 承载目标输入、推荐与我的工作；工作流 MUST 承载本地 Agent 节点选择、协作步骤、保存与测试运行；智能体管理 MUST 承载本地 Agent Package 与默认 Profile 编辑；Daemon 模式 MUST 承载固定只读 Agent 阵容、Daemon 工作模式启动与运行监控。

#### Scenario: Work-first entry

- **WHEN** 用户进入工作台首页
- **THEN** 开始工作页优先显示目标输入、可用工作流和“我的工作”，并提供唯一的开始工作入口

#### Scenario: Start from a goal

- **WHEN** 用户从新建运行入口输入自然语言目标
- **THEN** 系统保留目标上下文并推荐本地工作流或 Daemon 模式；需要自定义协作时可进入工作流页，且不要求用户重新输入

#### Scenario: Separate editable and fixed Agents

- **WHEN** 用户在智能体管理、工作流和 Daemon 模式之间切换
- **THEN** 本地 Agent 只在前两者可编辑或选为节点，Daemon Agent 只在 Daemon 模式中以只读阵容展示

#### Scenario: Result continues work

- **WHEN** 一个流程完成并产生结果
- **THEN** 结果区域提供查看产物、重试、继续、复制为个人工作流和返回原 Graph 的操作

#### Scenario: Resource selection enters the same launcher

- **WHEN** 用户从管线或 Agent 详情选择主操作
- **THEN** 系统打开同一个新建运行流程并预选该资源，不以单纯切页或 toast 作为结果

### Requirement: Visible domain context

开始工作页 MUST 显示全部、日常办公、软件研发和视觉创作领域筛选；领域筛选 MUST 一致作用于工作流、运行和 Agent 候选，但不得被描述为执行后端。搭建 Agent 页可沿用当前领域作为候选过滤，编辑中的协作步骤不得因切换领域而丢失。

#### Scenario: Switch professional domain

- **WHEN** 用户从软件研发切换到视觉创作
- **THEN** 工作流、运行、Agent 候选和准备情况同步更新，并保留用户所处路径与未保存草案

### Requirement: Actionable console states

每个工作面 MUST 提供与真实状态一致的 loading、empty、offline、degraded、permission、error 和 ready 状态；空态或阻塞态 MUST 至少包含一个可执行修复动作。

#### Scenario: Visual provider unavailable

- **WHEN** 用户查看视觉创作且图像 Provider 未配置
- **THEN** 总览和管线详情显示缺失 Provider、配置入口与受影响操作，启动按钮保持禁用

### Requirement: Unified run directory

运行中心 MUST 汇总 Daemon、Local Team Runtime、兼容本地与自动化触发的运行摘要，明确显示 executionSource、真实状态、更新时间、待处理动作和产物数量；兼容本地运行不得伪装成可跨会话恢复。

#### Scenario: Review cross-backend runs

- **WHEN** 用户在“全部”领域查看运行中心
- **THEN** 不同执行后端的运行出现在同一目录并保留来源标签，失败、取消和等待状态不显示为完成

### Requirement: Production vertical slices

工作台 MUST 为办公会议整理、研发交付和视觉生成至少各提供一条真实可执行或诚实阻断的垂直管线。

#### Scenario: Missing dependency blocks a domain pipeline

- **WHEN** 某领域管线缺少模型、连接器、Agent、Daemon 或图像 Provider
- **THEN** 系统列出具体阻塞项并禁止启动，不显示假进度或占位成功

#### Scenario: Ready dependency launches a domain pipeline

- **WHEN** 某领域管线的真实依赖已满足且用户提供必需输入
- **THEN** 系统创建带稳定标识和 executionSource 的统一 Run，并进入工作面任务详情

### Requirement: Single launch state machine

工作台 MUST 以单一启动状态机处理来自顶栏、资源详情、编排和产物的启动意图，并持久化领域、资源、目标、输入引用、后端、Profile 快照、Run 引用和返回状态。

#### Scenario: Restore an interrupted launch

- **WHEN** 用户在完成 readiness 前重启应用
- **THEN** 工作台恢复启动草稿并停留在需要补充的步骤，不重复创建 Run

#### Scenario: Reuse an artifact

- **WHEN** 用户在完成运行的产物上选择“用于新运行”
- **THEN** 新建运行流程携带结构化 artifactRef，并允许用户选择目标资源
