## MODIFIED Requirements

### Requirement: Deferred dynamic orchestration

工作台 MUST 支持从总览、管线详情、Agent 详情或新建运行入口进入 Agent Graph 草案和确认流程；动态编排 MUST 使用已安装且已授权的 Agent 与 Skill 生成可解释 Graph，并在执行前完成 Graph、Agent 引用、handoff、权限和治理校验。客户端不得直接执行未经确认的任意 Graph。固定专业管线、个人工作流和 Daemon workflow MUST 通过统一 Workflow Package 表达，并保持明确的执行来源。

#### Scenario: Goal routes to workflow choices

- **WHEN** 用户在工作台输入目标
- **THEN** 工作台显示匹配的专业管线、个人工作流、可用 Agent 和 Graph 编排入口

#### Scenario: Dynamic orchestration from workbench

- **WHEN** 用户选择动态 Agent 协作
- **THEN** 工作台展示 Agent Graph 草案、节点职责、执行关系、能力版本和确认入口

#### Scenario: Confirmed dynamic orchestration

- **WHEN** 用户确认通过校验的 Agent Graph
- **THEN** 工作台创建本地 Team Run 或指定后端 Run，并将真实 Run Tree 状态投影到任务区域

#### Scenario: Invalid dynamic orchestration

- **WHEN** Graph 引用未知 Agent/Skill、包含环或不满足治理约束
- **THEN** 工作台阻止执行并保留可修订的 Graph 草案

#### Scenario: Workflow source remains explicit

- **WHEN** 用户启动 Daemon 专业管线或本地个人工作流
- **THEN** 运行区域分别显示专业管线与 Daemon 后端、本地工作流与 Local Team Runtime，不得混淆二者

#### Scenario: Continue with an Agent

- **WHEN** 用户带着当前目标在 Agent 工作面选择一个 ready 的 Agent Profile
- **THEN** 工作台提供“用此 Agent 新建运行”或“开始会话”的真实入口，并将目标与 Profile 快照传入后续上下文

#### Scenario: Start a run from an Agent profile

- **WHEN** 用户选择“用此 Agent 新建运行”
- **THEN** 统一启动流程预选该 Profile，启动后 Run 保存 Profile 版本、Skill 和权限快照；聊天会话不得冒充 Run

#### Scenario: Agent launch is not a navigation-only action

- **WHEN** 用户从目标推荐或资源详情选择 Agent
- **THEN** 系统进入可继续的启动状态，不得仅切换资源页面或显示提示后结束
