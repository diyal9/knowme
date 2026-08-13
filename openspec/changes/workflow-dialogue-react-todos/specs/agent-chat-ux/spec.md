## ADDED Requirements

### Requirement: Plan checklist renders as To-dos

当助手消息携带结构化 `plan.items` 时，聊天 UI MUST 渲染 To-dos 清单：标题含总项数（例如「To-dos 5」），条目展示 pending / doing / done / blocked 的可区分标记；进行中条目 MUST 明显区别于待办。该表面 MUST 绑定结构化 plan，MUST NOT 仅依赖模型输出的 Markdown 勾选列表作为唯一进度源。

#### Scenario: To-dos header shows count

- **WHEN** plan 含 5 条 items
- **THEN** 清单标题可见项数 5（或等价「To-dos 5」文案）

#### Scenario: Doing vs pending marks differ

- **WHEN** 一条为 doing、一条为 pending
- **THEN** 两条的状态标记视觉不同
- **AND** 屏幕阅读器可通过状态类名或文案区分
