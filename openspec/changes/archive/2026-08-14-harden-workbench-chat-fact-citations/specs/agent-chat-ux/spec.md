## ADDED Requirements

### Requirement: 工作台助手气泡展示引用来源

当对话 surface 为工作台任务协作时，已完成的助手气泡 MUST 在正文下方渲染「引用来源」可展开区域；条目 MUST 使用用户可读标签，不得只展示内部 id。无任何可用来源时 MUST NOT 渲染空壳来源区。

#### Scenario: 渲染可读来源列表

- **WHEN** 助手消息带有非空 workbenchCitations 或等价来源列表
- **THEN** 气泡展示「引用来源」summary 与条目列表
- **AND** 每条含可读 label（可选 detail/path）

#### Scenario: 无来源不渲染空壳

- **WHEN** 助手消息无工作台来源且 grounding 亦无来源
- **THEN** 不渲染「引用来源」空 details
