## ADDED Requirements

### Requirement: Expert orchestration policy

EXPERT.md frontmatter MUST 支持可选字段 `orchestration: { allowDelegate: boolean, maxParallel: number, allowedSubExperts: string[] }`；缺省 `allowDelegate=false`。

#### Scenario: Delegate disabled

- **WHEN** 专家 allowDelegate=false
- **THEN** `delegate_to_expert` MUST NOT 对该专家可用

#### Scenario: Sub-expert allowlist

- **WHEN** allowedSubExperts 非空
- **THEN** 仅列表内 expertId 可被委派

### Requirement: Expert tool surface from registry

专家 Session 的工具投影 MUST 来自 Tool Registry 与专家 connector/skill 绑定的交集，且每个工具契约可见。

#### Scenario: High risk tool requires hub enable

- **WHEN** 专家绑定 feishu 写 draft 工具
- **THEN** 仍受 connector allowlist 与 requiresApproval 约束
