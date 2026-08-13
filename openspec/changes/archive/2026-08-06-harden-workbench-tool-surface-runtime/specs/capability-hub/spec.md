## ADDED Requirements

### Requirement: Playwright MCP install guidance clickable

Capability Hub 中 Playwright MCP 安装指引 MUST 包含可点击链接或按钮（打开文档或外部安装说明）；health 红灯时 MUST 与安装步骤一致。

#### Scenario: Install link opens

- **WHEN** 用户在 Hub 点击 Playwright 安装指引
- **THEN** 打开有效 URL 或系统浏览器
- **AND** 不产生未预期写操作

#### Scenario: Health red matches missing MCP

- **WHEN** Playwright MCP 未配置
- **THEN** Hub 显示 health 失败与安装指引
- **AND** 文案与单测 fixture 一致
