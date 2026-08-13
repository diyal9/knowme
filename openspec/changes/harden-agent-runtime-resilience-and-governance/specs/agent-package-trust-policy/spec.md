## Purpose

为 Agent Package 建立供应链可信控制面，在安装与运行前通过签名、来源和吊销策略进行强约束，降低恶意包或污染包进入运行态的风险。

## ADDED Requirements

### Requirement: Package 安装必须执行签名与来源校验

系统 MUST 在 Package 安装前验证发布签名与来源声明，不满足策略时 fail-closed。

#### Scenario: 签名验证成功

- **WHEN** 导入的 Package 签名、来源与策略均匹配
- **THEN** 系统允许进入安装确认流程

#### Scenario: 签名验证失败

- **WHEN** 导入的 Package 缺失签名或签名校验失败
- **THEN** 系统阻断安装并返回修复建议

### Requirement: Package 运行前必须复核吊销策略

系统 SHALL 在运行前复核 Package 是否命中吊销列表，命中时必须禁止运行并提示替代版本。

#### Scenario: 命中吊销列表

- **WHEN** 运行请求引用的 Package 命中吊销策略
- **THEN** 系统拒绝运行并显示可替代版本信息
