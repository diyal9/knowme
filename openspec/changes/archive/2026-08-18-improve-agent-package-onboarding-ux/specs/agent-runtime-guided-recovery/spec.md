## Purpose

将运行时阻塞、失败、取消与恢复状态转化为可执行的用户动作，确保用户在异常态下始终知道当前发生了什么以及下一步该做什么。

## ADDED Requirements

### Requirement: 运行阻塞状态必须提供下一步动作指引

系统 SHALL 在 `WAITING_INPUT`、`WAITING_APPROVAL`、`WAITING_CHILD` 等等待态展示阻塞原因、推荐动作与预计等待，不得仅显示状态标签。

#### Scenario: 等待用户输入

- **WHEN** 运行进入 `WAITING_INPUT`
- **THEN** 界面展示缺失输入项、推荐补充动作与提交入口

#### Scenario: 等待审批

- **WHEN** 运行进入 `WAITING_APPROVAL`
- **THEN** 界面展示审批对象摘要、风险提示与审批操作入口

### Requirement: 失败状态必须提供结构化修复入口

系统 MUST 为远程超时、权限不足、协议不兼容与证据不足等失败类别提供至少一个推荐修复动作与可选替代动作。

#### Scenario: 远程超时失败

- **WHEN** 子 Run 失败原因为远程超时
- **THEN** 系统展示重试与降级本地执行动作

#### Scenario: 权限不足失败

- **WHEN** 运行因权限拒绝终止
- **THEN** 系统展示所缺权限范围与调整路径

### Requirement: 取消与恢复必须提供阶段化反馈

系统 MUST 显示取消与恢复过程中的中间阶段，并在终态前禁止展示“已完成”语义。

#### Scenario: 取消过程中

- **WHEN** 用户触发父 Run 取消且子 Run 尚未全部收敛
- **THEN** 界面展示“取消请求已发送”和“正在收敛子 Run”阶段

#### Scenario: 恢复失败

- **WHEN** 用户尝试恢复一个不可恢复的运行
- **THEN** 系统展示恢复失败原因与替代动作
