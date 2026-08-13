## Purpose

定义工作台专家协作对话房的右侧能力装配 chrome 与专家身份表达，使用户在协作现场可操作连接器、技能与知识，并始终感知「与所选专家协作」。

## ADDED Requirements

### Requirement: Expert collab side rail is actionable

专家协作对话房（无工作流绑定的专家任务房）右侧「连接器」「技能」「知识」区块 MUST 提供可发现的添加或管理入口。用户 MUST 能在不离开该对话房的情况下调整本次协作的对应范围；变更 MUST 反映到侧栏展示，并影响该 Session 后续工具/检索范围。

#### Scenario: Manage knowledge from side rail

- **WHEN** 用户在专家协作房右侧打开知识管理并勾选或取消知识库
- **THEN** 当前 Session 的知识范围立即更新并持久化
- **AND** 侧栏知识展示与 Composer 知识控件保持一致
- **AND** 其他 Session 与全局默认不受影响

#### Scenario: Add or remove skill for this collaboration

- **WHEN** 用户在右侧技能区添加或移除已安装技能
- **THEN** 当前 Session 的技能绑定覆盖更新
- **AND** 侧栏技能芯片与数量立即刷新
- **AND** 后续该 Session 的技能装配遵循更新后的绑定

#### Scenario: Add or remove connector for this collaboration

- **WHEN** 用户在右侧连接器区添加或移除已注册连接器
- **THEN** 当前 Session 的连接器绑定覆盖更新
- **AND** 侧栏连接器展示立即刷新
- **AND** 未授权或未就绪的连接器 MUST 显示受限状态并可导向配置，MUST NOT 伪造成功授权

#### Scenario: Curated expert package is not silently rewritten

- **WHEN** 用户仅在侧栏调整本次协作的技能或连接器
- **THEN** 系统 MUST NOT 静默改写精选/只读专家包磁盘内容
- **AND** 若专家可调优，MAY 提供前往专家库调优的入口

### Requirement: Expert collab empty state centers the expert

当工作台处于 `expert-chat` 专家协作对话房且对话尚无消息时，左侧空态 MUST 以当前专家身份为中心（名称、专长/能力、Soul/SOP 或专业开工动作），MUST NOT 展示工作流「协作引导」模板及其「01 工作流 / 02 当前节点 / 03 参与助手」结构。

#### Scenario: Expert chat empty shows expert collab home

- **WHEN** 用户打开专家协作对话房且历史为空
- **THEN** 空态展示专家协作首屏（含专家名与专业开工动作）
- **AND** 不出现「协作引导」工作流步骤列表

#### Scenario: Workflow chat empty remains process-oriented

- **WHEN** 用户打开工作流对话房或 Daemon 任务协作且历史为空
- **THEN** 仍可使用流程向的引导空态
- **AND** MUST NOT 被专家协作首屏替换

### Requirement: Side rail reflects expert professional profile

专家协作房右侧 MUST 展示足以体现该专家专业性的身份信息（名称、来源徽章、能力标签，以及可获得时的 AgenticType / 职责摘要），使用户理解「正在与哪类专家、按何种方式协作」。

#### Scenario: Side rail shows expert specialty cues

- **WHEN** 用户打开已配置 Soul/SOP 或能力标签的专家协作房
- **THEN** 右侧可见专家名与至少一项专业线索（能力标签或职责/模式摘要）
