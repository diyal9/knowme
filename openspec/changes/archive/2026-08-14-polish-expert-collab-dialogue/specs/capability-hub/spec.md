## ADDED Requirements

### Requirement: Expert editor captures Soul SOP and AgenticType

Capability Hub 的专家创建与编辑流程 MUST 提供 Soul、SOP 输入区与 AgenticType 下拉，并按所选类型联动展示模式配置字段。保存 MUST 将上述字段写入专家包。

#### Scenario: Editor shows Soul and SOP fields

- **WHEN** 用户打开新建或编辑专家对话框
- **THEN** 可见 Soul 与 SOP 输入区
- **AND** 可见 AgenticType 下拉（五类模式）

#### Scenario: Cascading fields update on type change

- **WHEN** 用户切换 AgenticType
- **THEN** 表单展示该类型相关配置
- **AND** 已填 Soul/SOP 不被清空

#### Scenario: Save persists agentic profile

- **WHEN** 用户填写 Soul、SOP、AgenticType 与联动配置并保存
- **THEN** Hub 列表/详情可反映类型与描述
- **AND** 磁盘专家包含对应字段
