## ADDED Requirements

### Requirement: Leaving workbench exits task room and process projection

用户离开工作台进入助理时，系统 MUST 退出工作台 task-room 协作态，清除任务上下文与 Daemon 过程投影，再恢复助理 Session surface。

#### Scenario: Open assistant rail after workflow or daemon room

- **WHEN** 用户从工作流对话房或 Daemon 运行间点击左侧助理入口
- **THEN** 工作台 task-room 布局关闭
- **AND** 助理栏高亮且对话列为助理 surface
- **AND** 对话区不保留工作台「当前工作」空态或 Daemon 过程块

#### Scenario: Re-enter daemon run restores process feed only on workbench

- **WHEN** 用户曾切到助理清空过程投影后又回到同一 Daemon 运行间
- **THEN** 工作台可重新同步并展示过程投影
- **AND** 助理面仍保持无过程块

### Requirement: Assistant empty home never stacks with daemon process card

助理「开始使用」空态 MUST NOT 与 Daemon 过程卡在同一对话列同时对用户可见。

#### Scenario: Empty assistant home without process overlay

- **WHEN** 助理当前 Session 无消息且用户处于助理模式
- **THEN** 仅展示助理空态（含开始使用入口）
- **AND** 不展示过程投影卡片
