## ADDED Requirements

### Requirement: Assistant responses use a focused reading layout

普通助手回复 MUST 使用适合连续阅读的受限正文宽度和稳定纵向节奏；结构化选择与该正文左缘对齐并形成独立操作区；会话态 Composer MUST 比空会话任务启动态更紧凑，同时 MUST 保留内容增长、附件、模型选择和发送能力。

#### Scenario: Long answer in a wide window

- **WHEN** 用户在宽窗口中查看包含多个段落、标题或列表的普通助手回复
- **THEN** 正文使用受限阅读宽度，单行文字不横跨整个可用消息列
- **AND** 标题、段落与列表之间保持清晰且一致的垂直间距

#### Scenario: Structured choices follow an answer

- **WHEN** 助手回复包含一个或多个合法结构化选择
- **THEN** 选择区与正文左缘对齐，并通过标题、状态和选项边界与正文形成可识别分区
- **AND** 每个未选择选项在常态、悬停和键盘聚焦时均可被识别为可交互

#### Scenario: Choice description wraps in a narrow window

- **WHEN** 窄窗口中的结构化选择包含较长标题或说明
- **THEN** 选项文字自然换行且不被截断到不可读
- **AND** 选项编号、标题和说明保持稳定对齐，不产生横向溢出

#### Scenario: Conversation composer stays compact

- **WHEN** 当前 Session 已有消息并展示底部 Composer
- **THEN** Composer 使用紧凑的默认高度并可随输入内容增长
- **AND** 空会话任务启动态的主 Composer 仍保留更大的启动输入空间
