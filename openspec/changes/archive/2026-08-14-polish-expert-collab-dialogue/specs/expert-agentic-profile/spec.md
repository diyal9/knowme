## Purpose

定义专家 Agent 的 Soul（特性化与风格）、SOP（岗位职责）与 AgenticType（五种 Agentic 设计模式）配置模型，以及创建/编辑时的联动表单与 Runtime 模式脚手架，使专家真正具备所选 Agentic 能力。

## ADDED Requirements

### Requirement: Expert profile includes Soul and SOP

专家包 MUST 区分 **Soul**（性格、风格、价值观、提问与表达方式）与 **SOP**（岗位职责、工作步骤、交付标准、协作方式）。创建与编辑界面 MUST 提供对应输入区，不得再仅以单一未标注的「系统提示词」作为唯一专家定义入口（兼容旧数据时可将原 systemPrompt 迁入 SOP）。

#### Scenario: Create expert with Soul and SOP

- **WHEN** 用户新建专家并分别填写 Soul 与 SOP 后保存
- **THEN** 专家包持久化 Soul 与 SOP
- **AND** 后续 Session 快照可读取这两段内容

#### Scenario: Legacy systemPrompt maps to SOP

- **WHEN** 加载仅含 systemPrompt、无 Soul/SOP 的旧专家包
- **THEN** 运行时将 systemPrompt 视为 SOP
- **AND** Soul 可为空，专家仍可激活

### Requirement: AgenticType selects one of five design patterns

专家 MUST 声明 `agenticType`，取值限定为：`reflection`、`tool_use`、`react`、`planning`、`multi_agent`（对应反射、工具使用、ReAct、规划、多智能体）。缺省 MUST 为 `react`。

#### Scenario: Set AgenticType on save

- **WHEN** 用户在编辑器选择 `planning` 并保存
- **THEN** 专家包持久化 `agenticType: planning`
- **AND** Session 快照包含该类型

#### Scenario: Invalid type rejected

- **WHEN** 保存时 `agenticType` 不在五类枚举内
- **THEN** 校验失败并提示错误
- **AND** 不写入磁盘

### Requirement: Editor UI cascades on AgenticType

创建/编辑专家时，界面 MUST 提供 AgenticType 下拉；切换类型后 MUST 联动显示该模式相关配置与输入引导，并隐藏无关配置，且 MUST NOT 清空已填写的 Soul / SOP。

#### Scenario: Switch from react to planning

- **WHEN** 用户将 AgenticType 从 `react` 改为 `planning`
- **THEN** 显示规划相关配置（如是否先输出计划）
- **AND** Soul 与 SOP 文本保留

#### Scenario: Switch to tool_use shows tool policy fields

- **WHEN** 用户选择 `tool_use`
- **THEN** 显示工具策略或必选连接器相关引导配置
- **AND** 反射轮次等仅 reflection 相关字段不作为必填展示

### Requirement: Runtime applies AgenticType scaffold

Agent Runtime / context assembly MUST 根据专家快照的 `agenticType` 注入对应模式脚手架，使该专家协作具备可观察的模式行为（反射自检、工具优先、ReAct 循环、先规划后执行、或多智能体委派边界说明）。`multi_agent` MUST 表达委派策略与边界，MUST NOT 在本能力内静默启动完整多智能体图编排引擎。

#### Scenario: Planning expert opens with plan-first behavior

- **WHEN** 用户与 `agenticType=planning` 的专家开始任务协作并请求复杂目标
- **THEN** 装配上下文含规划模式脚手架
- **AND** 专家被指示先给出可执行路线图再深入执行

#### Scenario: Reflection expert includes self-check scaffold

- **WHEN** Session 绑定 `agenticType=reflection` 的专家
- **THEN** 装配上下文含反射/自检脚手架

#### Scenario: Multi-agent type states delegation boundary

- **WHEN** Session 绑定 `agenticType=multi_agent` 的专家
- **THEN** 装配上下文含委派条件与角色边界说明
- **AND** 不自动创建未声明的完整多 Agent 运行图
