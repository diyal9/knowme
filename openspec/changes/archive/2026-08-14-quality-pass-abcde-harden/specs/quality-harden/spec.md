# Specs: quality-harden

## ADDED Requirements

### Requirement: External open protocols are constrained

应用 MUST 仅允许 http/https/mailto 使用 `openExternal`；本地 `file:` MUST 使用 `openPath`。

#### Scenario: file url

- **WHEN** 渲染进程请求打开 `file:///...`
- **THEN** 主进程通过 `shell.openPath` 打开本地路径，不调用 `shell.openExternal` 处理 file 协议

### Requirement: Settings secrets are window-scoped

非设置窗口的 `get-settings` MUST 不返回 apiKey/gitlabToken 明文。

#### Scenario: workspace get-settings

- **WHEN** 工作台窗口同步读取 settings
- **THEN** apiKey 与 gitlabToken 为空字符串，并提供 configured 布尔标记

### Requirement: Source file reads are size-capped

`readFileUnder` MUST 拒绝超过上限的文件。

#### Scenario: oversized file

- **WHEN** 文件体积超过上限
- **THEN** 返回 ok:false 且含 too_large 类错误，不把全文读入内存
