## ADDED Requirements

### Requirement: Expert activation validates unified dependencies

创建试聊、Session 快照或启用 Expert 前，系统 MUST 验证 Expert 统一声明中的 required Skill 与 Connector 均存在且已启用；旧 Session 快照 MUST 继续可读。

#### Scenario: Expert dependency is disabled

- **WHEN** Expert 必需绑定的 Skill 或 Connector 已禁用
- **THEN** 新 Session 或试聊 MUST 被阻止并返回依赖问题

#### Scenario: Existing snapshot outlives dependency change

- **WHEN** 已有 Session 快照对应依赖后来被禁用
- **THEN** 快照 persona 与 binding hashes SHALL 保持可读
- **AND** 后续工具执行仍受当前安全策略约束
