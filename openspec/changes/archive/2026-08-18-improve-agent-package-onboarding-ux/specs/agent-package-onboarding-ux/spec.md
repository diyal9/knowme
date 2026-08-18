## Purpose

为 Agent Package 提供安装前可理解的决策界面，让用户在导入前即可判断能力、权限、兼容风险与回滚路径，从而降低误装与失败成本。

## ADDED Requirements

### Requirement: Package 导入前必须提供标准化预检摘要

系统 MUST 在用户确认安装前展示能力摘要、权限范围、协议兼容性、风险等级与成本估算区间，并包含明确的取消安装入口。

#### Scenario: 兼容 Package 预检通过

- **WHEN** 用户在能力目录中选择导入一个协议兼容的 Package
- **THEN** 系统展示可安装状态、权限摘要、风险等级与推荐操作

#### Scenario: 不兼容 Package 预检失败

- **WHEN** 用户导入协议版本不兼容或缺少必需能力声明的 Package
- **THEN** 系统以 fail-closed 阻止安装，并给出可执行修复建议

### Requirement: Package 导入必须提供可追溯回滚入口

系统 MUST 为每次导入记录安装决策摘要，并提供撤销导入或禁用该 Package 的入口，不得仅提供文本提示。

#### Scenario: 用户安装后决定撤销

- **WHEN** 用户在导入完成后发现该 Package 不符合预期
- **THEN** 系统允许用户在导入记录中执行禁用或回滚操作
