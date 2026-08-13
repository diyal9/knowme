## ADDED Requirements

### Requirement: Specialty palette nodes do not require expert binding

专业调色板中的 `llm`、`tool`、`knowledge` 节点 MUST NOT 要求绑定本地专家 Package 即可通过保存与试跑前校验。`agent`（专家）节点 MUST 继续要求 `agentPackageId`。`tool` MUST 配置 Skill；`knowledge` MUST 配置知识库；`llm` MUST 配置可用模型标识与可用 Prompt（允许空 Prompt 时使用默认占位策略，但模型 MUST 已选）。

#### Scenario: Save llm without expert

- **WHEN** 用户添加大模型节点，从模型目录选择模型并填写 Prompt，未选择执行专家
- **THEN** `validateDraft` MUST 通过，MUST NOT 出现「需要绑定本地专家」

#### Scenario: Agent node still requires package

- **WHEN** 用户添加专家节点但未选择执行专家
- **THEN** 校验 MUST 失败并指出该节点需要绑定本地专家

#### Scenario: Tool requires skill not expert

- **WHEN** 用户添加工具节点并选择 Skill，未选择执行专家
- **THEN** 校验 MUST 通过；若未选 Skill 则 MUST 失败并提示需要选择 Skill

### Requirement: LLM node model picks from hub catalog

大模型节点的模型字段 MUST 以 LLM Hub / 产品模型目录中的可选项为主呈现（如下拉），MUST NOT 仅提供无来源约束的裸文本作为默认交互。选项 MUST 与设置页/会话可用的模型目录同源；`auto` MAY 作为合法选项。

#### Scenario: Select model from catalog

- **WHEN** 用户打开大模型节点属性或卡片上的模型控件
- **THEN** 可见选项 MUST 来自模型目录（含已配置 provider 下的模型），用户选择后写入节点配置

### Requirement: Inspector and card fields match node family

专业画布中，大模型 / 工具 / 知识库节点的卡片内联字段与右侧属性面板 MUST 展示该族专属配置，MUST NOT 再展示「执行专家」作为必填或主路径控件。专家节点 MUST 继续展示执行专家选择。

#### Scenario: LLM inspector without expert field

- **WHEN** 用户选中大模型节点
- **THEN** 右侧属性 MUST 含节点名称、模型、温度、Prompt 等，MUST NOT 要求填写执行专家

#### Scenario: Expert inspector keeps package field

- **WHEN** 用户选中专家节点
- **THEN** 右侧属性 MUST 含执行专家选择

### Requirement: Palette copy describes atomic capabilities

调色板中大模型 / 工具 / 知识库的说明文案 MUST 表达「直连能力」语义（模型调用 / 技能 / 检索），MUST NOT 暗示必须先绑定专家才能使用。

#### Scenario: LLM palette hint

- **WHEN** 用户查看调色板「大模型」项
- **THEN** hint MUST 指向 Prompt 与模型选择，而非「可绑定专家」作为使用前提
