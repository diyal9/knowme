# workbench-artifact-tools Specification

## Purpose

管理 Agent 运行中产生的 Markdown/表格/PDF 等交付物，支持创建、更新、导出与审阅，首版能力边界清晰、禁止虚假格式支持。

## Requirements

### Requirement: Markdown and text artifacts

系统 MUST 提供 `create_artifact` 与 `update_artifact`，支持 kind=`markdown|text`；artifact MUST 有 stable `id`、title、body，并可关联 runId。

#### Scenario: Create markdown artifact

- **WHEN** 模型创建 markdown artifact
- **THEN** UI 时间线/消息区展示 artifact 卡片
- **AND** envelope 含 `artifactRefs`

#### Scenario: Update preserves id

- **WHEN** 模型对已有 artifact 调用 update
- **THEN** 同 id 内容更新，版本号或 updatedAt 递增

### Requirement: CSV export

系统 MUST 提供 `export_table_csv`，输入为 JSON 数组或 `{columns, rows}`；输出 CSV 文件到内容源 `artifacts/` 或 Run 沙箱。

#### Scenario: Export small table

- **WHEN** 输入 10 行 5 列数据
- **THEN** 生成 UTF-8 CSV 且可在 UI 打开/复制路径

### Requirement: PDF export bounded scope

系统 MUST 提供 `export_pdf`，仅支持 Markdown/HTML 渲染后本地 print-to-pdf；页数 MUST ≤20；**MUST NOT** 声称支持 docx/pptx 原生导出。

#### Scenario: PDF within page limit

- **WHEN** 内容可渲染为 ≤20 页 PDF
- **THEN** 生成 PDF 文件并返回 path 摘要

#### Scenario: PDF over limit rejected

- **WHEN** 估算页数 >20
- **THEN** 返回 `pdf_too_large` 并建议拆分

### Requirement: No false format support

工具描述与 UI MUST NOT 列出首版未实现的能力（Word 在线编辑、云端 PDF API、Excel 公式）。

#### Scenario: Docx request redirected

- **WHEN** 用户要求导出 docx
- **THEN** Agent 工具表无 docx 工具
- **AND** 系统 MAY 建议 markdown/csv/pdf 替代

### Requirement: Artifact accept/reject

用户 MUST 可对 artifact 标记 accepted/rejected；状态 MUST 影响后续「写入内容源」类操作是否需要额外确认。

#### Scenario: Rejected artifact not promoted

- **WHEN** 用户 reject artifact
- **THEN** 系统 MUST NOT 自动将该 artifact 写入内容源根目录

### Requirement: Artifact store TTL and capacity

artifactStore MUST 实施 TTL（默认 7 天）与 max 200 条 LRU。过期或淘汰的 artifact id 查询 MUST 返回可读说明并建议重新生成。

#### Scenario: Expired artifact query

- **WHEN** 查询超过 TTL 的 artifact id
- **THEN** 返回 expired/not_found 与中文说明
- **AND** MUST NOT 返回空指针或未捕获异常
