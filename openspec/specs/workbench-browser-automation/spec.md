# workbench-browser-automation Specification

## Purpose

通过 MCP 适配提供交互式浏览器自动化（导航、快照、点击、输入、表单、上传、下载），并在主进程 enforce 域名安全与用户确认，而非内嵌浏览器内核。

## Requirements

### Requirement: Browser tools via MCP adapter

系统 MUST 通过已启用的 Playwright MCP connector 投影标准工具族：`browser_navigate`、`browser_snapshot`、`browser_click`、`browser_type`、`browser_fill_form`、`browser_upload_file`、`browser_download`（命名可与 MCP 源对齐，但 Registry MUST 映射统一契约）。

#### Scenario: Navigate and snapshot

- **WHEN** 模型调用 `browser_navigate` 到 allowlisted URL 并成功
- **THEN** 后续 `browser_snapshot` 返回可访问性树或 DOM 摘要文本
- **AND** 结果计入工具预算与截断规则

#### Scenario: MCP unavailable

- **WHEN** Playwright MCP connector 未安装或未启用
- **THEN** 工具 MUST NOT 出现在 Agent 表
- **AND** UI MAY 提示「安装浏览器自动化能力」

### Requirement: Domain allowlist and user confirmation

浏览器导航 MUST 维护域名 allowlist（默认：无）。**blockedHosts 检查 MUST 先于** allowlist/确认逻辑。首次访问非 allowlist 且非 blocked 的 http(s) 域名 MUST 暂停并请求用户确认（可「本次 Run 允许」或「加入 allowlist」）。

#### Scenario: Blocked domain

- **WHEN** 模型导航到 blocked 或私网域名
- **THEN** 返回 `scope_denied`
- **AND** MUST NOT 加载页面

#### Scenario: User approves once per run

- **WHEN** 用户选择「本次 Run 允许」example.com
- **THEN** 同 Run 内后续 example.com 导航 MAY 自动继续

### Requirement: No embedded browser engine

KnowMe MUST NOT 在 Electron 主进程内嵌 Chromium/Puppeteer 作为默认实现；浏览器交互 MUST 经 MCP transport。

#### Scenario: Architecture compliance

- **WHEN** 审查依赖与 spawn 列表
- **THEN** 默认路径 MUST NOT 新增 puppeteer/playwright npm 硬依赖（MCP server 除外）

### Requirement: Download path scoping

浏览器下载 MUST 落盘到 Run 临时目录或用户明确批准的内容源子目录；MUST NOT 写入系统目录。

#### Scenario: Download to scratch

- **WHEN** `browser_download` 成功
- **THEN** 文件位于 run 沙箱或声明目录
- **AND** envelope 含本地 path 摘要

### Requirement: Blocked hosts hard reject without approval path

`blockedHosts`（含 localhost、127.0.0.1、链路本地、RFC1918 私网）MUST 硬拒绝，返回 `scope_denied`。系统 MUST NOT 对 blocked 域名返回 `approval_required` 或提供用户确认绕过。

#### Scenario: Localhost hard block

- **WHEN** 模型导航到 `http://localhost:3000`
- **THEN** 返回 `code=scope_denied`
- **AND** MUST NOT 返回 `approval_required`

#### Scenario: Private IP hard block

- **WHEN** 模型导航到 `http://192.168.1.1/admin`
- **THEN** 返回 `scope_denied`
- **AND** MUST NOT 加载页面或弹出首次确认

#### Scenario: Non-blocked first visit confirm

- **WHEN** 模型导航到公网未 allowlist 域名（非 blocked）
- **THEN** MAY 返回 `approval_required` 含 host 摘要
- **AND** 用户确认后同 Run 内可继续
