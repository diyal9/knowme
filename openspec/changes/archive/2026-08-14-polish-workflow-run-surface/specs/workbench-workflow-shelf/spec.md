## MODIFIED Requirements

### Requirement: Run view is a three-stage takeover

从货架启动后 MUST 进入接管式运行视图，包含且仅包含三个阶段：确认输入、执行中、产物。运行视图 MUST 始终显示当前所处阶段与返回货架的退路。确认输入阶段 MUST 依据工作流的 `inputs` 生成表单，并展示将参与的 Agent（若可从工作流解析）与实际使用的执行后端。

运行视图的信息层级 MUST 避免重复：工作流显示名与产出摘要 MUST 仅在运行顶栏呈现一次；确认输入卡片 MUST 只呈现阶段指引、表单字段与只读元信息，MUST NOT 再次复制顶栏标题与产出摘要。字段标签 MUST NOT 向用户暴露 schema 原始类型名（例如 `text`、`string`）。必填字段 MUST 使用可读的「必填」标记。执行后端 MUST 以产品向中文只读文案披露，MUST NOT 要求用户选择后端。

#### Scenario: Stage progression is visible

- **WHEN** 用户启动一个工作流
- **THEN** 运行视图显示「确认输入 → 执行中 → 产物」三段进度，并高亮当前阶段

#### Scenario: Inputs are derived from the workflow

- **WHEN** 工作流声明了输入项
- **THEN** 确认输入阶段为每个输入项生成对应表单控件，缺少必填项时不允许进入执行

#### Scenario: No duplicate identity copy on input stage

- **WHEN** 用户处于确认输入阶段且顶栏已显示工作流名与产出摘要
- **THEN** 确认输入卡片不重复显示相同标题与「产出：…」文案

#### Scenario: Field labels are product-facing

- **WHEN** 工作流某输入声明 `type: text` 且 `required: true`
- **THEN** 标签显示字段名与「必填」标记，且界面不出现字面量 `text`

#### Scenario: Participants disclosed before running

- **WHEN** 用户处于确认输入阶段且工作流可解析出参与 Agent
- **THEN** 系统展示本次将参与的 Agent 与实际执行后端，用户确认后才开始执行

#### Scenario: Backend disclosed in product language

- **WHEN** 系统选定 Local Team Runtime 作为执行后端
- **THEN** 确认输入阶段只读展示对用户友好的中文说明（如「本机专家团队」），不把内部代号作为主文案
