## ADDED Requirements

### Requirement: 输出协议必须提供可指引的诊断语义

输出协议 SHALL 为等待、失败、取消和恢复事件提供可渲染的诊断字段，包括 `reason`、`recommendedAction`、`alternativeActions` 与 `estimatedWait`。

#### Scenario: 映射等待事件

- **WHEN** Runtime 发布等待态事件
- **THEN** 输出协议映射中包含阻塞原因与推荐下一步动作

### Requirement: 输出协议必须区分过程态与终态

输出协议 MUST 保证取消与恢复过程态不会被标记为完成语义，终态仍保持单次提交约束。

#### Scenario: 取消收敛中

- **WHEN** 系统处于取消收敛中间阶段
- **THEN** 输出协议将该事件标记为过程态并禁止 answer lane 终态提交
