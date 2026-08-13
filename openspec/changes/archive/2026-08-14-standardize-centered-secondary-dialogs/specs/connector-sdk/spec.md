## MODIFIED Requirements

### Requirement: Allowlist controls Agent visibility

Each connector MUST support an allowlist of tool names editable in the centered Hub detail dialog; tools not allowlisted MUST NOT be projected to the Agent tool table.

#### Scenario: Hub allowlist editor

- **WHEN** 用户在 Hub 连接器居中详情弹窗勾选 allowlist 工具
- **THEN** 保存后 Agent 仅见勾选工具

#### Scenario: Empty allowlist

- **WHEN** a connector is enabled but allowlist is empty
- **THEN** status remains readable but no Agent tools are projected from that connector
