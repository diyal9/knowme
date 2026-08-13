## ADDED Requirements

### Requirement: Tool contract preview in connector drawer

Capability Hub 连接器/ MCP 详情 MUST 展示 Registry 契约：risk、requiresApproval、scope、timeout、health。

#### Scenario: MCP health degraded

- **WHEN** MCP health=degraded
- **THEN** 卡片与抽屉展示警告且 Agent 投影 MAY 排除该 connector 工具

### Requirement: Risk confirmation on enable write tools

启用含 `risk=external|destructive` 工具入 allowlist 时，Hub MUST 二次确认。

#### Scenario: Enable feishu IM write

- **WHEN** 用户勾选 feishu.draft_send_message
- **THEN** 显示风险说明对话框
- **AND** 确认后才写入 allowlist

### Requirement: Playwright MCP install guidance

当 catalog 含 browser automation pack 时，Hub MUST 提供 Playwright MCP 安装/配置指引链接。

#### Scenario: Missing playwright server

- **WHEN** 无 Playwright MCP connector
- **THEN** Hub 展示安装步骤而非空列表
