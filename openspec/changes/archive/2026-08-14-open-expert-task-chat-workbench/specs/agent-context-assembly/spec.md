## ADDED Requirements

### Requirement: Knowledge retrieval respects the Session scope

当 Session 声明会话级知识库引用时，知识检索 MUST 仅查询引用中仍然存在且可用的 Provider，并 MUST 记录实际使用的知识来源。没有显式引用时 MUST 回退到当前默认知识库；显式引用全部失效时 MUST 安全降级且不得悄悄扩大到其他知识库。

#### Scenario: Retrieve from selected knowledge providers

- **WHEN** 专家 Session 选择了知识库 A 和 B 并触发检索意图
- **THEN** 检索范围仅包含仍可用的 A 和 B
- **AND** 返回的来源与执行轨迹可标识实际命中的知识库

#### Scenario: No explicit selection uses the default

- **WHEN** Session 没有显式知识库引用并触发检索意图
- **THEN** 系统使用当前默认知识库
- **AND** 保持普通既有 Session 的兼容行为

#### Scenario: All selected providers are unavailable

- **WHEN** Session 显式选择的知识库全部不可用
- **THEN** 系统不查询未选择的其他知识库
- **AND** 对话显示知识范围不可用的可解释降级信息
