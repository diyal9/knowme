# Delta Spec: agent-chat-ux

## ADDED Requirements

### Requirement: Streaming markdown repaints incrementally

系统 MUST 在流式渲染 Markdown 时只更新变化的块级节点，MUST NOT 每帧整体替换 `.chat-text` 容器。

#### Scenario: Text continues on the same line

- **GIVEN** 助手正在输出，且新增内容仍在未闭合的尾行
- **WHEN** 新的 chunk 到达并触发重绘
- **THEN** 系统 MUST 只更新 `.md-stream-tail` 的文本内容
- **AND** 已渲染的段落 / 表格 / 链接卡片节点 MUST 保持同一节点身份

#### Scenario: A stable block is finalized

- **GIVEN** 尾行完成并进入稳定区
- **WHEN** 重绘发生
- **THEN** 系统 MUST 只替换新增或变化的块级节点，其余保持不变

### Requirement: First token upgrades the thinking bubble in place

系统 MUST 在首个正文 token 到达时就地把「思考中」气泡升级为正文气泡，MUST NOT 触发整个会话列表的全量重绘。

#### Scenario: First content token arrives

- **GIVEN** 助手气泡处于思考态（无正文）
- **WHEN** 第一个正文 token 到达
- **THEN** 系统 MUST 在同一气泡节点内移除思考态指示并插入正文容器
- **AND** 会话中其他消息的 DOM 节点 MUST 保持不变
