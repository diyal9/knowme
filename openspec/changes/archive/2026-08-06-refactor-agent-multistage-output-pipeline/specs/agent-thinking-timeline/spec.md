## ADDED Requirements

### Requirement: Timeline is driven only by progress and tool lanes

执行过程时间线 MUST 只消费 progress 与 tool lane；answer 与 ui 事件 MUST NOT 新建、覆盖或删除工具步骤。用户可见时间线 MUST 展示产品化的阶段标题、工具摘要、证据状态和待确认动作，MUST NOT 展示原始 provider reasoning 或内部协议字段。

#### Scenario: Model round is buffered

- **WHEN** 工具可用模型轮正在生成但尚未确定是否调用工具
- **THEN** 时间线显示可读的生成/处理阶段
- **AND** 不展示该轮原始 prose、reasoning 或 JSON

#### Scenario: Tool lifecycle updates

- **WHEN** 同一工具依次产生 started 与 completed/failed 事件
- **THEN** 系统在同一时间线步骤上更新状态
- **AND** 不因事件 lane 分离而创建重复工具行

#### Scenario: Answer commits after tools

- **WHEN** canonical answer 提交并且无 pending review
- **THEN** 时间线在原节点上收敛为完成摘要并折叠
- **AND** 最终回答正文保持原位

### Requirement: Pending review remains actionable across terminal state

Run 已提交答案或进入 completed 时，仍处于 pending_review 的工具步骤 MUST 保持展开且批准/拒绝入口可见；terminal 事件 MUST NOT 把该步骤误标为普通 done。

#### Scenario: Draft waits for approval

- **WHEN** 写工具返回待确认 draft 且 Run 已完成回答
- **THEN** 时间线保持展开
- **AND** 批准与拒绝入口仍指向原 draft

#### Scenario: Approval resolves later

- **WHEN** 用户批准或拒绝 draft
- **THEN** 只更新对应步骤与结构化动作状态
- **AND** 已提交回答正文不被重新渲染

### Requirement: Timeline tolerates duplicate and late events

执行过程 MUST 按 Run 序号幂等消费事件；重复或迟到的 progress/tool 事件 MUST NOT 重播动画、复位用户展开状态、覆盖新状态或改变滚动位置。

#### Scenario: Duplicate tool completed event

- **WHEN** 同一 seq 或同一已完成工具事件重复到达
- **THEN** 时间线 DOM 与状态保持不变

#### Scenario: Late pending event

- **WHEN** completed 之后到达较旧的 pending 事件
- **THEN** 工具步骤保持 completed
- **AND** 用户展开状态不变
