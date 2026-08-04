# agent-thinking-timeline Specification

## Purpose

定义 Agent 推理/执行时间线的信息层级，避免过程块淹没对话。

## Requirements

### Requirement: 时间线降噪

系统 MUST 在推理过程中突出当前动作，并默认折叠工具原始结果。

#### Scenario: 执行中

- **WHEN** Run 仍有 pending 步骤
- **THEN** 总摘要显示「执行进度」，当前步骤高亮，已完成步骤紧凑弱化

#### Scenario: 工具结果

- **WHEN** 工具步骤含详细结果
- **THEN** 结果默认折叠，提供「查看结果」类入口

#### Scenario: 完成后

- **WHEN** 回答完成且无 pending
- **THEN** 时间线默认收起为「执行过程」

### Requirement: Execution timeline updates in place instead of rebuilding

系统 MUST 在流式过程中以增量方式更新「执行过程」时间线，MUST NOT 每次进度事件或计时 tick 都整棵替换 `<details class="agent-execution">`。

#### Scenario: Elapsed timer ticks each second

- **GIVEN** 一条 assistant 消息正在流式输出且已有执行过程时间线
- **WHEN** 计时器每秒刷新一次耗时
- **THEN** 系统 MUST 只更新耗时文本节点
- **AND** 已存在的 trace 行 DOM 节点 MUST 保持同一节点身份（不被替换）
- **AND** 呼吸球 / pulse 动画 MUST NOT 重新开始播放

#### Scenario: New tool step arrives

- **GIVEN** 时间线已渲染 N 行
- **WHEN** 新增一个工具步骤或已有步骤状态由 pending 变为 done
- **THEN** 系统 MUST 只新增或替换受影响的那一行
- **AND** 其余未变化的行 MUST 保持原节点不变

#### Scenario: User expanded a tool detail during streaming

- **GIVEN** 用户在流式过程中展开了某个工具步骤的详情
- **WHEN** 后续进度事件或计时 tick 刷新时间线
- **THEN** 该步骤 MUST 保持展开状态

#### Scenario: User collapsed the execution card during streaming

- **GIVEN** 用户手动折叠了「执行过程」卡片
- **WHEN** 后续进度事件刷新时间线
- **THEN** 系统 MUST NOT 强制重新展开
