## Purpose

管线运行审阅表面（过程摘要 / 过程日志）的可读呈现约定，确保进度类 Markdown 中的结构化表格可被用户扫读。

## ADDED Requirements

### Requirement: Progress markdown tables render as HTML tables

当过程摘要（Daemon progress Markdown）含 GFM 管道表格时，渲染层 MUST 将其输出为 HTML `<table>`（含表头与数据行），MUST NOT 将整表拆成带 `|` 的普通段落。宽表 MUST 可在容器内横向滚动且 MUST NOT 撑破审阅面板布局。

#### Scenario: Steps status table becomes a real table

- **WHEN** 过程摘要包含 `## Steps` 下的管道表（含 `| --- |` 分隔行）
- **THEN** 用户看到结构化表格（表头 + 行），而非逐行显示 `| step | status | …`

#### Scenario: Wide table scrolls inside the progress pane

- **WHEN** Steps 表列数较多超出面板宽度
- **THEN** 表格容器可横向滚动，过程日志面板外框不被撑破
