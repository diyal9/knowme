## ADDED Requirements

### Requirement: Canvas node cards use type-colored header chrome

专业画布摘要卡 MUST 以**全宽类型主题色头栏**标识节点种类（而非仅顶部细线）。头栏 MUST 覆盖图标、类型标签、标题与操作按钮区域，并保证文字与图标在该色带上可读。选中态 MUST 仍使用独立描边/高亮，且 MUST NOT 覆盖或取消类型色头栏。

#### Scenario: Tool node shows amber header band

- **WHEN** 画布渲染 `tool` 节点摘要卡
- **THEN** 头栏 MUST 呈现工具主题色全宽背景（金棕/琥珀系），且 MUST NOT 仅依赖顶边 3px 色条作为类型信号

#### Scenario: Knowledge and llm headers use distinct themes

- **WHEN** 画布同时渲染 `knowledge` 与 `llm` 节点
- **THEN** 二者头栏主题色 MUST 可区分（青系 vs 靛系），扫读时无需读标题即可辨类型

#### Scenario: Selection ring coexists with type header

- **WHEN** 用户选中带类型色头栏的节点
- **THEN** 卡片 MUST 显示选中高亮（如蓝描边），且类型色头栏 MUST 仍然可见

### Requirement: Canvas summary body emphasizes key values

专业画布摘要卡正文 MUST 拉开层次：分区标题（如「输入」「工具」）视觉权重低于取值；空态或警示取值（如「未选择技能」「未绑定专家」）MUST 比普通已填取值更醒目。卡片 MUST 保持只读，MUST NOT 因此重新引入可编辑控件。

#### Scenario: Empty skill value stands out under Tool section

- **WHEN** `tool` 节点未选择技能
- **THEN** 「未选择技能」类文案 MUST 以警示/强调色呈现，且分区标题「工具」MUST 弱于该取值

#### Scenario: Filled values remain scannable

- **WHEN** 节点摘要区含已填写的输入或输出文案
- **THEN** 取值 MUST 比分区标题更醒目（更深或更粗），便于扫读主内容
