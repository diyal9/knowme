# Agent lane contracts

## ADDED Requirements

### Requirement: Shared runtime contracts preserve lane-specific orchestration

KnowMe MUST 让伙伴、专家与工作流复用公共上下文、Run、输出协议、工具治理和恢复保障，同时保留各 lane 的产品生命周期。公共 DTO 的 optional 字段 MUST NOT 迫使 lane 伪造不存在的 Task、Turn、message 或 approval。

#### Scenario: Partner answers a simple question

- **WHEN** 伙伴收到无需工具的直接问题
- **THEN** 可在一个 turn/run 内提交回答
- **AND** MUST NOT 强制生成专家计划、正式委托或成果验收

#### Scenario: Expert starts a formal commission

- **WHEN** 专家任务 planningPolicy 为 confirm_plan
- **THEN** 先通过专家合同确认再进入正式执行
- **AND** 使用公共 Run、Context 和 Output Protocol

#### Scenario: Workflow reaches a human gate

- **WHEN** 工作流图执行到 human/gate node
- **THEN** Workflow Run 保持 waiting 并保存 node attempt/checkpoint
- **AND** 该 gate MUST NOT 被映射为专家计划确认或成果验收

### Requirement: Workflow parent child and attempt identity remain isolated

工作流 MUST 使用 root/parent/child Run 与 workflow node attempt 建立关联。一个节点或子 Run 的事件、重试和终态 MUST NOT 更新其他节点 attempt、兄弟 Run 或 root Run 的 canonical answer。

#### Scenario: Old child event arrives after node rerun

- **GIVEN** node attempt 1 已失败且 attempt 2 已启动
- **WHEN** attempt 1 的迟到事件到达
- **THEN** 事件只能归属 attempt 1
- **AND** MUST NOT 覆盖 attempt 2 状态或 root Run 结果

#### Scenario: Tool-only node completes

- **WHEN** 工作流 tool node 完成且没有用户对话消息
- **THEN** 节点结果通过 workflow state/event 保存
- **AND** MUST NOT 创建伪造 assistant message

### Requirement: Public contract changes require cross-lane regression

任何修改 ContextBlock phase、Run identity、V2 reducer、checkpoint 或 execution receipt 的变更 MUST 同批验证 partner、expert 与 workflow 代表路径；未通过任一 lane 的兼容回归时，不得标记公共契约完成。

#### Scenario: V2 reducer behavior changes

- **WHEN** reducer 对 ignored/fallback 的判定发生修改
- **THEN** 测试必须覆盖伙伴回答、专家消息恢复和工作流子 Run 事件
- **AND** 三类路径均不得新增重复正文或错误终态
