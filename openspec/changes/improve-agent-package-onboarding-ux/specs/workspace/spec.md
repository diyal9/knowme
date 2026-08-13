## ADDED Requirements

### Requirement: 工作台必须提供导入决策面板

工作台 SHALL 在导入 Agent Package 时展示统一决策面板，包含能力摘要、权限范围、兼容性判定、风险等级、成本估算与安装/取消入口。

#### Scenario: 用户在工作台导入 Package

- **WHEN** 用户从能力目录发起导入操作
- **THEN** 工作台展示标准导入决策面板并等待用户确认

### Requirement: 工作台必须提供异常态下一步指引

工作台 MUST 在运行出现等待、失败、取消和恢复场景时展示“下一步”指引区域，包含推荐动作与备选动作。

#### Scenario: 运行进入失败态

- **WHEN** 某个 Run 状态变为 `FAILED`
- **THEN** 工作台在时间线附近展示推荐修复动作与详细原因入口
