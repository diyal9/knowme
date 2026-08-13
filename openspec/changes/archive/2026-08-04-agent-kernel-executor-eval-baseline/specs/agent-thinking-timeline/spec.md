# agent-thinking-timeline — Run phase metadata for eval

## ADDED Requirements

### Requirement: Run phase metadata on stream events

Stage 与 tool 流式事件 SHOULD 携带可机器读取的 Run 阶段标识（如 `runPhase`），其值 MUST 与执行内核阶段枚举一致；C 端展示文案 MUST 保持既有 title/summary，不得因新增字段而改变用户可见文案。

#### Scenario: Stage event includes runPhase

- **WHEN** 内核进入 `CONTEXT` 并 emit stage 事件
- **THEN** 事件 payload 含 `runPhase: 'CONTEXT'`（或等价字段）
- **AND** `title` 仍为既有本地化阶段标题

#### Scenario: Tool event includes runPhase

- **WHEN** 内核进入 `TOOL` 并 emit tool 事件
- **THEN** 事件 payload 含 `runPhase: 'TOOL'`

#### Scenario: UI text unchanged

- **WHEN** 渲染进程展示时间线
- **THEN** 仅使用 `title`/`summary` 等既有字段
- **AND** 不展示 `runPhase` 给用户（除非未来 Story 明确要求）
