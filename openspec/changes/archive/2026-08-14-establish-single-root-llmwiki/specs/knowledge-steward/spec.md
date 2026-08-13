## MODIFIED Requirements

### Requirement: Default task templates

知识整理入口 MUST 以用户任务描述能力，至少提供“添加资料”“检查知识问题”“整理成稳定知识”“搜索知识”四种动作；默认界面 MUST NOT 要求用户选择 ingest、lint、promote、remote-rag 等内部工具名。

#### Scenario: Click check template

- **WHEN** 用户点击“检查知识问题”
- **THEN** 系统检查默认根库的空内容、重复、断链与操作契约
- **AND** 结果以可读问题列表展示

#### Scenario: Click add template

- **WHEN** 用户点击“添加资料”
- **THEN** 引导粘贴文本、创建 raw 资料或从授权目录导入文件
- **AND** 完成后“我的知识”可见新资料

#### Scenario: Click organize template

- **WHEN** 用户点击“整理成稳定知识”且存在可整理资料
- **THEN** 生成待确认提案
- **AND** 不立即覆盖原始资料或写入稳定知识

#### Scenario: Click search template

- **WHEN** 用户点击“搜索知识”
- **THEN** 聚焦知识首页搜索输入或发起带来源的知识查询
- **AND** 工具不可用时给出可操作提示，不得编造命中结果

### Requirement: End-to-end steward loop

系统 MUST 支持用户只通过添加资料、检查问题、确认整理建议和搜索完成一次根库闭环，底层工具调用与目录转换不得成为完成任务的前置知识。

#### Scenario: Add check propose accept

- **WHEN** 用户依次添加 raw 资料、检查问题、生成整理建议并接受
- **THEN** 根库磁盘状态、索引与界面一致更新
- **AND** 全程可在“我的知识”与“待我确认”内完成
- **AND** 原始 raw 资料保持可回溯
