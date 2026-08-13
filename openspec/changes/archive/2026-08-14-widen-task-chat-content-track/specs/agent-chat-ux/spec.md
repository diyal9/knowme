## ADDED Requirements

### Requirement: Workbench task-room chat fills the dialogue column

工作台任务间（task-room）中的对话记录与 Composer MUST 铺满左栏可用宽度（允许适度内边距），MUST NOT 再套用助理全宽无文档页的居中窄轨道；普通助手正文在该场景下 MUST 与消息轨大致同宽。助理模式且未进入工作台任务间时，全宽居中阅读轨道 MUST 保持不变。

#### Scenario: Wide window workflow task dialogue

- **WHEN** 用户在宽窗口打开工作流/专家任务对话（task-room）并查看多轮消息
- **THEN** 消息气泡、执行过程条与底部 Composer 水平铺满左栏可用区域，两侧不再出现助理首页级大块居中留白
- **AND** 助手正文宽度与消息轨对齐，不额外收成明显更窄的内轨

#### Scenario: Assistant-only home remains centered

- **WHEN** 用户处于助理模式且未打开工作台任务间、且无右侧文档面
- **THEN** 对话列仍使用居中的受限内容轨道
- **AND** 长回答保持适合连续阅读的行长
