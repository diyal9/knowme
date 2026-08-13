## ADDED Requirements

### Requirement: Failed v2 answer surfaces the actionable runtime error

当 Run 以错误结束且助手气泡没有已提交正文时，界面 MUST 展示运行时返回的可执行错误文案（例如缺少工具、连接器未启用）。通用兜底文案 MUST 仅在运行时未提供错误描述时使用。

#### Scenario: Missing tool error reaches the user

- **GIVEN** 用户点击「查文档/知识库」但所需工具不可用
- **WHEN** 运行时返回带原因的错误
- **THEN** 助手气泡展示该原因与下一步操作提示
- **AND** 不再只显示「未能收到完整答复，请重试。」

#### Scenario: Generic fallback only without a reason

- **GIVEN** 运行时返回错误但没有可读描述
- **WHEN** 界面渲染失败气泡
- **THEN** 展示通用兜底文案
