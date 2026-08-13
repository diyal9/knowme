## ADDED Requirements

### Requirement: Clear expert refs from personal packages on uninstall

Workflow Package Store MUST 提供按专家 id 清理个人 / forked 包引用的能力：移除匹配的 `agentRefs`，并将 graph `members` / `nodes` 上对应的 `agentPackageId` / `expertId` / `agent` 清空；MUST NOT 删除包或节点结构。官方包 MUST NOT 被修改。

#### Scenario: Clear refs after expert gone

- **WHEN** 调用清理且某个人包节点绑定该专家 id
- **THEN** 该节点的专家引用字段为空，包仍可列出，节点仍在
