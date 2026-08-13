## ADDED Requirements

### Requirement: Pack reuses atomic capability declarations

Capability Pack MUST 将 Expert、Skill、Connector 与 Workflow 表达为统一依赖引用，并复用原子能力的权限、风险和 provenance；Pack MUST NOT 复制另一套原子能力 schema。

#### Scenario: Pack dependency closure is resolved

- **WHEN** 用户启用引用 Expert、Skill 与 Connector 的 Pack
- **THEN** 系统 SHALL 使用统一依赖图验证所有 required 原子能力
- **AND** 返回聚合权限与最高风险等级

#### Scenario: Pack has missing required atomic capability

- **WHEN** Pack 引用的 required 原子能力不存在或已禁用
- **THEN** Pack 启用 MUST 被阻止并列出缺失能力
